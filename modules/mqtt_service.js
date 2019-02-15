const configs = require('../configs.js');

// MQTT Server
const mqtt = require('mqtt');
let client;

let myInfo = {'name': 'semclient' + configs.semeionId, 'clientId' : ''};

function initializeMqtt(serverIp) {
  client = mqtt.connect('mqtt://' + serverIp);

  return new Promise(function(resolve, reject) {
    /**
    * Error handler
    * 
    */
    client.on('error', (err) => {
      reject('Error: ' + err);
    });

    /**
    * Handler for when the client connects to the broker
    * Subscribes to relevang channels, and publishes a connect message, so the controller can have its info
    */
    client.on('connect', () => {

      // Get ID
      myInfo.clientId = client.options.clientId;

      // Subscribe to relevant channels
      client.subscribe('sem_client/other_climax');

      // Inform controllers that sem_client is connected and send this Id
      client.publish('sem_client/connect', JSON.stringify(myInfo));

      resolve(client);
    });
  })
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

module.exports = {
  initializeMqtt,
  myInfo
};