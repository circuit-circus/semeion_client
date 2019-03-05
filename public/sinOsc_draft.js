var carrier; // this is the oscillator we will hear
var modulator; // this oscillator will modulate the frequency of the carrier

// the carrier frequency pre-modulation
var carrierBaseFreq = 220;

// min/max ranges for modulator
var modMaxFreq = 112;
var modMinFreq = 0;
var modMaxDepth = 150;
var modMinDepth = -150;

function setup() {

  carrier = new p5.Oscillator('sine');
  carrier.amp(0); // set amplitude
  carrier.freq(carrierBaseFreq); // set frequency
  carrier.start(); // start oscillating

  // try changing the type to 'square', 'sine' or 'triangle'
  modulator = new p5.Oscillator('sawtooth');
  modulator.start();

  // add the modulator's output to modulate the carrier's frequency
  modulator.disconnect();
  carrier.freq( modulator );

  // fade carrier in/out on mouseover / touch start
  toggleAudio(cnv);
}

function draw() {
  
  // map mouseY to modulator freq between a maximum and minimum frequency
  var modFreq = map(mouseY, height, 0, modMinFreq, modMaxFreq);
  modulator.freq(modFreq);

  // change the amplitude of the modulator
  // negative amp reverses the sawtooth waveform, and sounds percussive
  //
  var modDepth = map(mouseX, 0, width, modMinDepth, modMaxDepth);
  modulator.amp(modDepth);

}
function toggleAudio(){
    if(1 = 1){
        carrier.amp(1.0, 0.01);
    }
    else{
        carrier.amp(0.0, 0.2);
    }
    
}
