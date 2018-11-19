// sem_client.js
const mqtt = require('mqtt')
var stdin = process.openStdin();
var configs = require('./configs.js');

checkForCommandlineArguments();

const client = mqtt.connect('mqtt://' + configs.brokerIp);

var myInfo = {'name': 'semclient' + configs.semeionId, 'clientId' : ''};
const states = ['IDLE', 'HAPPY', 'HAPPY_OTHER', 'SCARED', 'SCARED_OTHER', 'CURIOUS', 'CURIOUS_OTHER']; 
var state = 'IDLE';
var lastIsConnected = false;

var sendDataInterval;

client.on('error', (err) => {
  console.log('Error: ' + err);
});

client.on('connect', () => {
  console.log('Hello world, I am ' + myInfo.name);

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
    sendDataInterval = setInterval(sendDataUpdate, 3000);
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

  i2cConnect().then(function(msg) {
    // Convert the received buffer to a string
    msg = msg.toString('utf8');
    // Remove null bytes, which are used to terminate I2C communication
    msg = msg.substring(0, /\0/.exec(msg).index);
    // Split the string into an array, and convert to Numbers
    msg = msg.split(",").map(Number);
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
    console.log('Recieved state update. So now my state is ' + state);
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

// PYTHON CONNECTION
let i2cPyPath = __dirname + '/semeion.py';
// Connects to i2c
function i2cConnect() {
  console.log('Connecting to Python');
  return new Promise(function(resolve, reject) {
    var spawn = require('child_process').spawn;
    var process = spawn('python3', [i2cPyPath]);

    process.stdout.on('data', function (data) {
      process.kill();
      resolve(data);
    });

    process.stderr.on('data', (data) => {
      process.kill();
      reject(Error('Python gave off an error: ' + data));
    });

    process.on('close', (code) => {
      reject(Error('Python was closed with this code: ' + code));
    });

    process.on('error', (err) => {
      reject(Error('An error occured with Python: ' + err));
    });
  });
}
