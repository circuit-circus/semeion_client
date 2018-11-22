// sem_client.js

// Express Server
const express = require('express');
const http = require('http');
const url = require('url');
var path = require('path');
const app = express();
const server = http.createServer(app); // Create normal http server
var io = require('socket.io')(server);

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

// Express Server Calls
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/node_modules/howler/dist'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

server.listen(8000, function listening() {
  console.log('Listening on %d', server.address().port);
});

io.on('connection', function(socket){
  console.log('A user connected');
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
  if(string == 'happy') {
    state = 'HAPPY';
    sendStateUpdate();
  } else if (string == 'scared') {
    state = 'SCARED';
    sendStateUpdate();
  } else if (string == 'curious') {
    state = 'CURIOUS';
    sendStateUpdate();
  }
});

function sendDataUpdate() {
  console.log('Is connected? ' + client.connected);
  if(!client.connected) {
    audio.playOneShot('p', 0, 0);
  }

  i2c.i2cRead().then(function(msg) {
    // Convert the received buffer to a string
    msg = msg.toString('utf8');
    // Remove null bytes, which are used to terminate I2C communication
    msg = msg.substring(0, /\0/.exec(msg).index);
    // Split the string into an array, and convert to Numbers
    msg = msg.split(",").map(Number);

    io.emit('state', [msg[0], msg[1]]);

    // console.log("Parsed Python data: " + msg);
    // console.log("Sending data to server.");
    var dataToSend = JSON.stringify({clientInfo: myInfo, clientData: msg})
    client.publish('sem_client/data', dataToSend);
  })
  .catch(function(error) {
    console.log(error);
  });
}

function sendStateUpdate () {
  console.log('My state is now %s', state);
  var dataToSend = JSON.stringify({clientInfo: myInfo, clientState: state});
  client.publish('sem_client/state', dataToSend);
}

function handleOtherStateRequest (message) {
  var otherState = message.toString();

  if(otherState != state) {
    state = otherState + '_OTHER';
    console.log('Received state update. So now my state is ' + state);
  } else {
    console.log('The others were told that I am ' + state);
  }

  setTimeout(function() {
    state = 'IDLE';
    console.log('My state is back to ' + state);
  }, 5000);
}

// Check for command line arguments
function checkForCommandlineArguments() {
  if(process.argv.indexOf('-ip') != -1) {
    configs.brokerIp = process.argv[process.argv.indexOf('-ip') + 1]; //grab the next item
  }

  if(process.argv.indexOf('-id') != -1) {
    configs.semeionId = process.argv[process.argv.indexOf('-id') + 1]; //grab the next item
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