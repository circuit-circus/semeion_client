var socket = io();
var myState = 'IDLE';
var id = getRandomInt(0,7);

var alienNoises = [];
var climaxes = [], numClimaxes = 15;
var backgroundNoise;
var helloSineTech, helloSineBack;

var sensorValTech = 0, sensorValBack = 0, sensorValMin, sensorValMax;
var modifiedSensorValTech = 0, modifiedSensorValBack = 0;
var sensorSoundTech, sensorSoundBack;
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

function preload() {
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

        sensorSoundTech = loadSound('/sfx/tests/p0.mp3');
        sensorSoundBack = loadSound('/sfx/tests/p1.mp3');

   
}

function setup() {
    helloSineTech = new p5.Oscillator('sine');
    helloSineBack = new p5.Oscillator('triangle');
    
    helloSineTech.start();
    helloSineBack.start();

    if(alienNoiseLoaded && backgroundNoiseLoaded){
        readyToPlay = true;
    }

    select('.climax').mousePressed(() => {
        console.log('clicked')
        socket.emit('climax', true);
    })
}

function setSensorValues() {
    //CHANGE TO DOPPLER INPUT HERE
    sensorValMin = 0.1;
    sensorValMax = 255;

    modifiedSensorValTech += map(sensorValTech,sensorValMin,sensorValMax,-24,12);
    modifiedSensorValBack += map(sensorValBack,sensorValMin,sensorValMax,-24,12);
 
    modifiedSensorValTech = constrain(modifiedSensorValTech,0,255);
    modifiedSensorValBack = constrain(modifiedSensorValBack,0,255);
}

function setSpeed() {
    speedMin = 0.5;
    speedMax = 1.2;
    //speed = map(modifiedSensorValTech, sensorValMin, sensorValMax, speedMin, speedMax);
    //speed = map(sensorVal, sensorValMin, sensorValMax, speedMin, speedMax);
    //addSpeed = map(modifiedSensorValTech,sensorValMin, sensorValMax,-0.0025,0.005);

    addSpeed = map(modifiedSensorValTech,sensorValMin, sensorValMax,-0.1,0.1);
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

function greet(){
    tn += change;
    n = noise(tn);
    noiseSignal = map(sensorValTech+sensorValBack, sensorValMin, sensorValMax*2,400,600)+map(n,0,1,-100,100);
    helloSineTech.pan(-1);
    helloSineBack.pan(1);
    sensorSoundTech.pan(-1);
    sensorSoundBack.pan(1);

    //Greeting tech side
    if(!greetedTech && modifiedSensorValTech < 240 && modifiedSensorValTech > 15){
     
        helloSineTech.freq(noiseSignal); // set frequency
        helloSineTech.amp(2,0.1);
    }
    else{
        helloSineTech.amp(0,0.1); 
       
    }
    //Use if sine greeting
    if(!greetedTech && modifiedSensorValTech > 240){
        greetedTech = true;
    }
    
    //Use if playback greeting
    /*if(!greetedTech && modifiedSensorValTech > 20){
        //sensorSoundTech.play();
        climaxes[15].play();
        greetedTech = true;
    }*/

    if(modifiedSensorValTech < 15){
        greetedTech = false;
    }

    //Greeting back side
    if(!greetedBack && modifiedSensorValBack < 240 && modifiedSensorValBack > 15){
        helloSineBack.freq(noiseSignal); // set frequency
        helloSineBack.amp(2,0.1);
    }
    else{
        helloSineBack.amp(0,0.1); 
    }
    if(modifiedSensorValBack > 240){
        greetedBack = true;
    }
    //Use if sine greeting
    /*if(!greetedBack && modifiedSensorValBack > 20){
        //sensorSoundBack.play();
        climaxes[15].play();
        greetedBack = true;
    }*/

    if(modifiedSensorValBack < 15){
        greetedBack = false;
    }
}

function draw() { 
    setSensorValues();
    setChange();
    setVolume();
    setSpeed();
    greet();

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
    if (state === 'CLIMAX') {
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