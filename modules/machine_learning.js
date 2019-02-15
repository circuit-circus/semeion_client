// Includes
const brain = require('brain.js');
const fs = require('fs');

// Where do we keep our training data and old brains?
var trainLoc = __dirname + '/../brain_data/data.json';
var brainLoc = __dirname + '/../brain_data/brain.json';

var trainingData, parsedTrainingData;

// Our configurations for the training part of the network
const trainConfig = {
	// log : details => console.log(details), // Uncomment this line, if you want to get updates on the training
	errorThresh : 0.001, // Stop training, if we reach an error rate of this much
	learningRate : 0.1, // Higher rate means faster learning, but less accurate and more error prone
	iterations : 5000 // Stop training, if we go through this many iterations
};

const netConfig = {
    hiddenLayers : [5, 10, 5] // How many hidden layers do we want? These are overwritten by an old brain, if it's read
};

// Setup a new neural network
const net = new brain.NeuralNetwork(netConfig);

/**
 * Reads the training data, and then trains the neural network. Will attempt to continue with an old brain, if it's available
 * @return {Promise} A Promise object which resolves upon successful training, but rejects upon errors with reading training data
 */
function readDataAndTrain() {
	return new Promise(function(resolve, reject) {
		// Read training data first
		readJSONFile(trainLoc).then(function(res) {

			// save the raw data in a variable
			trainingData = res;

			// Parse the training data so that it's ready for training
			parsedTrainingData = parseData(trainingData);

			// Read a saved brain if we have it
			readJSONFile(brainLoc).then(function(brain) {

				// We have read the brain file, so let's load it into the network
				net.fromJSON(brain);

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
					console.error(err);
					reject(err);
				});

			});

		}).catch(function(err) {
			console.error(err);
			reject(err);
		});
	})
}

function writeSettings(newSettings) {
	trainingData.push(newSettings);
	writeJSONFile(trainLoc, trainingData).then(function(res) {
		console.log(res);
	}).catch(function(err) {
		console.log(err);
	});
}

/**
 * Run the neural network
 * @return {Array} The settings for Semeion that the neural network deems most likely at producing a high time value
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
		net.train(parsedTrainingData, trainConfig);

		fs.writeFile(brainLoc, JSON.stringify(net.toJSON()), (err) => {
			if(err) {
				console.error(err);
				resolve('Brain wasn\'t saved. Check error message');
			}
			else {
				resolve('Brain was saved.');
			}
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
					reject(e);
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
				console.log("Err");
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
			"output" : {
				"climaxThreshold": data[i].climaxThreshold,
				"deactiveThreshold": data[i].deactiveThreshold,
				"reactionThreshold": data[i].reactionThreshold
			},
			"input" : {
				"time" : data[i].time
			}
		};
		newData.push(newObj);
	}

	return newData;
}

module.exports = {
  readDataAndTrain,
  writeSettings,
  runNet
}