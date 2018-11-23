// sem_client.js
const configs = require('./configs.js');
checkForCommandlineArguments();

const mqtt_client = require('./modules/mqtt_client');
const audio = require('./modules/audio');
const utility = require('./modules/utility');

// Express Server
const express = require('express');
const app = express();
var server = require('http').createServer(app);  
var io = require('socket.io')(server);
var port = 8000;


// Express Server Calls
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/node_modules/howler/dist'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.listen(port, function() {
  console.log('Node app is running on port', port);
});


io.on('connection', function(socket){
  console.log('A user connected with the websocket');
});


// Check for command line arguments
function checkForCommandlineArguments() {
  if(process.argv.indexOf('-ip') != -1) {
    configs.brokerIp = process.argv[process.argv.indexOf('-ip') + 1]; //grab the next item
  }

  if(process.argv.indexOf('-id') != -1) {
    configs.semeionId = process.argv[process.argv.indexOf('-id') + 1]; //grab the next item
  }

  if(process.argv.indexOf('-port') !== -1) {
    port = process.argv[process.argv.indexOf('-port') + 1]; //grab the next item
  }

}

