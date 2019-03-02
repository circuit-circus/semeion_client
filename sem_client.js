// sem_client.js
let port = 8000;
let configs = require('./configs.js');

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
const checkClimaxIntervalTime = 300;
let isClimaxing = false;

const i2cWriteRetriesMax = 10;
let i2cWriteRetries = 0;

let getSettingsInterval;
let trainingBrain = false;
const getSettingsIntervalTime = 1100;

let mlPath = __dirname + '/modules/machine_learning.js';
let spoofedSettings = [];
let noiseSeed = 6705;

// Express Server Calls
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/node_modules/p5/lib'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

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
    console.error(err);
  });

})

io.on('connection', function(socket){
  console.log('A user connected');
});

server.listen(port, function() {
  console.log('Node app is running on port', port);
});

if(!checkClimaxInterval) {
  checkClimaxInterval = setInterval(checkClimaxUpdate, checkClimaxIntervalTime);
}

if(!getSettingsInterval) {
  getSettingsInterval = setInterval(() => {
    getSettings().then((dat) => {
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
    }).catch((err) => {
      console.error(err);
    });
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
        reject('Error: ' + err);
      }

      if(result && result != '') {
        resolve(result);
      }
    });
    
  });
}

/**
 * Attemps to read the i2c status, and calls MQTT to send out a potential climax
 */
function getSettings() {
  return new Promise((resolve, reject) => {
    let msg = [120];
    // Are we on a non-i2c ready setup, but we want to test ML?
    if(shouldSpoofI2C) {
      // Did we just start our simulation?
      if(spoofedSettings.length < 1) {
        msg.push(utility.getRandomInt(0, 255));
        msg.push(utility.getRandomInt(0, 255));
        msg.push(0);
        msg.push(utility.getRandomInt(0, 255));
      }
      // or do we continute from earlier data?
      else {
        msg.push(spoofedSettings[1]);
        msg.push(spoofedSettings[2]);
        msg.push(0);
        msg.push(utility.getRandomInt(0, 255));
      }
      // Start the ML process
      console.log('Starting ML!');
      spawnMLProcess(msg).then((data) => {
        resolve(data);
      }).catch((err) => {
        reject(err);
      });
    }
    // If not, then let's just read settings from i2c
    else {
      i2c.i2cRead(8, 98).then(function(msg) {
        // Convert the received buffer to an array
        let unoMsg = JSON.parse(msg);
        spawnMLProcess(msg).then((data) => {
          resolve(data);
        }).catch((err) => {
          reject(err);
        });
      })
    }
  });
}

function spawnMLProcess(msg) {
  return new Promise((resolve, reject) => {
    let unoMsg = msg;

    // The first index is the climax state
    if(unoMsg[0] === 120) {
      let newSettings = I2CToSettings(unoMsg);
      // Figure out where node is located, then do something
      utility.getAppPath('node').then((res) => {
        let nodePath = res;

        var spawn = require('child_process').spawn;
        var process = spawn(nodePath, [mlPath, 'train', JSON.stringify(newSettings), noiseSeed]);

        process.stdout.on('data', function (data) {

          // endString is in the start of the data that terminates the process
          let endString = 'Final: ';
          let datString = data.toString();
          if(datString.includes(endString)) {
            // clean up after we got what we wanted
            process.kill();
            datString = datString.substring(endString.length);
            resolve(datString);
          }
          else {
            console.log('Got some data: \x1b[36m' + data + '\x1b[0m');
          }
        });

        process.stderr.on('data', (err) => {
          if(!err.includes('DeprecationWarning')) {
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

        // Transmit state and data to the browser
        io.emit('state', unoMsg);
        // Transmit the climax to everyone
        if(isClimaxing) sendClimaxUpdate(isClimaxing);
      }
    })
    .catch(function(error) {
      // These errors are common, so no need to print
      if(!error.message.includes('OSError')) {
        console.error(error.message);
      }
    });
  }
}

/**
 * Sends out the climax via MQTT
 */
function sendClimaxUpdate() {
  var dataToSend = JSON.stringify({clientInfo: mqtt_service.myInfo, clientState: isClimaxing});
  console.error(dataToSend);
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
    // io.emit('state', message);
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
    } catch(err) {
      console.error(err);
    };
    io.emit('state', message);
    if(message[1]) {
      handleOtherClimax(message);
    }
}

function writeThisToI2C(data, offset, sett) {
  i2c.i2cWrite(data, offset, sett).then(function(msg) {
    // console.log(msg.toString('utf8'));
  })
  .catch(function(error) {
    console.error(error.message);
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

function settingsToI2C(sett) {
  let theSettings = JSON.parse(JSON.stringify(sett));
  // A faulty connection would show 255 on the Arduino
  // so we're sending 120 as a way to check if the connection is solid
  let settingsArray = [120];
  for(let s in theSettings) {
    if(theSettings.hasOwnProperty(s)) {
      if(s !== '_id') {
        theSettings[s] = Math.floor(Math.max(Math.min(theSettings[s], 1), 0) * 255);
        settingsArray.push(theSettings[s]);
      }
    }
  }
  return settingsArray;
}

function I2CToSettings(sett) {
  let newSettings = {
    "baseHue": sett[1] / 255,
    "baseSat": sett[2] / 255,
    "time": sett[4] / 255
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
    shouldSpoofI2C = true;
  }
}

