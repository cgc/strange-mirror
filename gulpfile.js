var gulp = require('gulp');
var browserify = require('browserify');
var gutil = require('gulp-util');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var express = require('express');
var serveStatic = require('serve-static');
var morgan = require('morgan');

gulp.task('build', function() {
  // set up the browserify instance on a task basis
  var b = browserify({
    entries: './index.js',
    debug: true,
    // defining transforms here will avoid crashing your stream
    transform: []
  });

  return b.bundle()
    .pipe(source('index.js'))
    .pipe(buffer())
    //.pipe(sourcemaps.init({loadMaps: true}))
    .on('error', gutil.log)
    //.pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./dist'));
});

gulp.task('dev', ['build'], function() {
  var app = express();
  app.use(morgan('combined'));
  app.use(serveStatic(__dirname));
  app.listen(8078);
});
