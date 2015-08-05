var _ = require('underscore');

function GMM(options) {
  // from http://www.cs.utexas.edu/~grauman/courses/fall2009/slides/lecture9_background.pdf
  options = options || {};

  this.gaussians = [];
  this.matchThreshold = 2.5;
  this.alpha = options.alpha || 1/50;
  this.K = options.K || 5;
  this.T = options.T || this.alpha / 10;
}

GMM.prototype = {
  isBackground: function(value) {
    // XXX remove need to sort by keeping list sorted when modifying it
    var sorted = _.sortBy(this.gaussians, function(gaussian) {
      // -1 for descending sort.
      return -1 * this._backgroundGaussianMetric(gaussian);
    }.bind(this));

    var total = 0;
    for (var i = 0; i < sorted.length; i++) {
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
    var matched = _.find(this.gaussians, function(gaussian) {
      return this._gaussianValueMatch(gaussian, value);
    }.bind(this));

    if (matched) {
      this._updateGaussian(matched, value);
    } else {
      if (this.gaussians.length >= this.K) {
        var leastProbablyBackground = _.min(this.gaussians, function(gaussian) {
          return this._backgroundGaussianMetric(gaussian);
        }.bind(this));
        this.gaussians = _.without(this.gaussians, leastProbablyBackground);
      }
      this._newDistribution(value);
    }
  },
  _newDistribution: function(value) {
    this.gaussians.push({
      mu: value,
      // should sigmaSquared be a parameter? what's a good value for this?
      sigmaSquared: Math.pow(8, 2),
      omega: this.alpha
    });
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
    for (var i = 0; i < this.gaussians.length; i++) {
      var g = this.gaussians[i];
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
