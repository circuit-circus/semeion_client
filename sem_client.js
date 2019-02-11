// sem_client.js

// Express Server
const express = require('express');
const http = require('http');
const url = require('url');
var path = require('path');
const app = express();
const server = http.createServer(app); // Create normal http server
var io = require('socket.io')(server);
var port = 8000;

// MQTT Server
const mqtt = require('mqtt');
var stdin = process.openStdin();
const configs = require('./configs.js');

checkForCommandlineArguments();

const client = mqtt.connect('mqtt://' + configs.brokerIp);

var myInfo = {'name': 'semclient' + configs.semeionId, 'clientId' : ''};
const states = ['DARK', 'IDLE', 'INTERACT', 'CLIMAX', 'SHOCK']; 
var state = 'DARK';
var lastIsConnected = false;

var sendDataInterval;

// Other modules
const i2c = require('./modules/i2c_connect');
const audio = require('./modules/audio');
const utility = require('./modules/utility');
const ml = require('./modules/machine_learning');

// Express Server Calls
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/node_modules/howler/dist'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

try {
  server.listen(port, function listening() {
    console.log('Listening on %d', server.address().port);
  });
}
catch (err) {
  console.log(err);
}

io.on('connection', function(socket){
  console.log('A user connected');
  ml.readDataAndTrain().then(function(msg) {
    let newSettings = ml.runNet();
    newSettings.time = 1.0;
    ml.writeSettings(newSettings);
  }).catch(function(err) {
    console.log(err);
  });
});

// MQTT Server Calls
client.on('error', (err) => {
  console.log('Error: ' + err);
});

client.on('connect', () => {
  console.log('Hello world, I am ' + myInfo.name);

  try {
    audio.playOneShot('l', 0, 0);
  }
  catch (err) {
    console.log(err);
  }

  // Get ID
  myInfo.clientId = client.options.clientId;

  // Subscribe to relevant channels
  client.subscribe('sem_client/other_state');
  //client.subscribe('controller/connect');

  // Inform controllers that sem_client is connected and send this Id
  console.log('Now publishing connect');
  client.publish('sem_client/connect', JSON.stringify(myInfo), {qos: 1}, function(error) {
    console.log('callback');
    console.log(error);
  });
  // setTimeout(function() {
  //   console.log('Sending connect');
  //   client.publish('sem_client/connect', JSON.stringify(myInfo));
  // }, 2000);

  lastIsConnected = true;

  if(!sendDataInterval) {
    sendDataInterval = setInterval(sendDataUpdate, 500);
  }
});

client.on('message', (topic, message) => {
  //console.log('received message %s %s', topic, message)
  switch (topic) {
    case 'sem_client/other_state':
      return handleOtherStateRequest(message)
    case 'controller/connect':
      return; //client.publish('sem_client/connect', JSON.stringify(myInfo));
  }

  console.log('No handler for topic %s', topic);
});

// Commandline string interface for testing
stdin.addListener('data', function(d) {
  var string = d.toString().trim();
  if(string === 'dark') {
    state = 'DARK';
    sendStateUpdate();
  }
  else if (string === 'idle') {
    state = 'IDLE';
    sendStateUpdate();
  }
  else if (string === 'interact') {
    state = 'INTERACT';
    sendStateUpdate();
  }
  else if (string === 'climax') {
    state = 'CLIMAX';
    sendStateUpdate();
  }
  else if (string === 'shock') {
    state = 'SHOCK';
    sendStateUpdate();
  }
});

function sendDataUpdate() {
  if(!client.connected) {
    console.log('Is connected? ' + client.connected);
    audio.playOneShot('p', 0, 0);
  }

  i2c.i2cRead().then(function(msg) {
    // Convert the received buffer to a string
    msg = msg.toString('utf8');
    // Remove null bytes, which are used to terminate I2C communication
    msg = msg.substring(0, /\0/.exec(msg).index);
    // Split the string into an array, and convert to Numbers
    msg = msg.split(",").map(Number);

    // Store last state, so we can limit data to only be sent, when changes occur
    let lastState = state;
    state = states[msg[0]];

    // Transmit state and data to everyone relevant
    io.emit('state', [state, msg[1]]);
    if(lastState !== state) {
      sendStateUpdate();
    }
    var dataToSend = JSON.stringify({clientInfo: myInfo, clientData: msg})
    client.publish('sem_client/data', dataToSend);
  })
  .catch(function(error) {
    console.log(error.message);
  });
}

function sendStateUpdate () {
  console.log('My state is now %s', state);
  var dataToSend = JSON.stringify({clientInfo: myInfo, clientState: state});
  client.publish('sem_client/state', dataToSend);
}

function handleOtherStateRequest(message) {
  var otherState = message.toString();
  if(otherState !== state) {
    state = otherState;
    let stateId = states.findIndex(function(elem) {return elem === state});
    console.log('Received state update. So now my state is ' + state + ' with id ' + stateId);
    i2c.i2cWrite([stateId]).then(function(msg) {
      console.log(msg);
    })
    .catch(function(error) {
      console.log(error.message);
    });
  }
}

// Check for command line arguments
function checkForCommandlineArguments() {
  if(process.argv.indexOf('-ip') !== -1) {
    configs.brokerIp = process.argv[process.argv.indexOf('-ip') + 1]; //grab the next item
  }

  if(process.argv.indexOf('-id') !== -1) {
    configs.semeionId = process.argv[process.argv.indexOf('-id') + 1]; //grab the next item
  }

  if(process.argv.indexOf('-port') !== -1) {
    port = process.argv[process.argv.indexOf('-port') + 1]; //grab the next item
  }
}

/**
 * Handle the different ways an application can shutdown
 */

process.once('SIGUSR2', handleAppExit.bind(null, {
  kill: true,
  cleanup: true
}));

process.on('exit', handleAppExit.bind(null, {
  cleanup: true
}));
process.on('SIGINT', handleAppExit.bind(null, {
  exit: true,
  cleanup: true
}));
process.on('uncaughtException', handleAppExit.bind(null, {
  exit: true,
  cleanup: true
}));

/**
 * Want to notify controller that garage is disconnected before shutting down
 */
function handleAppExit (options, err) {
  if (err) {
    console.log('Error: ' + err.stack)
  }

  if (options.cleanup) {
    console.log('Cleaning up...');
    client.publish('sem_client/disconnect', JSON.stringify(myInfo));
  }

  setTimeout(function() {
    if(options.kill) {
      process.kill(process.pid, 'SIGUSR2');
    }

    if (options.exit) {
      process.exit()
    }
  }, 500);
}