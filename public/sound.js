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
	var state = data[0];
	prox = data[1];
	console.log(data);

	switch (state) {
	  // Dark
	  case 0:
			stopLoop();
			playOneShot('k', 0, 11);
			if(myState !== 'DARK') myState = 'DARK';
			break;
	  // Idle
	  case 1:
			stopLoop();
			playOneShot('d', 0, 1);
			if(myState !== 'IDLE') myState = 'IDLE';
			break;
	  // Interact
	  case 2:
			let audioRate = mapNumber(prox, 0, 15, 0, 4);
			console.log(audioRate);
			if(!isLooping) playLoop('test', 2, 2);
			if(loopedAudio !== undefined) loopedAudio.rate(audioRate);
			if(myState !== 'INTERACT') myState = 'INTERACT';
			break;
	  // Climax
	  case 3:
			stopLoop();
			if(myState !== 'CLIMAX') {
				isOneShotPlaying = false;
				playOneShot('n', 0, 0);
				myState = 'CLIMAX';
			}
			break;
	  // Shock
	  case 4:
			stopLoop();
			if(myState !== 'SHOCK') {
				isOneShotPlaying = false;
				playOneShot('d', 4, 4);
				myState = 'SHOCK';
			}
	    break;
	  default:
	    break;
	}
});

function playSound(filePrefix, fileNumMin, fileNumMax, shouldLoop) {
  return new Promise(function(resolve, reject) {
    let fileName = filePrefix;
    fileName += fileNumMin === fileNumMax ? fileNumMin : getRandomInt(fileNumMin, fileNumMax);
    fileName += '.mp3';
    if(shouldLoop) {
      loopedAudio = new Howl({
				src: ['/sfx/' + fileName],
				autoplay: true,
				loop: true,
				volume: 1.0,
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

function playOneShot(filePrefix, fileNumMin, fileNumMax) {
  if(!isOneShotPlaying) {
   isOneShotPlaying = true;
   playSound(filePrefix, fileNumMin, fileNumMax, false).then(function(msg) {
     console.log(msg);
     isOneShotPlaying = false;
   })
   .catch(function(err) {
     console.log('Error in one shot sound: ' + err);
     isOneShotPlaying = false;
   });
  }
}

// Max is inclusive
function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * Math.floor(max + 1));
}

function mapNumber(x, in_min, in_max, out_min, out_max) {
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}