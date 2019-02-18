var socket = io();
var myState = 'IDLE';

var prox = 0;

var loopedAudio, oneShotAudio;
var loopedAudio;
var oneShotAudio;
var isOneShotPlaying = false;
var isLooping = false;
var isFadingLoop = false;

socket.on('state', function(data){
	console.log(data);
	var state = establishState(data);
	console.log(state);

	switch (state) {
	  case 'CLIMAX':
     	isOneShotPlaying = false;
      playOneShot('climax/climax_', 0, 0);
	    break;
	  case 'REACTING-0':
     	isOneShotPlaying = false;
      playOneShot('reacting/reacting_', 0, 0, 1);
	  case 'REACTING-1':
     	isOneShotPlaying = false;
      playOneShot('reacting/reacting_', 0, 0, -1);
	    break;
	  case 'ACTIVE-0':
     	isOneShotPlaying = false;
      playOneShot('active/active_', 0, 0, 1);
	    break;
	  case 'ACTIVE-1':
     	isOneShotPlaying = false;
      playOneShot('active/active_', 0, 0, -1);
	    break;
	  default:
	    break;
	}

  myState = state !== myState ? state : myState;
});

function playSound(filePrefix, fileNumMin, fileNumMax, shouldLoop, side) {
  return new Promise(function(resolve, reject) {
    let fileName = filePrefix;
    fileName += fileNumMin === fileNumMax ? fileNumMin : getRandomInt(fileNumMin, fileNumMax);
    fileName += '.wav';
    console.log('/sfx/' + fileName);
    if(shouldLoop) {
      loopedAudio = new Howl({
				src: ['/sfx/' + fileName],
				autoplay: true,
				loop: true,
				volume: 1.0,
				stereo: side,
				onend: function() {
				resolve('Successfully played ' + fileName);
				},
				onloaderror: function(id, err) {
					reject('Can\'t play ' + id + ': ' + err);
				},
				onfade: function() {
					isLooping = false;
					isFadingLoop = false;
					this.stop();
				}
			});
    }
    else {
      oneShotAudio = new Howl({
      	src: ['/sfx/' + fileName],
			  autoplay: true,
			  volume: 1.0,
			  stereo: side,
			  onend: function() {
			    resolve('Successfully played ' + fileName);
			 	},
			 	onloaderror: function(id, err) {
			 		reject('Can\'t play ' + id + ': ' + err);
			 	}
			});
    }
  })
}

function playLoop(filePrefix, fileNumMin, fileNumMax) {
  if(!isLooping) {
  	isLooping = true;
    playSound(filePrefix, fileNumMin, fileNumMax, true).then(function(msg) {
      playLoop(filePrefix, fileNumMin, fileNumMax);
      console.log(msg);
    })
    .catch(function(err) {
      console.log('Error in loop sound: ' + err);
    });
  }
}

function stopLoop() {
  if(loopedAudio !== undefined && loopedAudio.playing()) {
  	if(!isFadingLoop) loopedAudio.fade(1, 0, 500);
  	isFadingLoop = true;
  }
}

function playOneShot(filePrefix, fileNumMin, fileNumMax, side) {
  if(!isOneShotPlaying) {
    isOneShotPlaying = true;
    playSound(filePrefix, fileNumMin, fileNumMax, false, side).then(function(msg) {
      console.log(msg);
      isOneShotPlaying = false;
    })
    .catch(function(err) {
      console.log('Error in one shot sound: ' + err);
      isOneShotPlaying = false;
    });
  }
}

function establishState(arr) {
	let theState = '';
	for(let i = 0; i < arr.length; i++) {
		if(i === 1) theState = arr[i] ? 'CLIMAX' : '';
		if(i === 2) theState = arr[i] ? 'ACTIVE-0' : '';
		if(i === 3) theState = arr[i] ? 'ACTIVE-1' : '';
		if(i === 4) theState = arr[i] ? 'REACTING-0' : '';
		if(i === 5) theState = arr[i] ? 'REACTING-1' : '';

		if(theState !== '') return theState;
	}
	return theState;
}

// Max is inclusive
function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * Math.floor(max + 1));
}

function mapNumber(x, in_min, in_max, out_min, out_max) {
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}