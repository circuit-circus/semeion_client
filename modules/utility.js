'use strict';

// Max is inclusive
function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * Math.floor(max + 1));
}

function mapNumber(x, in_min, in_max, out_min, out_max) {
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

// When given an app to find, it returns the path on the device
// e.g. 'node' on my Mac returns '/Users/JesperFogh/.nvm/versions/node/v8.10.0/bin/node'
function getAppPath(appName) {
	return new Promise((resolve, reject) => {
		var spawn = require('child_process').spawn;
		var process = spawn('/usr/bin/which', [appName]);

		process.stdout.on('data', function (data) {
		  process.kill();
		  resolve(data.toString().trim());
		});

		process.stderr.on('data', (data) => {
		  process.kill();
		  reject(Error('getAppPath gave off an error: ' + data));
		});

		process.on('close', (code) => {
		  reject(Error('getAppPath was closed with this code: ' + code));
		});

		process.on('error', (err) => {
		  reject(Error('An error occured with getAppPath: ' + err));
		});
	})
}

module.exports = {
  getRandomInt,
  mapNumber,
  getAppPath
}
