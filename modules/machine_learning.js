// Includes
const brain = require('brain.js');
const fs = require('fs');
var plot = require('plotter').plot;

// Where do we keep our training data and old brains?
var trainLoc = __dirname + '/../brain_data/data.json';
var brainLoc = __dirname + '/../brain_data/brain.json';

var trainingData = [], parsedTrainingData;

// Our configurations for the training part of the network
const trainConfig = {
	// log : details => console.log(details), // Uncomment this line, if you want to get updates on the training
	errorThresh : 0.01, // Stop training, if we reach an error rate of this much
	learningRate : 0.99999, // Higher rate means faster learning, but less accurate and more error prone
	iterations : 5000, // Stop training, if we go through this many iterations
	timeout : 100, // Stop training after this amount of milliseconds
	momentum: 0.5
};

const netConfig = {
    hiddenLayers : [5, 10, 5], // How many hidden layers do we want? These are overwritten by an old brain, if it's read
    activation : "tanh"
};

let isDebugging = true;
let myHue = 0.5, mySat = 0.5;
if(isDebugging) {
	console.log('____________________');
	console.log('\n');
	console.log('ISDEBUGGING IS TRUE!');
	console.log('\n');
	console.log('¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯');
	setInterval(() => {
		startTraining().then((res) => {
			// console.log(res);
			let result = runNet();
			let hueMultiplier = result.baseHue < myHue ? -1 : 1;
			let satMultiplier = result.baseSat < mySat ? -1 : 1;
			// console.log(result);

			myHue += (Math.random() * hueMultiplier) / 255;
			mySat += (Math.random() * satMultiplier) / 255;
			// console.log("Hue: " + (myHue * 255) + " / Sat: " + (mySat * 255));

			let legibleResult = JSON.parse(JSON.stringify(result));
			legibleResult.baseHue *= 255;
			legibleResult.baseSat *= 255;
			// console.log(legibleResult);

			trainingData.push(result);
			// console.log(trainingData.length);

			process.stdout.clearLine();
			process.stdout.write("We trained " + trainingData.length + " times.");
			process.stdout.cursorTo(0);

			if(trainingData.length % 30 === 0) {
				console.log('____________________________________________________________');
				console.log('\n');
				console.log((trainingData.length / 60) + ' hours of simulation done. I. e. ' + (trainingData.length / 3360) + ' x SXSW.');
				console.log('\n');
				console.log('¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯');

				let plotDataHue = [], plotDataSat = [];
				for(let i = 0; i < trainingData.length; i++) {
					plotDataHue.push(trainingData[i].baseHue * 255);
					plotDataSat.push(trainingData[i].baseSat * 255);
				}
				
				try {
					plot({
						data:		{ 
							'Hue' : plotDataHue,
							'Sat' : plotDataSat
						},
						filename:	'output.pdf',
						format:		'pdf'
					});
				} catch(err) {
					console.log("Plotly error: " + err);
				}
				
			}
		}).catch((err) => {
			console.error(err);
		})
	}, trainConfig.timeout * 1.5);
}

// Setup a new neural network
const net = new brain.NeuralNetwork(netConfig);

/**
 * Reads the training data, and then trains the neural network. Will attempt to continue with an old brain, if it's available
 * @return {Promise} A Promise object which resolves upon successful training, but rejects upon errors with reading training data
 */
function readDataAndTrain() {
	return new Promise(function(resolve, reject) {
		readSettings().then(function(res) {
			// Read a saved brain if we have it
			readJSONFile(brainLoc).then(function(brainJSON) {
				// We have read the brain file, so let's load it into the network
				net.fromJSON(brainJSON);

				// Train the old brain
				trainNet().then(function(dat) {
					console.log(dat);
					resolve('Done with training from an old brain');
				}).catch(function(err) {
					console.error(err);
					reject(err);
				});
			}).catch(function(err) {
				console.error(err);
				// Train a new brain, since we didn't find one
				trainNet().then(function(dat) {
					console.log(dat);
					resolve('Done with training from a new brain');
				}).catch(function(err) {
					reject(err);
				});
			});
		}).catch(function(err) {
			console.error(err);
		});
	})
}

function startTraining() {
	// console.log('Starting to train brain.');
	return new Promise(function(resolve, reject) {
		if(trainingData.length <= 1) {
			readDataAndTrain().then(function(res) {
				resolve(res);
			}).catch(function(err) {
				reject(err);
			});
		}
		else {
			// Train the old brain
			trainNet().then(function(dat) {
				resolve('Done with training from an old brain');
			}).catch(function(err) {
				console.error(err);
				reject(err);
			});
		}
	});
}

function writeSettings(newSettings) {
	return new Promise(function(resolve, reject) {
		readSettings().then(function(msg) {
			resolve(msg);
		}).catch(function(error) {
			reject(error);
		}).then(function() {
			trainingData.push(newSettings);
			writeJSONFile(trainLoc, trainingData).then(function(res) {
				resolve(res);
			}).catch(function(err) {
				reject(err);
			});
		});
	});
}

function readSettings() {
	return new Promise(function(resolve, reject) {
		readJSONFile(trainLoc).then(function(res) {

			// save the raw data in a variable
			trainingData = res;

			// Parse the training data so that it's ready for training
			parsedTrainingData = parseData(trainingData);

			resolve('Successfully read training data.');

		}).catch(function(err) {
			console.error(err);
			reject(err);
		});
	});
}

/**
 * Run the neural network
 * @return {Object} The settings for Semeion that the neural network deems most likely at producing a high time value
 */
function runNet() {
	var time = 1.0;
	var output = net.run({"time" : time});
	return output;
}

/**
 * Trains the neural network and saves the neural network to a JSON file
 * @return {Promise} A Promise that resolves no matter if the brain is saved or not.
 */
function trainNet() {
	return new Promise(function(resolve, reject) {
		net.trainAsync(parsedTrainingData, trainConfig).then(function(res) {
			fs.writeFile(brainLoc, JSON.stringify(net.toJSON()), (err) => {
				if(err) {
					console.error(err);
					resolve('Brain wasn\'t saved. Check error message');
				}
				else {
					resolve('Brain was saved.');
				}
			});
		}).catch(function(error) {
			reject(error);
		});
	})
}

/**
 * Reads a JSON file provided by its location and resolves that with a Promise
 * @param  {[type]} loc The location of the JSON file to be read
 * @return {Promise} A Promise object that resolves if data is successfully read, and rejects if not
 */
function readJSONFile(loc) {
	return new Promise(function(resolve, reject) {
		fs.readFile(loc, 'utf8', (err, data) => {
			if(err) {
				reject(err);
			}
			else {
				try {
					data = JSON.parse(data);
					resolve(data);
				}
				catch(e) {
					reject(e.message + ' at loc ' + loc);
				}
			}
		});
	});
}

/**
 * Writes data to a file at loc
 * @param  {[type]} loc  [description]
 * @param  {[type]} data [description]
 * @return {[type]}      [description]
 */
function writeJSONFile(loc, data) {
	return new Promise(function(resolve, reject) {
		let strDat = JSON.stringify(data);
		fs.writeFile(loc, strDat, (err) => {
			if(err) {
				reject(err);
			}
			else {
				resolve('Successfully wrote data to ' + loc);
			}
		});
	});
}

/**
 * Parses the training data so that it's fit for training, by separating it into input/output
 * @param  {Array} data An array of objects containing the current Semeion settings
 * @return {Array} An array of objects with input and output which brain.js needs for NN training
 */
function parseData(data) {
	let newData = [];

	for(var i = 0; i < data.length; i++) {
		let newObj = {
			"output" : {},
			"input" : {}
		};

		// Go through all properties and parse them accordingly as input or output
		for(var p in data[i]) {
	    if(data[i].hasOwnProperty(p)) {
	      if(p === "time") {
	      	newObj.input[p] = data[i][p];
	      }
	      else {
	      	newObj.output[p] = data[i][p];
	      }
	    }
	  }
		newData.push(newObj);
	}

	return newData;
}

module.exports = {
  startTraining,
  writeSettings,
  runNet
}