'use strict';

let i2cReadPath = __dirname + '/../python/read_i2c.py';
let i2cWritePath = __dirname + '/../python/write_i2c.py';

/**
 * Reads data from the ATMega/Tact sensor via I2C
 * @return {Promise} A Promise object, which resolves if data is received, but rejects if anything other happens.
 */
function i2cRead() {
  // console.log('Connecting to Python');
  return new Promise(function(resolve, reject) {
    var spawn = require('child_process').spawn;
    var process = spawn('python3', [i2cReadPath]);

    process.stdout.on('data', function (data) {
      process.kill();
      // console.log('Successfully connected to i2cRead. Parsing data...');
      resolve(data);
    });

    process.stderr.on('data', (data) => {
      process.kill();
      reject(Error('i2cRead gave off an error: ' + data));
    });

    process.on('close', (code) => {
      reject(Error('i2cRead was closed with this code: ' + code));
    });

    process.on('error', (err) => {
      reject(Error('An error occured with i2cRead: ' + err));
    });
  });
}

/**
 * Writes some Array to the ATMega via I2C
 * @param  {Array} The data to be written. Can be up to 32 bytes, but preferably less.
 * @return {Promise} A Promise object, which resolves when we receive data and rejects if we receive an error
 */
function i2cWrite(data) {
  return new Promise(function(resolve, reject) {
    if(Array.isArray(data)) {
      var spawn = require('child_process').spawn;
      var process = spawn('python3', [i2cWritePath, data]);

      process.stdout.on('data', function (msg) {
        process.kill();
        console.log('Successfully connected to i2cWrite. Parsing data...');
        resolve(msg);
      });

      process.stderr.on('data', (data) => {
        process.kill();
        reject(Error('i2cWrite gave off an error: ' + data));
      });

      process.on('close', (code) => {
        reject(Error('i2cWrite was closed with this code: ' + code));
      });

      process.on('error', (err) => {
        reject(Error('An error occured with i2cWrite: ' + err));
      });
    }
    else {
      reject('The passed data to write is not an Array.');
    }
  });
}

module.exports = {
  i2cRead,
  i2cWrite
}