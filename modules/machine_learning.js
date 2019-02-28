// Includes
const brain = require('brain.js');
const fs = require('fs');

let db = require('./db');
let ObjectId = require('mongodb').ObjectID;

// Where do we keep our training data and old brains?
var trainLoc = __dirname + '/../brain_data/data.json';
var brainLoc = __dirname + '/../brain_data/brain.json';

// var trainingData = [], parsedTrainingData;

// Our configurations for the training part of the network
const trainConfig = {
	log : details => console.log(details), // Uncomment this line, if you want to get updates on the training
	logPeriod : 100,
	errorThresh : 0.01, // Stop training, if we reach an error rate of this much
	learningRate : 0.1, // Higher rate means faster learning, but less accurate and more error prone
	iterations : 5000, // Stop training, if we go through this many iterations
	timeout : 500 // Stop training after this amount of milliseconds
};

const netConfig = {
    hiddenLayers : [3], // How many hidden layers do we want? These are overwritten by an old brain, if it's read
    activation : 'leaky-relu'
};

// Setup a new neural network
let net = new brain.NeuralNetwork(netConfig);
let brainTrained = false;

setInterval(() => {
	startTraining().then((res) => {
		console.log(res);
		let newSettings = {
			baseHue : Math.random(),
			baseSat : Math.random(),
			time : Math.random()
		};

		writeSettings(newSettings).then((result) => {
			console.log(result.result);
		}).catch((err) => {
			console.log(err);
		})
		// trainingData.push(newSettings);
		// if(dbo !== null) dbo.collection(collName).insertOne(newSettings);

	}).catch((err) => {
		console.error(err);
	});
}, trainConfig.timeout * 1.1)

 // CONNECT TO MONGO 
let dbo; // The database object
let url = 'mongodb://localhost:27017/';
let dbName = 'semeionBrain'; // Our database's name
let collName = 'brainData'; // Our database collection's name

// Connect to the database and set the database object
db.connect(url, function(err) {
    if(err) {
        console.log('Could not connect to database');
        console.log('Error: ' + err);
        process.exit(1);
        return;
    }
    console.log('Connected to Mongo');

    try {
    	dbo = db.get(dbName);
    	console.log('Found the database');
    } catch(err) {
    	console.log(err);
    }
});

/**
 * Reads the training data, and then trains the neural network. Will attempt to continue with an old brain, if it's available
 * @return {Promise} A Promise object which resolves upon successful training, but rejects upon errors with reading training data
 */
function readDataAndTrain() {
	return new Promise(function(resolve, reject) {
		getParsedSettings().then((res) => {

			console.log(res.length);
			resolve('');

			// Not really this part. Slightly.
			if(!brainTrained) {
				console.log("Brain trained: " + brainTrained);
				// Ikke rigtigt den her del. Lidt måske.
				readJSONFile(brainLoc).then(function(brainJSON) {
					console.log('found old brain');
					// We have read the brain file, so let's load it into the network
					net.fromJSON(brainJSON);

					// Train the old brain
					trainNet(res).then(function(dat) {
						console.log(dat);
						resolve('Done with training from an old brain');
					}).catch(function(err) {
						console.error(err);
						reject(err);
					});
					brainTrained = true;
				}).catch(function(err) {

					console.error(err);
					// Train a new brain, since we didn't find one
					trainNet(res).then(function(dat) {
						console.log(dat);
						resolve('Done with training from a new brain');
					}).catch(function(err) {
						console.error(err);
						reject(err);
					});
				});
			}
			else {
				console.log("Brain trained: " + brainTrained);
				trainNet(res).then(function(dat) {
					console.log(dat);
					resolve('Done with training from a new brain');
				}).catch(function(err) {
					console.error(err);
					reject(err);
				});
			}
		}).catch((err) => {
			console.log(err);
			reject(err);
		});
	})
}

// Not this function in itself
function startTraining() {
	console.log('Starting to train brain.');
	return new Promise(function(resolve, reject) {
		readDataAndTrain().then(function(res) {
			console.log(res);
			resolve(res);
		}).catch(function(err) {
			reject(err);
		});
	});
}

function writeSettings(newSettings) {
	return new Promise(function(resolve, reject) {
		try {
			if(dbo !== null) {
				dbo.collection(collName).insertOne(newSettings, function(err, res) {
			    if (err) throw err;
			    resolve(res);
			  });
			} 
			else {
				throw new Error('Dbo is null!');
			}
		} catch(err) {
			reject(err);
		}
	});
}

// Not really this function
function getParsedSettings() {
	return new Promise((resolve, reject) => {
		try {
			dbo.collection(collName).find({}).toArray((err, result) => {
				if (err) throw err;
				result = parseData(result);
				resolve(result);
			})
		} catch(err) {
			reject(err);
		}
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
	let settings = {};

	// Go through all properties and parse them accordingly as input or output
	for(var p in sett) {
    if(sett.hasOwnProperty(p)) {
      if(p !== "time") {
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
function trainNet(theData) {
	return new Promise(function(resolve, reject) {
		resolve('Yo joe');
		/*net.trainAsync(theData, trainConfig).then(function(res) {
			console.log(res);
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
		});*/
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
	    	if(p !== "_id") {
	    		if(p !== "time") {
	    			newObj.input[p] = data[i][p];
	    		}
	    		else {
	    			newObj.output[p] = data[i][p];
	    		}
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
  runNet,
  runNetWithSettings
}