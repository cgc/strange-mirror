var GMM = require('../gaussian-mixture-model');
var assert = require('assert');

describe('the gaussian mixture model', function() {
  it('should learn', function() {
    var model = new GMM();
    for (var i = 0; i < 400; i++) {
      model.update(100);
    }
    assert(!model.isBackground(50));
    assert(model.isBackground(100));
    assert(!model.isBackground(200));

    for (var i = 0; i < 100; i++) {
      model.update(50);
    }
    for (var i = 0; i < 20; i++) {
      model.update(200);
    }
    assert(model.isBackground(50));
    assert(!model.isBackground(100));
    assert(!model.isBackground(200));
  });
});
