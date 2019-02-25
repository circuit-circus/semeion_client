var socket = io();
var myState = 'IDLE';

var song;

var filt, sensorVal = 0, sensorValMin, sensorValMax;
var playing = false;
var t = 0,
    sine, change = 0.1,
    changeMin = 0.02,
    changeMax = 0.33,
    volume = 0, volumeMin = 0.2,
    volumeMax = 2,
    speed, speedMin, speedMax;

function preload() {
    wobble = loadSound('/sfx/wind.mp3');
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    background(255, 0, 0);
    filt = new p5.LowPass();
    wobble.disconnect();
    wobble.connect(filt);
}

function setSensorValues() {
    //CHANGE TO DOPPLER INPUT HERE
    sensorValMin = 0.1;
    sensorValMax = 255;
}

function setSpeed() {
    speedMin = 0.5;
    speedMax = 1.2;
    speed = map(sensorVal, sensorValMin, sensorValMax, speedMin, speedMax);
    speed = constrain(speed, speedMin, speedMax);
}

function setChange() {
    change = map(sensorVal, sensorValMin, sensorValMax, changeMin, changeMax);
    change = constrain(change, changeMin, changeMax);

    t += change;
    sine = sin(t);
}

function setVolume() {
    volume = map(sensorVal, sensorValMin, sensorValMax, volumeMin, volumeMax);
    volume = constrain(volume, volumeMin, volumeMax);

    wobble.amp(volume);
}

function setEffects() {
    let f = map(sine, -1, 1, 100, 20000);
    filt.set(f, 10);
    wobble.rate(speed);
}

function draw() {
    setSpeed();
    setSensorValues();
    setChange();
    setVolume();
    setEffects();
}

function activateSong() {
    wobble.loop();
    wobble.jump(int(random(wobble.duration())));
}

socket.on('state', function(data) {
    // console.log(data);
    var state = establishState(data);
    // console.log(state);
    console.log(sensorVal);

    select('.states').html(data);

    activateSong();

    myState = state !== myState ? state : myState;
});

function establishState(arr) {
    let theState = '';

    sensorVal = arr[6];
    // sensorDatTwo = arr[7];

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