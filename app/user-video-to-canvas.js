  navigator.getUserMedia =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia;

function noop() {}

exports.init = function(options) {
  if (!navigator.getUserMedia) {
    console.error("getUserMedia not supported");
    return;
  }

  const {canvas, onframe=noop, onready=noop} = options;
  const context = options.canvas.getContext('2d');

  let paused = false;
  let cw;
  let ch;
  let stream;

  const video = document.createElement('video');
  video.classList.add('hidden');
  document.body.appendChild(video);

  navigator.getUserMedia({ audio: false, video: true },
    function(streamArgument) {
      stream = streamArgument;
      video.src = window.URL.createObjectURL(stream);
      video.addEventListener('loadedmetadata', function(){
        video.play();
      });
      video.addEventListener('play', function(){
        cw = video.clientWidth;
        ch = video.clientHeight;
        canvas.width = cw;
        canvas.height = ch;
        onready();
        requestDraw();
      });
    }, function(error) {
      console.error(error);
    }
  );

  function requestDraw() {
    window.requestAnimationFrame(function(time) {
      draw(time);
    });
  }

  function draw(time) {
    if(video.paused || video.ended || paused) {
      return;
    }
    context.drawImage(video, 0, 0, cw, ch);
    onframe(video, canvas);
    requestDraw();
  }

  return {
    play() {
      paused = false;
      requestDraw();
    },
    pause() {
      paused = true;
    },
    close() {
      video.pause();
      URL.revokeObjectURL(video.src);
      stream.stop();
    }
  };
};
