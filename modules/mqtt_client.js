const configs = require('../configs.js');
const i2c = require('./i2c_connect');
const audio = require('./audio');


// MQTT Server
const mqtt = require('mqtt');
const mqtt_client = mqtt.connect('mqtt://' + configs.brokerIp);

var myInfo = {'name': 'semclient' + configs.semeionId, 'clientId' : ''};
const states = ['DARK', 'IDLE', 'INTERACT', 'CLIMAX', 'SHOCK']; 
var currentState = 'DARK';

var sendDataInterval;

/**
 * Error handler
 * 
 */
mqtt_client.on('error', (err) => {
  console.log('Error: ' + err);
});

/**
 * Handler for when the client connects to the broker
 * Subscribes to relevang channels, and publishes a connect message, so the controller can have its info
 */
mqtt_client.on('connect', () => {
  console.log('Hello world, I am ' + myInfo.name);

  try {
    audio.playOneShot('l', 0, 0);
  }
  catch (err) {
    console.log(err);
  }

  // Get ID
  myInfo.clientId = mqtt_client.options.clientId;

  // Subscribe to relevant channels
  mqtt_client.subscribe('sem_client/other_state');

  // Inform controllers that sem_client is connected and send this Id
  mqtt_client.publish('sem_client/connect', JSON.stringify(myInfo));

  if(!sendDataInterval) {
    sendDataInterval = setInterval(sendDataUpdate, 500);
  }
});

/**
 * Handler for receiving a new message
 * Passes the message on to the function that will handle it
 */
mqtt_client.on('message', (topic, message) => {
  //console.log('received message %s %s', topic, message)
  switch (topic) {
    case 'sem_client/other_state':
      return handleOtherStateRequest(message);
  }

  console.log('No handler for topic %s', topic);
});



function sendDataUpdate() {
  console.log('Is connected? ' + mqtt_client.connected);
  if(!mqtt_client.connected) {
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
    mqtt_client.publish('sem_client/data', dataToSend);
  })
  .catch(function(error) {
    console.log(error);
  });
}

function sendStateUpdate () {
  console.log('My state is now %s', currentState);
  var dataToSend = JSON.stringify({clientInfo: myInfo, clientState: currentState});
  mqtt_client.publish('sem_client/state', dataToSend);
}

function handleOtherStateRequest (message) {
  var otherState = message.toString();

  if(otherState != currentState) {
    currentState = otherState + '_OTHER';
    console.log('Received state update. So now my state is ' + currentState);
  } else {
    console.log('The others were told that I am ' + currentState);
  }

  setTimeout(function() {
    currentState = 'IDLE';
    console.log('My state is back to ' + currentState);
  }, 5000);
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
 * If the app is shut down, we want to handle that. Sends a disconnect message to the controller
 */
function handleAppExit(options, err) {

  if (err) {
    console.log('Error: ' + err.stack)
  }

  if (options.cleanup) {
    console.log('Cleaning up...');
    mqtt_client.publish('sem_client/disconnect', JSON.stringify(myInfo));
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

module.exports.mqtt_client = mqtt_client;