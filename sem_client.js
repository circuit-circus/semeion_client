// sem_client.js
let shouldUseI2C = '0';
let port = 8000;
let configs = require('./configs.js');

checkForCommandlineArguments();

const mqtt_service = require('./modules/mqtt_service');
const i2c = require('./modules/i2c_connect');
const audio = require('./modules/audio');
const utility = require('./modules/utility');
let stdin = process.openStdin();
const dns = require('dns');


// Express Server
const express = require('express');
const app = express();
let server = require('http').createServer(app);  
var io = require('socket.io')(server);

const states = ['DARK', 'IDLE', 'INTERACT', 'CLIMAX', 'SHOCK'];
let currentState = 'DARK';
let sendDataInterval;
let prox = 0;

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
      //console.log('received message %s %s', topic, message)
      switch(topic) {
        case 'sem_client/other_state':
          return handleOtherStateRequest(message);
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
  sendDataInterval = setInterval(sendDataUpdate, 500);
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


function sendDataUpdate() {
  if(shouldUseI2C === '1') {
    i2c.i2cRead().then(function(msg) {
      // Convert the received buffer to a string
      msg = msg.toString('utf8');
      // Remove null bytes, which are used to terminate I2C communication
      msg = msg.substring(0, /\0/.exec(msg).index);
      // Split the string into an array, and convert to Numbers
      msg = msg.split(",").map(Number);

      // Store last state, so we can limit data to only be sent, when changes occur
      let lastState = currentState;
      currentState = states[msg[0]];
      prox = msg[1];

      // Transmit state and data to everyone relevant
      io.emit('state', [currentState, prox]);
      if(lastState !== currentState) {
        sendStateUpdate();
      }

      let dataToSend = JSON.stringify({clientInfo: mqtt_service.myInfo, clientData: msg})
      if(mqtt_service.client !== undefined) {
        mqtt_service.client.publish('sem_client/data', dataToSend);
      }
    })
    .catch(function(error) {
      console.log(error.message);
    });
  }
}

function sendStateUpdate () {
  console.log('My state is now %s', currentState);
  var dataToSend = JSON.stringify({clientInfo: mqtt_service.myInfo, clientState: currentState});
  if(mqtt_service.client !== undefined) {
    mqtt_service.client.publish('sem_client/state', dataToSend);
  }
}

function handleOtherStateRequest(message) {
  var otherState = message.toString();
  if(otherState !== currentState && otherState == 'SHOCK' || otherState == 'CLIMAX') {
    currentState = otherState;
    let stateId = states.findIndex(function(elem) {return elem === currentState});
    console.log('Received state update. So now my state is ' + currentState + ' with id ' + stateId);
    io.emit('state', [currentState, prox]);
    if(shouldUseI2C === '1') {
      i2c.i2cWrite(stateId).then(function(msg) {
        console.log(msg.toString('utf8'));
      })
      .catch(function(error) {
        console.log(error.message);
      });
    }
  }
}

// Commandline string interface for testing
stdin.addListener('data', function(d) {
  let string = d.toString().trim();
  if(string === 'dark') {
    currentState = 'DARK';
    sendStateUpdate();
  }
  else if (string === 'idle') {
    currentState = 'IDLE';
    sendStateUpdate();
  }
  else if (string === 'interact') {
    currentState = 'INTERACT';
    sendStateUpdate();
  }
  else if (string === 'climax') {
    currentState = 'CLIMAX';
    sendStateUpdate();
  }
  else if (string === 'shock') {
    currentState = 'SHOCK';
    sendStateUpdate();
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

