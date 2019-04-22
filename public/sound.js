var socket = io();
var myState = 'IDLE';
var id = 0;

var alienNoises = [];
var climaxes = [], numClimaxes = 15;
var backgroundNoise;

var sensorValTech = 0, sensorValBack = 0, sensorValMin, sensorValMax;
var modifiedSensorValTech = 0, modifiedSensorValBack = 0;
var playing = false;
var change = 0.1, changeMin = 0.02, changeMax = 0.33,
    volume = 0, volumeMin = 0, volumeMax = 3,
    speed = 1, speedMin, speedMax, addSpeed = 0.1,
    n, tn = 0, noiseSignal = 0;
    
var readyToPlay = false, 
    backgroundNoiseLoaded = false, 
    alienNoiseLoaded = false, 
    timeOut = false, 
    greetedTech = false, 
    greetedBack = false;

var idReceived = false, fakeSetupCount = 0, fakeLoadCount = 0;

function fakeload() {
    soundFormats('mp3', 'ogg', 'wav');
    for(var i = 0; i <= numClimaxes; i++){
        climaxes[i] = loadSound('/sfx/climaxes_edited/climax'+i+'.mp3');
        console.log("Loaded climax " + i)
    }

    //Load Alien noises
    alienNoises[id] = loadSound('/sfx/alienNoises/alienNoise' + id + '.mp3',
    () => {
        alienNoiseLoaded = true;
        console.log('Alien noise ' + id + ' successfully loaded!');
    },
    (err) => {
        console.log('Alien noise did not load: ' + err.message);
        preload();
    },
    (prog) => {
        console.log('Alien noise loaded: ' + (prog * 100) + '% loaded');
    });

    //Load Background noise (very subtle bass sound)
    backgroundNoise = loadSound('/sfx/background.mp3',
    () => {
        backgroundNoiseLoaded = true;
        console.log('Background noise successfully loaded!');
        
    },
    (err) => {
        console.log('Background noise did not load: ' + err.message);
        preload();
    },
    (prog) => {
        console.log('Background noise ' + (prog * 100) + '% loaded');
    });

    fakeLoadCount++;
}

function fakesetup() {
    if(alienNoiseLoaded && backgroundNoiseLoaded){
        readyToPlay = true;
    }

    fakeSetupCount++;

    /*select('.climax').mousePressed(() => {
        console.log('clicked')
        socket.emit('climax', true);
    })*/
}

function setSensorValues() {
    //CHANGE TO DOPPLER INPUT HERE
    sensorValMin = 0.1;
    sensorValMax = 255;

    modifiedSensorValTech += map(sensorValTech,sensorValMin,sensorValMax,-40,20);
    modifiedSensorValBack += map(sensorValBack,sensorValMin,sensorValMax,-40,20);
 
    modifiedSensorValTech = constrain(modifiedSensorValTech,0,255);
    modifiedSensorValBack = constrain(modifiedSensorValBack,0,255);
}

function setSpeed() {
    speedMin = 0.5;
    speedMax = 1.2;
    //speed = map(modifiedSensorValTech, sensorValMin, sensorValMax, speedMin, speedMax);
    //speed = map(sensorVal, sensorValMin, sensorValMax, speedMin, speedMax);
    //addSpeed = map(modifiedSensorValTech,sensorValMin, sensorValMax,-0.0025,0.005);

    addSpeed = map(modifiedSensorValTech+modifiedSensorValBack,sensorValMin, sensorValMax,-0.1,0.1);
    speed+=addSpeed;
    speed = constrain(speed, speedMin, speedMax);
    alienNoises[id].rate(speed);
}


function setVolume() {
    volume = map(modifiedSensorValTech+modifiedSensorValBack, sensorValMin, sensorValMax, volumeMin, volumeMax);
    volume = constrain(volume, volumeMin, volumeMax);

    alienNoises[id].amp(volume,0.1);
}

function setChange() {
    change = map(sensorValTech+sensorValBack, sensorValMin, sensorValMax*2, changeMin, changeMax);
    change = constrain(change, changeMin, changeMax);
}

function draw() { 
    if(idReceived) {
        if(fakeLoadCount < 1) fakeload();

        if(alienNoiseLoaded && backgroundNoiseLoaded) {
            if(fakeSetupCount < 1) fakesetup();
        }
    }

    if(readyToPlay) {
        setSensorValues();
        setChange();
        setVolume();
        setSpeed();
    }
}

function activateSong() {
    if (!playing && readyToPlay) {
        alienNoises[id].loop();
        alienNoises[id].jump(int(random(alienNoises[id].duration())));
        backgroundNoise.loop();
        backgroundNoise.jump(int(random(backgroundNoise.duration())));
        playing = true;
    }
    
}

socket.on('state', function (data) {
    // console.log(data);
    var state = establishState(data);
    if (state === 'CLIMAX' && readyToPlay) {
        let climaxLottery = getRandomInt(0,climaxes.length);
        climaxes[climaxLottery].play();
        console.log("Played climax "+climaxLottery);
    }

    select('.side-one-activity').html(data[6]);
    select('.side-two-activity').html(data[7]);
    select('.climax-activity').html(state === 'CLIMAX' ? 'Yes!' : 'No');

    activateSong();

    myState = state !== myState ? state : myState;
});

socket.on('connected', function (data) {
    select('.id').html(data);
    id = data;
    idReceived = true;
});

function establishState(arr) {
    let theState = '';

    sensorValTech= arr[6];
    sensorValBack = arr[7];

    for (let i = 0; i < arr.length; i++) {
        if (i === 1) theState = arr[i] ? 'CLIMAX' : '';
        if (i === 2) theState = arr[i] ? 'ACTIVE-0' : '';
        if (i === 3) theState = arr[i] ? 'ACTIVE-1' : '';
        if (i === 4) theState = arr[i] ? 'REACTING-0' : '';
        if (i === 5) theState = arr[i] ? 'REACTING-1' : '';

        if (theState !== '') return theState;
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