var _ = require('underscore');
var Heap = require('heap');

function GMM(options) {
  // from http://www.cs.utexas.edu/~grauman/courses/fall2009/slides/lecture9_background.pdf
  options = options || {};

  this.gaussians = new Heap(function(a, b) {
    return this._backgroundGaussianMetric(a) - this._backgroundGaussianMetric(b);
  }.bind(this));
  this.matchThreshold = 2.5;
  this.alpha = options.alpha || 1/50;
  this.K = options.K || 5;
  this.T = options.T || this.alpha / 10;
}

GMM.prototype = {
  isBackground: function(value) {
    var sorted = this.gaussians.nodes;

    var total = 0;
    // since gaussian nodes are in ascending order, we should process in reverse.
    for (var i = sorted.length - 1; i >= 0; i--) {
      var gaussian = sorted[i];
      if (total > this.T) {
        break;
      }
      total += gaussian.omega;
      if (this._gaussianValueMatch(gaussian, value)) {
        return true;
      }
    }
    return false;
  },
  update: function(value) {
    var matched;
    var sorted = this.gaussians.nodes;
    // since gaussian nodes are in ascending order, we should process in reverse.
    for (var i = sorted.length - 1; i >= 0; i--) {
      var gaussian = sorted[i];
      if (this._gaussianValueMatch(gaussian, value)) {
        matched = gaussian;
        break;
      }
    }

    if (matched) {
      // Since _updateGaussian negatively affects all elements besides the matched value
      // we might only need to update the place of the matched item?
      this._updateGaussian(matched, value);
      this.gaussians.updateItem(matched);
    } else {
      this._newDistribution(value);
    }
  },
  _newDistribution: function(value) {
    var instance;

    // reusing instances as a performance optimization.
    if (this.gaussians.size() >= this.K) {
      instance = this.gaussians.pop();
    } else {
      instance = {};
    }

    instance.mu = value;
    // should sigmaSquared be a parameter? what's a good value for this?
    instance.sigmaSquared = Math.pow(8, 2);
    instance.omega = this.alpha;
    this.gaussians.push(instance);
  },
  _normalDistribution: function(gaussian, value) {
    return Math.exp(-1 * Math.pow(value - gaussian.mu, 2) / (2 * gaussian.sigmaSquared)) /
      Math.sqrt(2 * Math.PI * gaussian.sigmaSquared);
  },
  _updateGaussian: function(gaussian, newValue) {
    var rho = this.alpha * this._normalDistribution(gaussian, newValue);
    gaussian.mu = (1 - rho) * gaussian.mu + rho * newValue;
    gaussian.sigmaSquared = (1 - rho) * gaussian.sigmaSquared +
      rho * Math.pow(newValue - gaussian.mu, 2);
    var gaussians = this.gaussians.nodes;
    for (var i = 0; i < gaussians.length; i++) {
      var g = gaussians[i];
      var M = g === gaussian ? 1 : 0;
      g.omega = (1 - this.alpha) * g.omega + this.alpha * M;
    }
  },
  _gaussianValueMatch: function(gaussian, value) {
    var sigma = Math.sqrt(gaussian.sigmaSquared);
    return gaussian.mu - this.matchThreshold * sigma <= value &&
      value <= gaussian.mu + this.matchThreshold * sigma;
  },
  _backgroundGaussianMetric: function(gaussian) {
    return gaussian.omega / Math.sqrt(gaussian.sigmaSquared);
  }
};

module.exports = GMM;
