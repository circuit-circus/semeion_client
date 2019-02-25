// sem_client.js
let shouldUseI2C = '0';
let port = 8000;
let configs = require('./configs.js');

checkForCommandlineArguments();

const mqtt_service = require('./modules/mqtt_service');
const i2c = require('./modules/i2c_connect');
const audio = require('./modules/audio');
const utility = require('./modules/utility');
const ml = require('./modules/machine_learning');
let stdin = process.openStdin();
const dns = require('dns');

// Express Server
const express = require('express');
const app = express();
let server = require('http').createServer(app);  
var io = require('socket.io')(server);

let checkClimaxInterval;
const checkClimaxIntervalTime = 750;
let isClimaxing = false;

const i2cWriteRetriesMax = 10;
let i2cWriteRetries = 0;

let getSettingsInterval;
let trainingBrain = false;
const getSettingsIntervalTime = 60000;

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
    console.log(err);
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
  getSettingsInterval = setInterval(getSettings, getSettingsIntervalTime);
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
  if(shouldUseI2C === '1') {
    i2c.i2cRead(8, 98).then(function(msg) {
      // Convert the received buffer to an array
      let unoMsg = JSON.parse(msg);
      // console.log(unoMsg);

      // The first index is the climax state
      if(unoMsg[0] === 120) {
        let newSettings = I2CToSettings(unoMsg);
        ml.writeSettings(newSettings).then(function(res) {
          trainBrain();
        }).catch(function(err) {
          console.error(err);
        });
      }
    })
    .catch(function(error) {
      // These errors are common, so no need to print
      if(!error.message.includes('OSError')) {
        console.log(error.message);
      }
    });
  }
}

function trainBrain() {
  if(!trainingBrain) {
    trainingBrain = true;
    ml.startTraining().then(function(msg) {
      let newSettings = ml.runNet();
      let i2cSettings = settingsToI2C(newSettings);
      console.log("Our new settings are: " + i2cSettings);
      writeThisToI2C(0, 95, i2cSettings);
      trainingBrain = false;
    }).catch(function(err) {
      console.log(err);
      trainingBrain = false;
    });
  }
}

/**
 * Attemps to read the i2c status, and calls MQTT to send out a potential climax
 */
function checkClimaxUpdate() {
  if(shouldUseI2C === '1') {
    i2c.i2cRead(8, 99).then(function(msg) {
      // Convert the received buffer to an array
      let unoMsg = JSON.parse(msg);
console.log(unoMsg);

      // The first index is a test
      if(unoMsg[0] === 120) {
        // The second index is the climax state
        console.log(unoMsg[1] === 1);
        isClimaxing = unoMsg[1] === 1 ? true : false;

        // Transmit state and data to the browser
        io.emit('state', unoMsg);
        // Transmit the climax to everyone
        if(isClimaxing) sendClimaxUpdate(isClimaxing);
      }
    })
    .catch(function(error) {
      // These errors are common, so no need to print
      if(!error.message.includes('OSError')) {
        console.log(error.message);
      }
    });
  }
}

/**
 * Sends out the climax via MQTT
 */
function sendClimaxUpdate() {
  var dataToSend = JSON.stringify({clientInfo: mqtt_service.myInfo, clientState: isClimaxing});
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
    // io.emit('state', message);
    if(shouldUseI2C === '1' && !isClimaxing) {
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
      console.log(err);
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
    console.log(error.message);
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
      theSettings[s] = Math.floor(Math.max(Math.min(theSettings[s], 1), 0) * 255);
      settingsArray.push(theSettings[s]);
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

  if(process.argv.indexOf('-i2c') !== -1) {
    shouldUseI2C = process.argv[process.argv.indexOf('-i2c') + 1]; //grab the next item
  }
}

