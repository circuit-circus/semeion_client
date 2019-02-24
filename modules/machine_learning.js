// Includes
const brain = require('brain.js');
const fs = require('fs');
const utility = require('./utility');
let stdin = process.openStdin();
var plot = require('plotter').plot;
const noise = require('noisejs');

// Where do we keep our training data and old brains?
var trainLoc = __dirname + '/../brain_data/data.json';
var brainLoc = __dirname + '/../brain_data/brain.json';

var trainingData = [], parsedTrainingData;

// Our configurations for the training part of the network
const trainConfig = {
	// log : details => console.log(details), // Uncomment this line, if you want to get updates on the training
	// logPeriod : 100,
	errorThresh : 0.0001, // Stop training, if we reach an error rate of this much
	learningRate : 0.001, // Higher rate means faster learning, but less accurate and more error prone
	iterations : 5000, // Stop training, if we go through this many iterations
	timeout : 300, // Stop training after this amount of milliseconds
	momentum: 0.1
};

const netConfig = {
    hiddenLayers : [3], // How many hidden layers do we want? These are overwritten by an old brain, if it's read
    activation : "leaky-relu"
};

let isDebugging = true;
let theSettings = {
	"baseHue" : 0.5,
	"baseSat" : 0.5
};
let noiseSeed = 6705;
let noiseGen = new noise.Noise(noiseSeed);
let x = Math.random(), y = Math.random();
let plotTimeData = [];
if(isDebugging) {
	console.log('____________________');
	console.log('\n');
	console.log('ISDEBUGGING IS TRUE!');
	console.log('\n');
	console.log('¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯');

	fs.writeFileSync(brainLoc, "", (err) => {
		if(err) {
			console.error(err);
			resolve('Brain wasn\'t saved. Check error message');
		}
		else {
			resolve('Brain was saved.');
		}
	});
	setInterval(() => {
		startTraining().then((res) => {
			let result = runNetWithSettings(theSettings);

			let theNoise, counter = 1;

			for(var p in theSettings) {
		    if(theSettings.hasOwnProperty(p)) {
		    	theNoise = noiseGen.perlin2(x, 100 + y * counter);
		    	let newSett = theSettings[p] + ((1 - result.time) * theNoise);
		    	newSett = Math.min(Math.max(newSett, 0), 1);
		      theSettings[p] = newSett;
		      counter++;
		    }
		  }

			let legibleResult = JSON.parse(JSON.stringify(theSettings));
			legibleResult.time = result.time;
			legibleResult.baseHue *= 255;
			legibleResult.baseSat *= 255;
			 
			plotTimeData.push(result.time);

			let dataResult = JSON.parse(JSON.stringify(theSettings));
			theNoise = noiseGen.perlin2(x, 1000 + y);
			dataResult.time = Math.random();
			dataResult.baseHue = theSettings.baseHue;
			dataResult.baseSat = theSettings.baseSat;

			trainingData.push(dataResult);

			process.stdout.clearLine();
			process.stdout.write("We trained " + trainingData.length + " times.");
			process.stdout.cursorTo(0);

			if(trainingData.length % 30 === 0) {
				console.log('____________________________________________________________');
				console.log('\n');
				console.log((trainingData.length / 60) + ' hours of simulation done. I. e. ' + (trainingData.length / 3360) + ' x SXSW.');
				console.log('\n');
				console.log('¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯');

				let plotHueData = [], plotSatData = [];
				for(let i = 0; i < trainingData.length; i++) {
					plotHueData.push(parseFloat(trainingData[i].baseHue));
					plotSatData.push(parseFloat(trainingData[i].baseSat));
				}
				console.log("Saving to: " + trainConfig.learningRate + '-' + netConfig.hiddenLayers.toString() + '-' + netConfig.activation);
				try {
					plot({
						data:           { 
							'Hue' : plotHueData,
							'Sat' : plotSatData,
							'Time' : plotTimeData
						},
						filename: 'ml_analysis/' + trainConfig.learningRate + '-' + netConfig.hiddenLayers.toString() + '-' + netConfig.activation + '/' + noiseSeed +'.pdf',
						format: 'pdf',
						xlabel: 'Iterations',
						title: 'S: ' + noiseSeed + ',  TO: ' + trainConfig.timeout + ', LR: ' + trainConfig.learningRate + ', HL: ' + netConfig.hiddenLayers.toString() + ', AC: ' + netConfig.activation
					});
				} catch(err) {
					console.log("Plot error: " + err);
				}
				
			}

			x += 1;
			y += 10;
		}).catch((err) => {
			console.error(err);
		})
	}, trainConfig.timeout * 1.1);
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

let startDate = new Date().toTimeString();
function startTraining() {
	// console.log('Started to train brain at ' + startDate);
	
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

function runNetWithSettings(sett) {
	var time = 1.0;
	let settings = {};

	// Go through all properties and parse them accordingly as input or output
	for(var p in sett) {
    if(sett.hasOwnProperty(p)) {
      if(p !== "time") {
      	settings[p] = sett[p];
      }
      else {
      	settings[p] = sett[p];
      }
    }
  }

	var output = net.run(settings);
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
	      if(p !== "time") {
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

// Commandline string interface for testing
stdin.addListener('data', function(d) {
  let string = d.toString().trim();
  if(string === 'seed') {
    noiseSeed = utility.getRandomInt(1, 65500);
    console.log('New noise seed: ' + noiseSeed);
    noiseGen.seed(noiseSeed);
  }
});

module.exports = {
  startTraining,
  writeSettings,
  runNet
}