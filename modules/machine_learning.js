// Includes
const brain = require('brain.js');
const fs = require('fs');
var plot = require('plotter').plot;
const noise = require('noisejs');

let db = require('./db');
let ObjectId = require('mongodb').ObjectID;

// Where do we keep our training data and old brains?
var trainLoc = __dirname + '/../brain_data/data.json';
var brainLoc = __dirname + '/../brain_data/brain.json';

// Our configurations for the training part of the network
const trainConfig = {
	// log : details => console.log(details), // Uncomment this line, if you want to get updates on the training
	// logPeriod : 100,
	errorThresh : 0.01, // Stop training, if we reach an error rate of this much
	learningRate : 0.1, // Higher rate means faster learning, but less accurate and more error prone
	iterations : 5000, // Stop training, if we go through this many iterations
	timeout : 1500 // Stop training after this amount of milliseconds
};

const netConfig = {
    hiddenLayers : [3], // How many hidden layers do we want? These are overwritten by an old brain, if it's read
    activation : 'leaky-relu'
};

// Setup a new neural network
let net = new brain.NeuralNetwork(netConfig);
let brainTrained = false;

 // CONNECT TO MONGO 
let dbo = null; // The database object
let mongoURL = 'mongodb://localhost:27017/';
let dbName = 'semeionBrain'; // Our database's name
let collName = 'brainData'; // Our database collection's name

let noiseSeed = 6705;
let noiseGen = new noise.Noise(noiseSeed);
let x = 0.5, y = 0.5;

/**
 * Reads the training data, and then trains the neural network. Will attempt to continue with an old brain, if it's available
 * @return {Promise} A Promise object which resolves upon successful training, but rejects upon errors with reading training data
 */
function readDataAndTrain() {
	return new Promise(function(resolve, reject) {
		getParsedSettings().then((res) => {
			if(!brainTrained) {
				readJSONFile(brainLoc).then(function(brainJSON) {
					// We have read the brain file, so let's load it into the network
					net.fromJSON(brainJSON);

					// Train the old brain
					trainNet(res).then(function(dat) {
						// console.log(dat);
						resolve('Done with training from an old brain');
					}).catch(function(err) {
						console.error(err);
						reject(err);
					});
					brainTrained = true;
				}).catch(function(err) {

					console.log(err);
					// Train a new brain, since we didn't find one
					trainNet(res).then(function(dat) {
						// console.log(dat);
						resolve('Done with training from a new brain');
					}).catch(function(err) {
						console.error(err);
						reject(err);
					});
				});
			}
			else {
				trainNet(res).then(function(dat) {
					resolve('Done with training from a new brain');
				}).catch(function(err) {
					console.error(err);
					reject(err);
				});
			}
		}).catch((err) => {
			// console.log(err);
			reject(err);
		});
	})
}

// Not this function in itself
function startTraining() {
	// console.log('Starting to train brain.');
	return new Promise(function(resolve, reject) {
		readDataAndTrain().then(function(res) {
			// console.log(res);
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
			    if (err) console.log(err);
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

function getParsedSettings() {
	return new Promise((resolve, reject) => {
		try {
			dbo.collection(collName).find({}).toArray((err, result) => {
				if (err) throw err;
				result = parseData(result);
				// console.log('Settings length: ' + result.length);
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
let trainNetPath = __dirname + '/train_net.js';
function trainNet(theData) {
	return new Promise(function(resolve, reject) {
		// SYNC
		net.train(theData, trainConfig);
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

function plotData() {
	// TODO: This part doesn't seem to work all that well right now. Plots seem unfinished.
	return new Promise((resolve, reject) => {
		try {
			dbo.collection(collName).find({}).toArray((err, result) => {
				if (err) throw err;
				let plotHueData = [], plotSatData = [];
				for(let i = 0; i < result.length; i++) {
					plotHueData.push(parseFloat(result[i].baseHue));
					plotSatData.push(parseFloat(result[i].baseSat));
				}

				try {
					plot({
						data: { 
							'Hue' : plotHueData,
							'Sat' : plotSatData
						},
						filename: 'ml_analysis/' + trainConfig.learningRate + '-' + netConfig.hiddenLayers.toString() + '-' + netConfig.activation + '/time-based-noise.pdf',
						format: 'pdf',
						moving_avg:	10,
						xlabel: 'Iterations',
						title: 'S: ' + noiseSeed + ',  TO: ' + trainConfig.timeout + ', LR: ' + trainConfig.learningRate + ', HL: ' + netConfig.hiddenLayers.toString() + ', AC: ' + netConfig.activation
					});
					console.log('Saved plot as: ml_analysis/' + trainConfig.learningRate + '-' + netConfig.hiddenLayers.toString() + '-' + netConfig.activation + '/time-based-noise.pdf');
					console.log('Settings length: ' + result.length);
					resolve(result);
				} catch(err) {
					console.error("Plot error: " + err);
					reject(err);
				}
			})
		} catch(err) {
			reject(err);
		}
	});
}

// Connect to the database and set the database object
db.connect(mongoURL, function(err) {
    if(err) {
        // console.log('Could not connect to database');
        // console.log('Error: ' + err);
        process.exit(-1);
        return;
    }
    // console.log('Connected to Mongo');

    try {
    	dbo = db.get(dbName);
    	// console.log('Found the database');

    	if(process.argv[2] === 'train') {
    		if(process.argv[3] !== undefined) {
		  		let newSettings = JSON.parse(process.argv[3].toString());
		  		
		  		if(process.argv[4] !== undefined) {
		  			noiseGen.seed(parseInt(process.argv[4]));
		  		}

		  		writeSettings(newSettings)
		  		.then((result) => {
		  			// console.log('Successfully wrote settings. Proceeding to train...');
		  			startTraining().then((res) => {
							let theResult = runNetWithSettings(newSettings);

							let theNoise, counter = 1;

							for(var p in newSettings) {
						    if(newSettings.hasOwnProperty(p) && p !== '_id') {
						    	theNoise = noiseGen.perlin2(x, 100 + y * counter);
						    	let moveBy = ((1 - theResult.time) * theNoise) / 5;
						    	let newVal = newSettings[p] + moveBy;
						    	newVal = Math.min(Math.max(newVal, 0), 1);
						      newSettings[p] = newVal;
						      counter++;
						    }
						  }

						  db.close();
						  // Return data to main process
						  let endString = 'Final: ';
						  console.log(endString + JSON.stringify(newSettings));
		  			}).catch((err) => {
		  				console.error(err);
		  			})
		  		})
		  		.catch((err) => {
		  			console.error(err);
		  		});
    		}
    		else {
    			console.error('\x1b[31m%s\x1b[0m', 'newSettings should be the third argument.');
    			process.exit(-3)
    		}
    	}
    	else if(process.argv[2] === 'brain-delete') {
    		// Get confirmation in red colored console log
    		// Source: https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
    		console.log('\x1b[31m%s\x1b[0m', '------------------------------------------------------------------------------------');
    		console.log('\x1b[31m%s\x1b[0m', 'Are you sure you want to delete the brain? Type \'yes\' to confirm.'.toUpperCase());
    		console.log('\x1b[31m%s\x1b[0m', '------------------------------------------------------------------------------------');

    		var standard_input = process.stdin;
    		standard_input.setEncoding('utf-8');
    		standard_input.on('data', (data) => {
    			data = data.toString().trim();
    			if(data.toUpperCase() == 'YES') {
    				try {
			    		fs.writeFile(brainLoc, '', (err) => {
			    			if(err) {
			    				throw err;
			    				process.exit(-5);
			    			}
								else {
									console.log('Deleted the brain.');
									process.exit(100);
								}
			    		});
    				} catch(err) {
    					console.error(err);
    					process.exit(-55);
    				}
    			}
    			else {
    				process.exit(100);
    			}
    		})
    	}
    	else if(process.argv[2] === 'data-delete') {
    		// Get confirmation in red colored console log
    		// Source: https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
    		console.log('\x1b[31m%s\x1b[0m', '------------------------------------------------------------------------------------');
    		console.log('\x1b[31m%s\x1b[0m', 'Are you sure you want to delete the data collection? Type \'yes\' to confirm.'.toUpperCase());
    		console.log('\x1b[31m%s\x1b[0m', '------------------------------------------------------------------------------------');

    		var standard_input = process.stdin;
    		standard_input.setEncoding('utf-8');
    		standard_input.on('data', (data) => {
    			data = data.toString().trim();
    			if(data.toUpperCase() == 'YES') {
    				try {
			    		dbo.collection(collName).drop(function(err, delOK) {
				  	    if (err) throw err;
				  	    if (delOK) console.log('Collection deleted');
				  	    db.close();
				  	    process.exit(110);
				  	  });
    				} catch(err) {
    					console.error(err);
    					process.exit(-56);
    				}
    			}
    			else {
    				process.exit(100);
    			}
    		})
    	}
    	else if(process.argv[2] === 'plot') {
    		plotData().then((res) => {
    			db.close();
    			process.exit(101);
    		}).catch((err) => {
    			console.error(err);
    			db.close();
    			process.exit(-1);
    		})
    	}
    	else {
    		console.log('No proper arguments were given. Try \'train\', \'brain-delete\', \'data-delete\', or \'plot\'.');
    		process.exit(10);
    	}
    } catch(err) {
    	console.error(err);
    }
});