/**
 * HerculesDJConsole
 * LED numbers
 */
var HerculesDJConsole = {
  '[Channel1]': {
    leds: {
      play: 8,
      playBlink: 2,
      cue_default: 9,
      beatsync: 10, // Auto beat
      loop: 13,
      fxCue: 14,
      pfl: 21, // headphones
      keylock: 22, // Master tempo
    },
  },
  '[Channel2]': {
    leds: {
      play: 2,
      playBlink: 5,
      cue_default: 3,
      beatsync: 4, // Auto beat
      loop: 18,
      fxCue: 17,
      pfl: 25, // headphones
      keylock: 26, // Master tempo
    },
  },
};

/**
 * Init console
 *
 */
HerculesDJConsole.init = function (id, debugging) {

  var syncButtonOutputCallback = function (value, group, control) {
    midi.sendShortMsg(0xb1, this[group].leds[control], value ? 0x7f : 0x00);

    // if (item === 'play') {
    //   print('value: ' + value);
    //   // var deckNumber = script.deckFromGroup(group);
    //   // engine.scratchEnable(deckNumber, 128, 33.3333, 0.125, 0.00390625, true);
    // }
  };

  ['play', 'pfl', 'keylock', 'beatsync', 'cue_default'].forEach(function(item) {
    engine.makeConnection('[Channel1]', item, syncButtonOutputCallback);
    engine.makeConnection('[Channel2]', item, syncButtonOutputCallback);
  }, this);
};

/**
 * Shutdown
 */
HerculesDJConsole.shutdown = function() {
};

/**
 * Headphone monitoring
 *
 * @param int channel
 * @param int control
 * @param int value 0-127
 * @param int status
 * @param string group
 */
HerculesDJConsole.pfl = function (channel, control, value, status, group) {

  if (value === 127) {
    var currentValue = engine.getParameter(group, 'pfl');
    engine.setParameter(group, 'pfl', !currentValue);
  }
};

/**
 * Pitch bend if the deck is playing, scratching if not
 *
 * @param int channel
 * @param int control
 * @param int value 0-127
 * @param int status
 * @param string group
 */
HerculesDJConsole.jog = function (channel, control, value, status, group) {

  // A: For a control that centers on 0:
  var newValue;
  if (value < 64) {
    newValue = value;
  } else {
    newValue = value - 128;
  }
  var playing = engine.getParameter(group, 'play');
  var deckNumber = script.deckFromGroup(group);
  if (playing) {
    engine.setValue(group, 'jog', newValue); // Pitch bend
  } else {
    engine.scratchTick(deckNumber, newValue);
  }
};

HerculesDJConsole.keylock = function (channel, control, value, status, group) {

  if (value === 127) {
    var currentValue = engine.getParameter(group, 'keylock');
    engine.setParameter(group, 'keylock', !currentValue);
  }
};

/**
 * Sync tracks
 * Adjust tempo automatically, reset rate when off.
 * 
 * @param int channel
 * @param int control
 * @param int value 0-127
 * @param int status
 * @param string group
 */
HerculesDJConsole.beatsync = function (channel, control, value, status, group) {

  if (value === 127) {
    var currentValue = engine.getParameter(group, 'beatsync');
    engine.setParameter(group, 'beatsync', !currentValue);

    if (currentValue) {
      engine.setValue(group, 'rate', 0);
    }
  }
};

/**
 * Control tempo
 * Moving the sliders turns off auto-beat lights
 * 
 * @param int channel
 * @param int control
 * @param int value 0-127
 * @param int status
 * @param string group
 */
HerculesDJConsole.rate = function (channel, control, value, status, group) {

  midi.sendShortMsg(0xb1, this[group].leds.autobeat, 0x00);
  engine.softTakeover(group, 'rate', true);
  engine.setValue(group, 'rate', this.midiMap(value));
};

/**
 * Control volume
 * Implemented here so you don't have to turn it so much
 * 
 * @param int channel
 * @param int control
 * @param int value 0-127
 * @param int status
 * @param string group
 */
HerculesDJConsole.volume = function (channel, control, value, status, group) {

  var currentValue = engine.getParameter(group, 'volume');

  if (value === 127) {
    newValue = currentValue - .03;
  } else if (value === 1) {
    newValue = currentValue + .03;
  }

  newValue = newValue > 1 ? 1 : newValue;
  newValue = newValue < 0 ? 0 : newValue;
  engine.setParameter(group, 'volume', newValue);
};

/**
 * Control playback
 * Implemented here to handle the lights and scratching
 * Enable scratching only when paused
 * 
 * @param int channel
 * @param int control
 * @param int value 0-127
 * @param int status
 * @param string group
 */
HerculesDJConsole.play = function (channel, control, value, status, group) {

  if (value === 127) {
    if (this.debounce(control)) {
      return;
    }
    var playing = engine.getParameter(group, 'play');
    var deckNumber = script.deckFromGroup(group);

    if (playing) {
      engine.scratchEnable(deckNumber, 128, 33.3333, 0.125, 0.00390625, true);
      engine.setValue(group, 'play', 0);
    } else {
      engine.scratchDisable(deckNumber);
      engine.setValue(group, 'play', 1);
    }
  }
};


/************** UTILITIES ****************/

/**
 * @var array lastPressed Used for debouncing buttons
 */
HerculesDJConsole.lastPressed = [];

/**
 * Debounce button presses (mixxx error? console doesn't do it? faulty buttons?)
 *
 * @param int control
 * @return boolean
 */
HerculesDJConsole.debounce = function(control) {
  var date = new Date;
  var time = date.getTime();
  var threshold = 150; // ms

  if (this.lastPressed[control] !== 'undefined' && time < this.lastPressed[control] + threshold) {
    return true;
  } else {
    this.lastPressed[control] = time;
  }
  return false;
};

/**
 * Map values from 0 to 127 to -1.0 to 1.0
 *
 * @param int value
 * @return float
 */
HerculesDJConsole.midiMap = function(value) {
  var input_start = 0;
  var input_end = 127;
  var output_start = -1;
  var output_end = 1
  var slope = (output_end - output_start) / (input_end - input_start);
  var output = output_start + slope * (value - input_start);

  if (output > -0.008 && output < 0.008) {
    output = 0;
  }
  return output;
};
