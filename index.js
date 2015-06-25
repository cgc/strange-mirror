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
  var maybeReplacement = findImage(new Date().getTime() - 30 * 1000);
  // Loop through the subpixels, convoluting each using an edge-detection matrix.
  //for(var i = 0; i < limit; i++) {
  //  if( i%4 == 3 ) continue;
  //  data[i] = 127 + 2*data[i] - data[i + 4] - data[i + w*4];
  //}
  if (maybeReplacement) {
    document.querySelector('.time-indicator').textContent = new Date(maybeReplacement.time).toJSON();
    idata = overlayByAverage(maybeReplacement.data, idata);
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
