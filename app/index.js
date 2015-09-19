require('babel/polyfill');

const userVideoToCanvas = require('./user-video-to-canvas');
const captureBackground = require('./capture-background');

const canvas = document.querySelector('canvas.mirror');
const context = canvas.getContext('2d');
const back = document.createElement('canvas');
const backcontext = back.getContext('2d');

let background;

function main() {
  userVideoToCanvas.init({
    canvas: back,
    onready: function() {
      canvas.width = back.width;
      canvas.height = back.height;
    },
    onframe: function() {
      var idata = backcontext.getImageData(0, 0, back.width, back.height);
      idata = mapper(idata);
      context.putImageData(idata, 0, 0);
    },
  });
}

captureBackground.then((backgroundArgument) => {
  background = backgroundArgument;
  main();
});

var images = [];

function addImage(imageData) {
  images.push({
    time: new Date().getTime(),
    data: imageData
  });
}

function findImage(time) {
  var minDiff = Number.MAX_VALUE;
  //var minDiff = 10; or would something like this be better?
  var minDiffImage;
  for (var i = 0; i < images.length; i++) {
    var image = images[i];
    var diff = Math.abs(image.time - time);
    if (diff < minDiff) {
      minDiff = diff;
      minDiffImage = image;
    }
  }
  return minDiffImage;
}

function overlayByAverage(a, b) {
  var newData = new Uint8ClampedArray(a.data.length);
  var w = a.width;
  var h = a.height;

  for(var row = 0; row < h; row++) {
    for(var col = 0; col < w; col++) {
      for (var colorIndex = 0; colorIndex < 4; colorIndex++) {
        var index = ((col + (row * w)) * 4) + colorIndex;
        newData[index] = (a.data[index] + b.data[index]) / 2;
      }
    }
  }

  return new ImageData(newData, w, h);
}

function euclideanDistance(a, b, bOffset) {
  // https://en.wikipedia.org/wiki/Euclidean_distance#n_dimensions
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result += Math.pow(a[i] - b[bOffset + i], 2);
  }
  return Math.sqrt(result);
}

function rgbDistance(a, aOffset, b, bOffset) {
  return Math.sqrt(
    (a[aOffset] - b[bOffset]) - (a[aOffset] - b[bOffset]) +
    (a[aOffset + 1] - b[bOffset + 1]) - (a[aOffset + 1] - b[bOffset + 1]) +
    (a[aOffset + 2] - b[bOffset + 2]) - (a[aOffset + 2] - b[bOffset + 2])
  );
}

/*function overlayByDifference(images) {
  const a = images[0];
  const newData = new Uint8ClampedArray(a.data.length);
  const COLOR_COUNT = 4;

  for(let i = 0; i < a.data.length; i += COLOR_COUNT) {
    // find the furthest
    for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
      const dist = rgbDistance(a.data, i, background.data, i);
      if (dist < 10) {

      }
      var image = images[imageIndex];
      var index = pixelIndex + colorIndex;
      newData[index] = maxImage.data[index];
    }
  }

  return new ImageData(newData, a.width, a.height);
}*/

function overlayByDifference(images) {
  var a = images[0];
  var newData = new Uint8ClampedArray(a.data.length);
  var w = a.width;
  var h = a.height;
  var COLOR_COUNT = 4;
  var avgColors = [];
  for (var colorIndex = 0; colorIndex < COLOR_COUNT; colorIndex++) {
    avgColors.push(0);
  }

  for(var row = 0; row < h; row++) {
    for(var col = 0; col < w; col++) {
      var pixelIndex = (col + (row * w)) * COLOR_COUNT;

      // average them
      for (var colorIndex = 0; colorIndex < COLOR_COUNT; colorIndex++) {
        avgColors[colorIndex] = 0;
        var index = pixelIndex + colorIndex;
        for (var i = 0; i < images.length; i++) {
          var image = images[i];
          avgColors[colorIndex] += image.data[index];
        }
        avgColors[colorIndex] /= images.length;
      }

      // find the furthest
      var maxImage;
      var maxValue = -1; // or -inf? or 0?
      for (var i = 0; i < images.length; i++) {
        var image = images[i];
        var diff = euclideanDistance(avgColors, image.data, pixelIndex);
        if (diff > maxValue) {
          maxImage = image;
          maxValue = diff;
        }
      }

      for (var colorIndex = 0; colorIndex < COLOR_COUNT; colorIndex++) {
        var index = pixelIndex + colorIndex;
        newData[index] = maxImage.data[index];
      }
    }
  }

  return new ImageData(newData, w, h);
}

function mapper(idata) {
  var data = idata.data;
  var w = idata.width;
  var h = idata.height;
  var limit = data.length;
  for(var row = 0; row < h; row++) {
    for(var col = 0; col < Math.floor(w/2); col++) {
      var otherCol = w - col - 1;
      var colIndex = (col + (row * w)) * 4;
      var otherColIndex = (otherCol + (row * w)) * 4;
      // swap!
      for (var colorIndex = 0; colorIndex < 4; colorIndex++) {
        var temp = data[colIndex + colorIndex];
        data[colIndex + colorIndex] = data[otherColIndex + colorIndex];
        data[otherColIndex + colorIndex] = temp;
      }
    }
  }
  addImage(idata);
  var maybeReplacementEarlier = findImage(new Date().getTime() - 15 * 1000);
  var maybeReplacement = findImage(new Date().getTime() - 30 * 1000);
  // Loop through the subpixels, convoluting each using an edge-detection matrix.
  //for(var i = 0; i < limit; i++) {
  //  if( i%4 == 3 ) continue;
  //  data[i] = 127 + 2*data[i] - data[i + 4] - data[i + w*4];
  //}
  if (maybeReplacement && maybeReplacementEarlier) {
    document.querySelector('.time-indicator').textContent = new Date(maybeReplacement.time).toJSON();
    idata = overlayByDifference([maybeReplacement.data, maybeReplacementEarlier.data, idata]);
  }
  return idata;
}
