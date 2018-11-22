'use strict';

// PYTHON CONNECTION
let i2cReadPath = __dirname + '/../read_i2c.py';
// Connects via i2c to read data from the Arduino
function i2cRead() {
  // console.log('Connecting to Python');
  return new Promise(function(resolve, reject) {
    var spawn = require('child_process').spawn;
    var process = spawn('python3', [i2cReadPath]);

    process.stdout.on('data', function (data) {
      process.kill();
      // console.log('Successfully connected to Python. Parsing data...');
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

module.exports = {
  i2cRead
}