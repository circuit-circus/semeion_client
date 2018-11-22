const player = require('./play_sound')(opts = {});
const utility = require('./utility');

var loopedAudio;
var oneShotAudio;
var isOneShotPlaying = false;
var shouldKeepLooping = true;

function playSound(filePrefix, fileNumMin, fileNumMax, shouldLoop) {
  return new Promise(function(resolve, reject) {
    let fileName = filePrefix;
    fileName += fileNumMin === fileNumMax ? fileNumMin : utility.getRandomInt(fileNumMin, fileNumMax);
    fileName += '.mp3';
    if(shouldLoop) {
      loopedAudio = player.play('public/sfx/' + fileName, function(err) {
        if(err) {
          reject('Can\'t play ' + fileName + ': ' + err);
        }
        else {
          resolve('Successfully played ' + fileName);
        }
      });
    }
    else {
      oneShotAudio = player.play('public/sfx/' + fileName, function(err) {
        if(err) {
          reject('Can\'t play ' + fileName + ': ' + err);
        }
        else {
          resolve('Successfully played ' + fileName);
        }
      });
    }
  })
}

function playLoop(filePrefix, fileNumMin, fileNumMax) {
  if(shouldKeepLooping) {
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
  shouldKeepLooping = false;
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

function sendCommandToAudio(proc, key) {
  try {
    proc.stdin.write(key);
  }
  catch (err) {
    console.log(err);
  }
}

module.exports = {
	isOneShotPlaying,
  playSound,
  playLoop,
  stopLoop,
  playOneShot,
  sendCommandToAudio
}