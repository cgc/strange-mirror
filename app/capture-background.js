const userVideoToCanvas = require('./user-video-to-canvas');

let capture;
let resolve;

document.querySelector('.BackgroundCapture-capture').addEventListener('click', (e) => {
  e.preventDefault();
  capture = true;
});

const canvas = document.querySelector('.BackgroundCapture-canvas');

const vid = userVideoToCanvas.init({
  canvas: canvas,
  onframe: function() {
    if (capture) {
      resolve(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height));
      vid.close();
    }
  },
});

module.exports = new Promise((resolveArgument, reject) => {
  resolve = resolveArgument;
});
