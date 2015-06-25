(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
navigator.getUserMedia = navigator.getUserMedia ||
navigator.webkitGetUserMedia ||
navigator.mozGetUserMedia;

if (navigator.getUserMedia) {
  //navigator.getUserMedia({ audio: true, video: { width: 1280, height: 720 } },
  navigator.getUserMedia({ audio: false, video: true },
    function(stream) {
      var video = document.querySelector('video');
      var canvas = document.querySelector('canvas');
      var context = canvas.getContext('2d');
      var back = document.createElement('canvas');
      var backcontext = back.getContext('2d');
      video.src = window.URL.createObjectURL(stream);
      video.addEventListener('loadedmetadata', function(){
        video.play();
      });
      video.addEventListener('play', function(){
        cw = video.clientWidth;
        ch = video.clientHeight;
        canvas.width = cw;
        canvas.height = ch;
        back.width = cw;
        back.height = ch;
        draw(video,context,backcontext,cw,ch);
      });
    }, function(err) {
      console.log("The following error occured: " + err.name);
    }
  );
} else {
  console.log("getUserMedia not supported");
}

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

// pick the most dissimilar

function requestDraw(v,c,bc,cw,ch) {
  window.requestAnimationFrame(function(time) {
    draw(v,c,bc,cw,ch, time);
  });
}

function draw(v,c,bc,cw,ch, time) {
  if(v.paused || v.ended) return false;
  // First, draw it into the backing canvas
  bc.drawImage(v,0,0,cw,ch);
  // Grab the pixel data from the backing canvas
  var idata = bc.getImageData(0,0,cw,ch);
  idata = mapper(idata);
  // Draw the pixels onto the visible canvas
  c.putImageData(idata,0,0);
  // Start over!
  requestDraw(v,c,bc,cw,ch);
}

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhID0gbmF2aWdhdG9yLmdldFVzZXJNZWRpYSB8fFxubmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fFxubmF2aWdhdG9yLm1vekdldFVzZXJNZWRpYTtcblxuaWYgKG5hdmlnYXRvci5nZXRVc2VyTWVkaWEpIHtcbiAgLy9uYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKHsgYXVkaW86IHRydWUsIHZpZGVvOiB7IHdpZHRoOiAxMjgwLCBoZWlnaHQ6IDcyMCB9IH0sXG4gIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEoeyBhdWRpbzogZmFsc2UsIHZpZGVvOiB0cnVlIH0sXG4gICAgZnVuY3Rpb24oc3RyZWFtKSB7XG4gICAgICB2YXIgdmlkZW8gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCd2aWRlbycpO1xuICAgICAgdmFyIGNhbnZhcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2NhbnZhcycpO1xuICAgICAgdmFyIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICAgIHZhciBiYWNrID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgICB2YXIgYmFja2NvbnRleHQgPSBiYWNrLmdldENvbnRleHQoJzJkJyk7XG4gICAgICB2aWRlby5zcmMgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChzdHJlYW0pO1xuICAgICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCBmdW5jdGlvbigpe1xuICAgICAgICB2aWRlby5wbGF5KCk7XG4gICAgICB9KTtcbiAgICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3BsYXknLCBmdW5jdGlvbigpe1xuICAgICAgICBjdyA9IHZpZGVvLmNsaWVudFdpZHRoO1xuICAgICAgICBjaCA9IHZpZGVvLmNsaWVudEhlaWdodDtcbiAgICAgICAgY2FudmFzLndpZHRoID0gY3c7XG4gICAgICAgIGNhbnZhcy5oZWlnaHQgPSBjaDtcbiAgICAgICAgYmFjay53aWR0aCA9IGN3O1xuICAgICAgICBiYWNrLmhlaWdodCA9IGNoO1xuICAgICAgICBkcmF3KHZpZGVvLGNvbnRleHQsYmFja2NvbnRleHQsY3csY2gpO1xuICAgICAgfSk7XG4gICAgfSwgZnVuY3Rpb24oZXJyKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIlRoZSBmb2xsb3dpbmcgZXJyb3Igb2NjdXJlZDogXCIgKyBlcnIubmFtZSk7XG4gICAgfVxuICApO1xufSBlbHNlIHtcbiAgY29uc29sZS5sb2coXCJnZXRVc2VyTWVkaWEgbm90IHN1cHBvcnRlZFwiKTtcbn1cblxudmFyIGltYWdlcyA9IFtdO1xuXG5mdW5jdGlvbiBhZGRJbWFnZShpbWFnZURhdGEpIHtcbiAgaW1hZ2VzLnB1c2goe1xuICAgIHRpbWU6IG5ldyBEYXRlKCkuZ2V0VGltZSgpLFxuICAgIGRhdGE6IGltYWdlRGF0YVxuICB9KTtcbn1cblxuZnVuY3Rpb24gZmluZEltYWdlKHRpbWUpIHtcbiAgdmFyIG1pbkRpZmYgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAvL3ZhciBtaW5EaWZmID0gMTA7IG9yIHdvdWxkIHNvbWV0aGluZyBsaWtlIHRoaXMgYmUgYmV0dGVyP1xuICB2YXIgbWluRGlmZkltYWdlO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGltYWdlcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpbWFnZSA9IGltYWdlc1tpXTtcbiAgICB2YXIgZGlmZiA9IE1hdGguYWJzKGltYWdlLnRpbWUgLSB0aW1lKTtcbiAgICBpZiAoZGlmZiA8IG1pbkRpZmYpIHtcbiAgICAgIG1pbkRpZmYgPSBkaWZmO1xuICAgICAgbWluRGlmZkltYWdlID0gaW1hZ2U7XG4gICAgfVxuICB9XG4gIHJldHVybiBtaW5EaWZmSW1hZ2U7XG59XG5cbmZ1bmN0aW9uIG92ZXJsYXlCeUF2ZXJhZ2UoYSwgYikge1xuICB2YXIgbmV3RGF0YSA9IG5ldyBVaW50OENsYW1wZWRBcnJheShhLmRhdGEubGVuZ3RoKTtcbiAgdmFyIHcgPSBhLndpZHRoO1xuICB2YXIgaCA9IGEuaGVpZ2h0O1xuXG4gIGZvcih2YXIgcm93ID0gMDsgcm93IDwgaDsgcm93KyspIHtcbiAgICBmb3IodmFyIGNvbCA9IDA7IGNvbCA8IHc7IGNvbCsrKSB7XG4gICAgICBmb3IgKHZhciBjb2xvckluZGV4ID0gMDsgY29sb3JJbmRleCA8IDQ7IGNvbG9ySW5kZXgrKykge1xuICAgICAgICB2YXIgaW5kZXggPSAoKGNvbCArIChyb3cgKiB3KSkgKiA0KSArIGNvbG9ySW5kZXg7XG4gICAgICAgIG5ld0RhdGFbaW5kZXhdID0gKGEuZGF0YVtpbmRleF0gKyBiLmRhdGFbaW5kZXhdKSAvIDI7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5ldyBJbWFnZURhdGEobmV3RGF0YSwgdywgaCk7XG59XG5cbmZ1bmN0aW9uIGV1Y2xpZGVhbkRpc3RhbmNlKGEsIGIsIGJPZmZzZXQpIHtcbiAgLy8gaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRXVjbGlkZWFuX2Rpc3RhbmNlI25fZGltZW5zaW9uc1xuICB2YXIgcmVzdWx0ID0gMDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgcmVzdWx0ICs9IE1hdGgucG93KGFbaV0gLSBiW2JPZmZzZXQgKyBpXSwgMik7XG4gIH1cbiAgcmV0dXJuIE1hdGguc3FydChyZXN1bHQpO1xufVxuXG5mdW5jdGlvbiBvdmVybGF5QnlEaWZmZXJlbmNlKGltYWdlcykge1xuICB2YXIgYSA9IGltYWdlc1swXTtcbiAgdmFyIG5ld0RhdGEgPSBuZXcgVWludDhDbGFtcGVkQXJyYXkoYS5kYXRhLmxlbmd0aCk7XG4gIHZhciB3ID0gYS53aWR0aDtcbiAgdmFyIGggPSBhLmhlaWdodDtcbiAgdmFyIENPTE9SX0NPVU5UID0gNDtcbiAgdmFyIGF2Z0NvbG9ycyA9IFtdO1xuICBmb3IgKHZhciBjb2xvckluZGV4ID0gMDsgY29sb3JJbmRleCA8IENPTE9SX0NPVU5UOyBjb2xvckluZGV4KyspIHtcbiAgICBhdmdDb2xvcnMucHVzaCgwKTtcbiAgfVxuXG4gIGZvcih2YXIgcm93ID0gMDsgcm93IDwgaDsgcm93KyspIHtcbiAgICBmb3IodmFyIGNvbCA9IDA7IGNvbCA8IHc7IGNvbCsrKSB7XG4gICAgICB2YXIgcGl4ZWxJbmRleCA9IChjb2wgKyAocm93ICogdykpICogQ09MT1JfQ09VTlQ7XG5cbiAgICAgIC8vIGF2ZXJhZ2UgdGhlbVxuICAgICAgZm9yICh2YXIgY29sb3JJbmRleCA9IDA7IGNvbG9ySW5kZXggPCBDT0xPUl9DT1VOVDsgY29sb3JJbmRleCsrKSB7XG4gICAgICAgIGF2Z0NvbG9yc1tjb2xvckluZGV4XSA9IDA7XG4gICAgICAgIHZhciBpbmRleCA9IHBpeGVsSW5kZXggKyBjb2xvckluZGV4O1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGltYWdlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHZhciBpbWFnZSA9IGltYWdlc1tpXTtcbiAgICAgICAgICBhdmdDb2xvcnNbY29sb3JJbmRleF0gKz0gaW1hZ2UuZGF0YVtpbmRleF07XG4gICAgICAgIH1cbiAgICAgICAgYXZnQ29sb3JzW2NvbG9ySW5kZXhdIC89IGltYWdlcy5sZW5ndGg7XG4gICAgICB9XG5cbiAgICAgIC8vIGZpbmQgdGhlIGZ1cnRoZXN0XG4gICAgICB2YXIgbWF4SW1hZ2U7XG4gICAgICB2YXIgbWF4VmFsdWUgPSAtMTsgLy8gb3IgLWluZj8gb3IgMD9cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW1hZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBpbWFnZSA9IGltYWdlc1tpXTtcbiAgICAgICAgdmFyIGRpZmYgPSBldWNsaWRlYW5EaXN0YW5jZShhdmdDb2xvcnMsIGltYWdlLmRhdGEsIHBpeGVsSW5kZXgpO1xuICAgICAgICBpZiAoZGlmZiA+IG1heFZhbHVlKSB7XG4gICAgICAgICAgbWF4SW1hZ2UgPSBpbWFnZTtcbiAgICAgICAgICBtYXhWYWx1ZSA9IGRpZmY7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgY29sb3JJbmRleCA9IDA7IGNvbG9ySW5kZXggPCBDT0xPUl9DT1VOVDsgY29sb3JJbmRleCsrKSB7XG4gICAgICAgIHZhciBpbmRleCA9IHBpeGVsSW5kZXggKyBjb2xvckluZGV4O1xuICAgICAgICBuZXdEYXRhW2luZGV4XSA9IG1heEltYWdlLmRhdGFbaW5kZXhdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuZXcgSW1hZ2VEYXRhKG5ld0RhdGEsIHcsIGgpO1xufVxuXG5mdW5jdGlvbiBtYXBwZXIoaWRhdGEpIHtcbiAgdmFyIGRhdGEgPSBpZGF0YS5kYXRhO1xuICB2YXIgdyA9IGlkYXRhLndpZHRoO1xuICB2YXIgaCA9IGlkYXRhLmhlaWdodDtcbiAgdmFyIGxpbWl0ID0gZGF0YS5sZW5ndGg7XG4gIGZvcih2YXIgcm93ID0gMDsgcm93IDwgaDsgcm93KyspIHtcbiAgICBmb3IodmFyIGNvbCA9IDA7IGNvbCA8IE1hdGguZmxvb3Iody8yKTsgY29sKyspIHtcbiAgICAgIHZhciBvdGhlckNvbCA9IHcgLSBjb2wgLSAxO1xuICAgICAgdmFyIGNvbEluZGV4ID0gKGNvbCArIChyb3cgKiB3KSkgKiA0O1xuICAgICAgdmFyIG90aGVyQ29sSW5kZXggPSAob3RoZXJDb2wgKyAocm93ICogdykpICogNDtcbiAgICAgIC8vIHN3YXAhXG4gICAgICBmb3IgKHZhciBjb2xvckluZGV4ID0gMDsgY29sb3JJbmRleCA8IDQ7IGNvbG9ySW5kZXgrKykge1xuICAgICAgICB2YXIgdGVtcCA9IGRhdGFbY29sSW5kZXggKyBjb2xvckluZGV4XTtcbiAgICAgICAgZGF0YVtjb2xJbmRleCArIGNvbG9ySW5kZXhdID0gZGF0YVtvdGhlckNvbEluZGV4ICsgY29sb3JJbmRleF07XG4gICAgICAgIGRhdGFbb3RoZXJDb2xJbmRleCArIGNvbG9ySW5kZXhdID0gdGVtcDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYWRkSW1hZ2UoaWRhdGEpO1xuICB2YXIgbWF5YmVSZXBsYWNlbWVudEVhcmxpZXIgPSBmaW5kSW1hZ2UobmV3IERhdGUoKS5nZXRUaW1lKCkgLSAxNSAqIDEwMDApO1xuICB2YXIgbWF5YmVSZXBsYWNlbWVudCA9IGZpbmRJbWFnZShuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIDMwICogMTAwMCk7XG4gIC8vIExvb3AgdGhyb3VnaCB0aGUgc3VicGl4ZWxzLCBjb252b2x1dGluZyBlYWNoIHVzaW5nIGFuIGVkZ2UtZGV0ZWN0aW9uIG1hdHJpeC5cbiAgLy9mb3IodmFyIGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAvLyAgaWYoIGklNCA9PSAzICkgY29udGludWU7XG4gIC8vICBkYXRhW2ldID0gMTI3ICsgMipkYXRhW2ldIC0gZGF0YVtpICsgNF0gLSBkYXRhW2kgKyB3KjRdO1xuICAvL31cbiAgaWYgKG1heWJlUmVwbGFjZW1lbnQgJiYgbWF5YmVSZXBsYWNlbWVudEVhcmxpZXIpIHtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcudGltZS1pbmRpY2F0b3InKS50ZXh0Q29udGVudCA9IG5ldyBEYXRlKG1heWJlUmVwbGFjZW1lbnQudGltZSkudG9KU09OKCk7XG4gICAgaWRhdGEgPSBvdmVybGF5QnlEaWZmZXJlbmNlKFttYXliZVJlcGxhY2VtZW50LmRhdGEsIG1heWJlUmVwbGFjZW1lbnRFYXJsaWVyLmRhdGEsIGlkYXRhXSk7XG4gIH1cbiAgcmV0dXJuIGlkYXRhO1xufVxuXG4vLyBwaWNrIHRoZSBtb3N0IGRpc3NpbWlsYXJcblxuZnVuY3Rpb24gcmVxdWVzdERyYXcodixjLGJjLGN3LGNoKSB7XG4gIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZnVuY3Rpb24odGltZSkge1xuICAgIGRyYXcodixjLGJjLGN3LGNoLCB0aW1lKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGRyYXcodixjLGJjLGN3LGNoLCB0aW1lKSB7XG4gIGlmKHYucGF1c2VkIHx8IHYuZW5kZWQpIHJldHVybiBmYWxzZTtcbiAgLy8gRmlyc3QsIGRyYXcgaXQgaW50byB0aGUgYmFja2luZyBjYW52YXNcbiAgYmMuZHJhd0ltYWdlKHYsMCwwLGN3LGNoKTtcbiAgLy8gR3JhYiB0aGUgcGl4ZWwgZGF0YSBmcm9tIHRoZSBiYWNraW5nIGNhbnZhc1xuICB2YXIgaWRhdGEgPSBiYy5nZXRJbWFnZURhdGEoMCwwLGN3LGNoKTtcbiAgaWRhdGEgPSBtYXBwZXIoaWRhdGEpO1xuICAvLyBEcmF3IHRoZSBwaXhlbHMgb250byB0aGUgdmlzaWJsZSBjYW52YXNcbiAgYy5wdXRJbWFnZURhdGEoaWRhdGEsMCwwKTtcbiAgLy8gU3RhcnQgb3ZlciFcbiAgcmVxdWVzdERyYXcodixjLGJjLGN3LGNoKTtcbn1cbiJdfQ==
