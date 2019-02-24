var socket = io();
var myState = 'IDLE';

var osc;
var playing = false;
var t = 0,
    n, a = 0.1,
    v, vv;

var song;

var sensorDatOne = 0, sensorDatTwo = 0;

socket.on('state', function(data) {
    console.log(data);
    var state = establishState(data);
    console.log(state);

    select('.states').html(data);

    activateSong();

    myState = state !== myState ? state : myState;
});

function preload() {
	console.log('preload');
    song = loadSound('/sfx/healie.wav');
}

function setup() {
	console.log('setup');
    createCanvas(windowWidth, windowHeight);
    background(255, 0, 0);
    backgroundColor = color(255, 0, 255);

}

function draw() {
    if (frameCount % 5 == 0) {
        a = map(sensorDatOne, 0, 255, 0.01, 1.3);
        t += a;
        n = noise(t);

        v = map(sensorDatOne, 0, 255, 0.1, 0.3);
        vv = v + 1.7;


        if (n > 0.5) {
            // song.amp(vv, 0.01);
        } else {
            // song.amp(v, 0.01);
        }
        console.log(v, vv);
    }

    var speed = map(sensorDatOne, 0.1, 255, 0.5, 1.2);
    speed = constrain(speed, 0.5, 1);
    // song.rate(speed);
}

function activateSong() {
    if (song !== undefined) {
        if (!song.isPlaying()) { // .isPlaying() returns a boolean
            console.log('activateSong');
            song.loop();
            background(0, 255, 0);
        }
    }
}

function establishState(arr) {
    let theState = '';
    for (let i = 0; i < arr.length; i++) {
        if (i === 1) theState = arr[i] ? 'CLIMAX' : '';
        if (i === 2) theState = arr[i] ? 'ACTIVE-0' : '';
        if (i === 3) theState = arr[i] ? 'ACTIVE-1' : '';
        if (i === 4) theState = arr[i] ? 'REACTING-0' : '';
        if (i === 5) theState = arr[i] ? 'REACTING-1' : '';
        if (i === 6) sensorDatOne = arr[i];
        if (i === 7) sensorDatTwo = arr[i];

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