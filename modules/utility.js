'use strict';

// Max is inclusive
function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * Math.floor(max + 1));
}

function mapNumber(x, in_min, in_max, out_min, out_max) {
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

module.exports = {
  getRandomInt,
  mapNumber
}