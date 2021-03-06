// sem_client.js
let port = 8000;
let configs = require('./configs.js');

let shouldSpoofI2C = false;

checkForCommandlineArguments();

const mqtt_service = require('./modules/mqtt_service');
const i2c = require('./modules/i2c_connect');
const audio = require('./modules/audio');
const utility = require('./modules/utility');
// const ml = require('./modules/machine_learning');
let stdin = process.openStdin();
const dns = require('dns');

// Express Server
const express = require('express');
const app = express();
let server = require('http').createServer(app);  
var io = require('socket.io')(server);

let checkClimaxInterval;
const checkClimaxIntervalTime = 287;
let isClimaxing = false;

const i2cWriteRetriesMax = 10;
let i2cWriteRetries = 0;

let getSettingsInterval;
let trainingBrain = false;
const getSettingsIntervalTime = 60000;

// Vars for trying to get the ip from hostname again and again
let tryAgainTimer = 30000;
let tryAgainCounter = 0;
let tryAgainMaxTries = 10;

let mlPath = __dirname + '/modules/machine_learning.js';
let spoofedSettings = [];
let noiseSeed = 6705;
let x = 0, y = 0;

// Express Server Calls
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/node_modules/p5/lib'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

initializeProgram();

function initializeProgram() {

  console.log('Trying to initialize and get IP');
  // Find server ip
  lookupServerIp().then(function(serverIp) {

    console.log('Found server ip! It is ' + serverIp);
    // Then initialize mqtt client
    mqtt_service.initializeMqtt(serverIp).then(function(client) {
      mqtt_service.client = client;

      console.log('Created mqtt client!');

      mqtt_service.client.on('message', (topic, message) => {
        // console.log('received message %s %s', topic, message);
        switch(topic) {
          case 'sem_client/other_climax':
            return handleOtherClimax(message);
          case 'sem_client/other_state':
            return handleOtherState(message);
        }
        console.log('No handler for topic %s', topic);
      });
    })
    .catch(function(err) {
      console.log('Could not initialize MQTT client. Error: ');
      console.log(err);
    });
  })
  .catch(function(err) {
    console.log('Could not find IP. Error: ');
    console.log(err);

    tryAgainCounter++;

    if(tryAgainCounter < tryAgainMaxTries) {

      console.log('Trying again in %s milliseconds, try %s out of %s...', tryAgainTimer, tryAgainCounter, tryAgainMaxTries);

      // Let's try again!
      setTimeout(function() {
        initializeProgram();
      }, tryAgainTimer);

    } else {
      throw new Error('Maxed out on tries to get IP from hostname');
    }
  });
}

io.on('connection', function(socket){
  console.log('A user connected');

  io.emit('connected', configs.semeionId);

  // Work-in-progress
  socket.on('climax', function(dat) {
    if(dat) sendClimaxUpdate(dat);
  })
});

server.listen(port, function() {
  console.log('Node app is running on port', port);
});

if(!checkClimaxInterval) {
  checkClimaxInterval = setInterval(checkClimaxUpdate, checkClimaxIntervalTime);
}

// If we haven't started a repeating call to brain training, then do so now
if(!getSettingsInterval) {
  // Start a repeating call to brain training
  getSettingsInterval = setInterval(() => {
    // To prevent multiple concurrent brain trainings
    if(!trainingBrain) {
      trainingBrain = true;

      // Attempt to get the current settings on from the Arduino
      getSettings().then((dat) => {
        // Convert 
        let i2cSettings = settingsToI2C(JSON.parse(dat.toString()));

        console.log(new Date().toTimeString() + ": Our new settings are: \x1b[35m" + i2cSettings + '\x1b[0m');
        // If we're for real, write the new settings to i2c
        if(!shouldSpoofI2C) {
          writeThisToI2C(0, 95, i2cSettings);
        }
        // Else, let's just save them locally so we use them in our simulations
        else {
          spoofedSettings = JSON.parse(JSON.stringify(i2cSettings));
        }
        trainingBrain = false;
      }).catch((err) => {
        if(err.message !== undefined) {
          if(!err.message.includes('OSError')) console.error(err);
        }
        trainingBrain = false;
      });
    }
  }, getSettingsIntervalTime);
}

// Get the IP of the server from it's hostname (defined in configs)
function lookupServerIp() {
  return new Promise(function(resolve, reject) {
      if(!configs|| !configs.serverHostname) {
        reject('Error: Cannot find serverHostname in configs');
      }
      dns.lookup(configs.serverHostname, function(err, result) {
        if(err) {
          reject(err);
        }
        if(result && result != '') {
          resolve(result);
        }
      });
  });
}

/**
 * Attemps to read the i2c settings, and starts machine learning in a new subprocess
 * @return Promise A Promise object, which resolves if we successfully run the neural network,
 *                 but rejects if an error happens on either the ML side or the I2C side.
 */
function getSettings() {
  return new Promise((resolve, reject) => {
    // First element is 120, so we can confirm that the I2C worked as intended
    let msg = [120];

    // Are we on a non-i2c ready setup, but we want to test ML?
    if(shouldSpoofI2C) {
      // Did we just start our spoofing?
      if(spoofedSettings.length < 1) {
        msg.push(utility.getRandomInt(0, 255));
        msg.push(utility.getRandomInt(0, 255));
        msg.push(0);
        msg.push(utility.getRandomInt(0, 255));
      }
      // or did we continue from earlier data?
      else {
        msg.push(spoofedSettings[1]);
        msg.push(spoofedSettings[2]);
        msg.push(0);
        msg.push(utility.getRandomInt(0, 255));
      }

      // Start the Machine Learning subprocess
      console.log('Starting ML via spoofed I2C!');

      spawnMLProcess(msg).then((data) => {
        resolve(data);
      }).catch((err) => {
        reject(err);
      });
    }
    // If not spoofing, then we read settings from i2c
    else {
      // We expect 8 bytes of data, and we read from the offset 98 here
      i2c.i2cRead(8, 98).then(function(msg) {
        // Convert the received buffer to an array we can work with
        let unoMsg = JSON.parse(msg);

        // Start the Machine Learning subprocess
        spawnMLProcess(unoMsg).then((data) => {
          resolve(data);
        }).catch((err) => {
          reject(err);
        });

      }).catch((err) => {
        reject(err);
      });
    }
  });
}

/**
 * Spawns a neural network as a subprocess to prevent memory leaks that are normally caused by Brain.js' trainAsync function
 * @param  {Array} msg An array that contains our current settings as delivered over I2C
 * @return {Promise} A Promise which resolves if the machine learning goes well, but rejects if not.
 */
function spawnMLProcess(msg) {
  return new Promise((resolve, reject) => {
    let unoMsg = msg;

    // The first index is a safety measure to confirm I2C connections
    if(unoMsg[0] === 120) {
      // Convert the settings from the I2C settings format to the ML settings format
      let newSettings = I2CToSettings(unoMsg);
      var spawn = require('child_process').spawn;
      let nodePath = shouldSpoofI2C ? 'node' : '/home/pi/.nvm/versions/node/v11.9.0/bin/node';
      var process = spawn(nodePath, [mlPath, 'train', JSON.stringify(newSettings), noiseSeed, x, y]);

      process.stdout.on('data', function (data) {
        // endString is in the start of the data that terminates the process
        let endString = 'Final: ';
        let datString = data.toString();
        if(datString.includes(endString)) {
          // clean up after we got what we wanted
          process.kill();
          datString = datString.substring(endString.length);
          x++; y += 10;
          resolve(datString);
        }
        // This error is common, so no need to log it
        else if(!datString.includes("Cannot find module '../build/Release/bson'")) {
          // console.log('Got some data: \x1b[36m' + data + '\x1b[0m');
        }
      });

      process.stderr.on('data', (err) => {
        // This error is common, so no need to log it
        if(!err.includes('DeprecationWarning') && !err.includes('Failed to load c++ bson extension')) {
          process.kill();
          reject('getSettings gave off an error: ' + err);
        }
      });

      process.on('close', (code) => {
        resolve('getSettings was closed with this code: ' + code);
      });

      process.on('error', (err) => {
        reject(Error('An error occured with getSettings: ' + err));
      });
    }
  })
}

/**
 * Attemps to read the i2c status, and calls MQTT to send out a potential climax
 */
function checkClimaxUpdate() {
  if(!shouldSpoofI2C) {
    i2c.i2cRead(8, 99).then(function(msg) {
      // Convert the received buffer to an array
      let unoMsg = JSON.parse(msg);

      // The first index is a test
      if(unoMsg[0] === 120) {
        // The second index is the climax state
        isClimaxing = unoMsg[1] === 1 ? true : false;

        // Set a new seed, because we had a climax
        noiseSeed = utility.getRandomInt(1, 65000);

        let msg = [];
        for(let i = 0; i < unoMsg.length; i++) {
          if(unoMsg[i] > 1) {
            msg[i] = unoMsg[i];
          }
          else {
            msg[i] = unoMsg[i] === 1 ? true : false;
          }
        }

        io.emit('state', msg);
        if(isClimaxing) sendStateUpdate(msg);

        // Transmit state and data to the browser
        // io.emit('state', unoMsg);
        // Transmit the climax to everyone
        // if(isClimaxing) sendClimaxUpdate(isClimaxing);
      }
    })
    .catch(function(error) {
      // These errors are common, so no need to print
      if(!error.message.includes('OSError')) {
        console.error(error.message);
      }
    });
  }
  else {
    let spoofedState = [120, 0, 0, 0, 0, 0, 0, 0];
    spoofedState[0] = 120;
    spoofedState[1] = Math.random() < 0.01 ? 1 : 0;
    spoofedState[2] = Math.random() < 0.2 ? 1 : 0;
    spoofedState[3] = Math.random() < 0.2 ? 1 : 0;
    spoofedState[4] = Math.random() < 0.2 ? 1 : 0;
    spoofedState[5] = Math.random() < 0.2 ? 1 : 0;
    spoofedState[6] += Math.random() < 0.5 ? -1 : Math.random() < 0.5 ? 1 : 5;
    spoofedState[6] = spoofedState[6] < 0 ? 0 : spoofedState[6] > 255 ? 255 : spoofedState[6];
    spoofedState[7] += Math.random() < 0.5 ? -1 : Math.random() < 0.5 ? 1 : 5;
    spoofedState[7] = spoofedState[7] < 0 ? 0 : spoofedState[7] > 255 ? 255 : spoofedState[7];
    io.emit('state', spoofedState);
  }
}

/**
 * Sends out the climax via MQTT
 */
function sendClimaxUpdate(newState) {
  var dataToSend = JSON.stringify({clientInfo: mqtt_service.myInfo, clientState: newState});
  console.log(dataToSend);
  if(mqtt_service.client !== undefined) {
    mqtt_service.client.publish('sem_client/climax', dataToSend);
  }
}

/**
 * Sends out the state via MQTT
 */
function sendStateUpdate(msg) {
  var dataToSend = JSON.stringify({clientInfo: mqtt_service.myInfo, clientState: JSON.stringify(msg)});
  if(mqtt_service.client !== undefined) {
    mqtt_service.client.publish('sem_client/state', dataToSend);
  }
}

/**
 * When other Sems climax, we receive it here. If this sem is not already climaxing, we attempt to write it to the Arduino a couple of times. 
 * @param  {[type]} message 
 */
function handleOtherClimax(message) {
    noiseSeed = utility.getRandomInt(1, 65000);
    if(!shouldSpoofI2C && !isClimaxing) {
      writeThisToI2C(1, 96, [0]);
    }
    isClimaxing = false;
}

/**
 * When other change state, we receive it here. Is useful for debugging, but should not be in the final version.
 * @param  {[type]} message
 */
function handleOtherState(message) {
    try {
      // We get a buffer, so we need to convert it to a string before we parse it
      message = JSON.parse(message.toString('utf8'));
      // console.log(message);
    } catch(err) {
      console.error(err);
    };
    io.emit('state', message);
    noiseSeed = utility.getRandomInt(1, 65000);
    if(message[1]) {
      handleOtherClimax(message);
    }
}

/**
 * A wrapper for the i2cwrite function in the i2c module.
 * It includes attempting to write to I2C a couple of times before giving up
 * @param  {Number} data   The climax state to write
 * @param  {Number} offset The offset to write to
 * @param  {Array} sett   The settings to write
 */
function writeThisToI2C(data, offset, sett) {
  i2c.i2cWrite(data, offset, sett).then(function(msg) {
    // console.log(msg.toString('utf8'));
    if(i2cWriteRetries > 0) console.log('Successfully connected to i2cWrite after ' + i2cWriteRetries + ' tries.');
    i2cWriteRetries = 0;
  })
  .catch(function(error) {
    if(!error.message.includes('OSError')) console.error(error.message);
    // Keep track of how many times we tried
    i2cWriteRetries++;
    // Only retry if we haven't exceeded the max
    if(i2cWriteRetries < i2cWriteRetriesMax) {
      // Wait some time, then try again
      setTimeout(function() {writeThisToI2C(data, offset, sett)}, 300);
    }
    else {
      // Reset retries amount
      i2cWriteRetries = 0;
    }
  });
}

/**
 * Converts a set of ML settings to the format required by I2C. 
 * The main difference is that ML is numbers between 0 and 1, where ML requires 8-byte values, i.e. between 0 and 255
 * @param {Array} sett The settings that we want to convert
 * @return {Array} The converted I2C-ready settings
 */
function settingsToI2C(sett) {
  // First make a clone of the settings we are given
  let theSettings = JSON.parse(JSON.stringify(sett));

  // A faulty connection would show 255 on the Arduino
  // so we're sending 120 as a way to check if the connection is solid
  let settingsArray = [120];
  // Go through all the key-value pairs of the settings, and convert them
  for(let s in theSettings) {
    if(theSettings.hasOwnProperty(s)) {
      // This comes from MongoDB, but we don't need it in our I2C settings
      if(s !== '_id') {
        // The actual conversion happens here
        theSettings[s] = Math.floor(Math.max(Math.min(theSettings[s], 1), 0) * 255);
        // Add it to the settings
        settingsArray.push(theSettings[s]);
      }
    }
  }
  return settingsArray;
}

/**
 * Converts a set of I2C settings to the format required by machine learning. 
 * The main difference is that I2C is in 8-byte values, i.e. between 0 and 255, where ML requires numbers between 0 and 1
 * @param {Array} sett The settings that we want to convert
 * @return {Array} The converted ML-ready settings
 */
function I2CToSettings(sett) {
  let newSettings = {
    "learnHue": sett[1] / 255,
    "learnAni1": sett[2] / 255,
    "learnAni2": sett[3] / 255,
    "learnAni3": sett[4] / 255,
    "learnAni4": sett[5] / 255,
    "learnAni5": sett[6] / 255,
    "time": sett[7] / 255
  };
  return newSettings;
}

// Commandline string interface for testing
stdin.addListener('data', function(d) {
  let string = d.toString().trim();
  let msg = [120, false, false, false, false, false, utility.getRandomInt(0, 255), utility.getRandomInt(0, 255)];
  if(string === 'climax') {
    msg[1] = true;
    console.log('Sending climax!');
    io.emit('state', msg);
    sendStateUpdate(msg);
  }
  else if(string === 'active0') {
    msg[2] = true;
    io.emit('state', msg);
    sendStateUpdate(msg);
  }
  else if(string === 'active1') {
    msg[3] = true;
    io.emit('state', msg);
    sendStateUpdate(msg);
  }
  else if(string === 'reacting0') {
    msg[4] = true;
    io.emit('state', msg);
    sendStateUpdate(msg);
  }
  else if(string === 'reacting1') {
    msg[5] = true;
    io.emit('state', msg);
    sendStateUpdate(msg);
  }
  if(parseInt(string)) {
    noiseSeed = parseInt(string);
    console.log('New noiseseed: ' + noiseSeed);
  }
});

// Check for command line arguments
function checkForCommandlineArguments() {

  if(process.argv.indexOf('-hn') !== -1) {
    configs.serverHostname = process.argv[process.argv.indexOf('-hn') + 1]; //grab the next item
  }

  if(process.argv.indexOf('-ip') !== -1) {
    configs.brokerIp = process.argv[process.argv.indexOf('-ip') + 1]; //grab the next item
  }

  if(process.argv.indexOf('-id') !== -1) {
    configs.semeionId = process.argv[process.argv.indexOf('-id') + 1]; //grab the next item
  }

  if(process.argv.indexOf('-port') !== -1) {
    port = process.argv[process.argv.indexOf('-port') + 1]; //grab the next item
  }

  // Should we fake the i2c connection?
  if(process.argv.indexOf('-spoofi2c') !== -1) {
    // First part is some fancy coloring for console output
    console.log('\x1b[31m%s\x1b[0m', 'I2C spoofing activated!');
    shouldSpoofI2C = true;
  }
}

