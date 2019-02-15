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

let sendDataInterval;
const sendDataIntervalTime = 1000;
let isClimaxing = false;

const i2cWriteRetriesMax = 3;
let i2cWriteRetries = 0;

let trainBrainInterval;
const trainBrainIntervalTime = 5000;

// Express Server Calls
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/node_modules/howler/dist'));

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
      console.log('received message %s %s', topic, message);
      switch(topic) {
        case 'sem_client/other_climax':
          return handleOtherClimax(message);
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

if(!sendDataInterval) {
  sendDataInterval = setInterval(sendDataUpdate, sendDataIntervalTime);
}

if(!trainBrainInterval) {
  trainBrainInterval = setInterval(function() {
    ml.readDataAndTrain().then(function(msg) {
        let newSettings = ml.runNet();
        console.log(newSettings);
        newSettings.time = random();
        ml.writeSettings(newSettings);

      }).catch(function(err) {
        console.log(err);
      });
  },
  trainBrainIntervalTime);
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
function sendDataUpdate() {
  if(shouldUseI2C === '1') {
    i2c.i2cRead(4).then(function(msg) {
      // Convert the received buffer to an array
      let unoMsg = JSON.parse(msg);
      console.log(unoMsg);

      // The first index is the climax state
      if(unoMsg[0] === 1) {
        isClimaxing = true;
      }

      // Transmit state and data to the browser
      io.emit('climax', isClimaxing);
      // Transmit the climax to everyone 
      if(isClimaxing) sendClimaxUpdate(isClimaxing);
    })
    .catch(function(error) {
      console.log(error.message);
    });
  }
}

/**
 * Sends out the climax via MQTT
 */
function sendClimaxUpdate() {
  var dataToSend = JSON.stringify({clientInfo: mqtt_service.myInfo, clientState: isClimaxing});
  if(mqtt_service.client !== undefined) {
    mqtt_service.client.publish('sem_client/climax', dataToSend);
  }
}

/**
 * When other Sems climax, we receive it here. If this sem is not already climaxing, we attempt to write it to the Arduino a couple of times. 
 * @param  {[type]} message 
 */
function handleOtherClimax(message) {
    io.emit('climax', message);
    if(shouldUseI2C === '1' && !isClimaxing) {
      i2c.i2cWrite([0, 1, 150, 1]).then(function(msg) {
        console.log(msg.toString('utf8'));
      })
      .catch(function(error) {
        console.log(error.message);
        // Keep track of how many times we tried
        i2cWriteRetries++;
        // Only retry if we haven't exceeded the max
        if(i2cWriteRetries < i2cWriteRetriesMax) {
          // Wait some time, then try again
          setTimeout(function() {handleOtherClimax(message)}, 250);
        }
        else {
          // Reset retries amount
          i2cWriteRetries = 0;
        }
      });
    }
    isClimaxing = false;
}

// Commandline string interface for testing
stdin.addListener('data', function(d) {
  let string = d.toString().trim();
  if(string === 'climax') {
    isClimaxing = true;
    sendClimaxUpdate(isClimaxing);
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

