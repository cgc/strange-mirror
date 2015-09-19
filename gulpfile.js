var gulp = require('gulp');
var browserify = require('browserify');
var watchify = require('watchify');
var babelify = require('babelify');
var gutil = require('gulp-util');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var express = require('express');
var serveStatic = require('serve-static');
var morgan = require('morgan');
var _ = require('lodash');

function bundle(file, watch) {
  var props = _.assign({
    entries: file,
    debug: true,
    // defining transforms here will avoid crashing your stream
    transform: ['babelify']
  }, watchify.args);

  var bundler = watch ? watchify(browserify(props)) : browserify(props);

  function rebundle() {
    return bundler.bundle()
      .on('error', gutil.log)
      .pipe(source(file))
      //.pipe(buffer())
      //.pipe(sourcemaps.init({loadMaps: true}))
      //.on('error', gutil.log)
      //.pipe(sourcemaps.write('./'))
      .pipe(gulp.dest('./dist'));
  }

  bundler.on('update', function(ids) {
    ids.forEach(function(id) {
      gutil.log(gutil.colors.cyan(id), 'changed');
    });
    gutil.log('Rebundling...');
    rebundle();
  });

  bundler.on('log', function(msg) {
    gutil.log(msg);
  });

  return rebundle();
}

gulp.task('build:watch', function() {
  bundle('./app/index.js', true);
});

gulp.task('dev', ['build:watch'], function() {
  var app = express();
  app.use(morgan('combined'));
  app.use(serveStatic(__dirname));
  app.listen(8078);
});
