'use strict';

var constant = require('lodash/utility/constant');
var noop = require('lodash/utility/noop');
var assert = require('assert');
var Bacon = require('baconjs');
var Rx = require('rx');
var Kefir = require('kefir');
var kefirBus = require('kefir-bus');

var kefirCast = require('..');

function testStreamForOneValue(stream, value, callback) {
  var s = kefirCast(Kefir, stream);
  var values = 0;
  s.onValue(function(x) {
    assert.strictEqual(x, value);
    values++;
  });
  s.onEnd(function() {
    assert.strictEqual(values, 1);
    callback();
  });
}

function shouldNotBeCalled() {
  throw new Error("Should not be called");
}

describe('kefirCast', function() {
  describe('Bacon', function() {
    it('supports basic stream', function(done) {
      testStreamForOneValue(Bacon.later(0, shouldNotBeCalled), shouldNotBeCalled, done);
    });

    it('handles unsubscription', function(done) {
      var calls = 0;
      var s = kefirCast(Kefir, Bacon.fromPoll(0, function() {
        if (++calls === 1) {
          return 'beep';
        } else {
          throw new Error("Should not happen");
        }
      }));
      s.take(1).onEnd(done);
    });

    it('supports all event types', function(done) {
      var s = kefirCast(Kefir, Bacon.mergeAll(
        Bacon.later(0, 'beep'),
        Bacon.later(1, new Bacon.Error('bad')),
        Bacon.later(2, shouldNotBeCalled)
      ).toProperty('prop'));

      var calls = 0;
      s.onAny(function(event) {
        switch(++calls) {
          case 1:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, 'prop');
            break;
          case 2:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, 'beep');
            break;
          case 3:
            assert.strictEqual(event.type, 'error');
            assert.strictEqual(event.value, 'bad');
            break;
          case 4:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, shouldNotBeCalled);
            break;
          case 5:
            assert.strictEqual(event.type, 'end');
            done();
            break;
          default:
            throw new Error("Should not happen");
        }
      });
    });

    it('works on mock stream object', function(done) {
      var unsubbed = 0;
      var s = kefirCast(Kefir, {
        onValue: true,
        subscribe: function(sink) {
          sink({
            isInitial: constant(true), isNext: constant(false),
            isError: constant(false), isEnd: constant(false),
            value: constant('prop'), hasValue: constant(true)
          });
          setTimeout(function() {
            sink({
              isInitial: constant(false), isNext: constant(true),
              isError: constant(false), isEnd: constant(false),
              value: constant('beep'), hasValue: constant(true)
            });
            sink({
              isInitial: constant(false), isNext: constant(false),
              isError: constant(true), isEnd: constant(false),
              error: 'bad', hasValue: constant(false)
            });
            sink({
              isInitial: constant(false), isNext: constant(true),
              isError: constant(false), isEnd: constant(false),
              value: constant(shouldNotBeCalled), hasValue: constant(true)
            });
            sink({
              isInitial: constant(false), isNext: constant(false),
              isError: constant(false), isEnd: constant(true),
              hasValue: constant(false)
            });
            sink({
              isInitial: constant(false), isNext: constant(true),
              isError: constant(false), isEnd: constant(false),
              value: function() {
                throw new Error("Post-end event should not be evaluated");
              }, hasValue: constant(true)
            });
          }, 0);

          return function() {
            unsubbed++;
            sink = noop;
          };
        }
      });

      var calls = 0;
      s.onAny(function(event) {
        switch(++calls) {
          case 1:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, 'prop');
            break;
          case 2:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, 'beep');
            break;
          case 3:
            assert.strictEqual(event.type, 'error');
            assert.strictEqual(event.value, 'bad');
            break;
          case 4:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, shouldNotBeCalled);
            break;
          case 5:
            assert.strictEqual(event.type, 'end');
            setTimeout(function() {
              assert.strictEqual(unsubbed, 1);
              done();
            }, 1);
            break;
          default:
            throw new Error("Should not happen");
        }
      });
    });

    it('can listen on stream multiple times', function(done) {
      var bus = new Bacon.Bus();

      var s = kefirCast(Kefir, bus);

      var calls1 = 0, calls2 = 0;
      s.take(1).onAny(function(event) {
        switch (++calls1) {
          case 1:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, 1);
            break;
          case 2:
            assert.strictEqual(event.type, 'end');

            s.onAny(function(event) {
              switch (++calls2) {
                case 1:
                  assert.strictEqual(event.type, 'value');
                  assert.strictEqual(event.value, 2);
                  break;
                case 2:
                  assert.strictEqual(event.type, 'end');

                  setTimeout(function() {
                    s.onAny(function(event) {
                      assert.strictEqual(event.type, 'end');
                      done();
                    });
                  }, 0);

                  break;
                default:
                  throw new Error("Should not happen");
              }
            });
            break;
          default:
            throw new Error("Should not happen");
        }
      });
      bus.push(1);
      bus.push(2);
      bus.end();
    });
  });

  describe('RxJS', function() {
    it('supports basic observable', function(done) {
      var s = kefirCast(Kefir, Rx.Observable.fromArray([
        'beep',
        shouldNotBeCalled
      ]));

      var calls = 0;
      s.onAny(function(event) {
        switch(++calls) {
          case 1:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, 'beep');
            break;
          case 2:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, shouldNotBeCalled);
            break;
          case 3:
            assert.strictEqual(event.type, 'end');
            done();
            break;
          default:
            throw new Error("Should not happen");
        }
      });
    });

    it('handles unsubscription', function(done) {
      var calls = 0;
      var s = kefirCast(Kefir, Rx.Observable.interval(0).map(function() {
        if (++calls === 1) {
          return 'beep';
        } else {
          process.nextTick(function() {
            throw new Error("Unsubscription failed");
          });
        }
      }));
      s.take(1).onEnd(done);
    });

    it('supports observable with error', function(done) {
      var err = new Error('some err');
      var s = kefirCast(Kefir, Rx.Observable.fromArray([
        'beep',
        shouldNotBeCalled
      ]).concat(Rx.Observable.throw(err)));

      var calls = 0;
      s.onAny(function(event) {
        switch(++calls) {
          case 1:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, 'beep');
            break;
          case 2:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, shouldNotBeCalled);
            break;
          case 3:
            assert.strictEqual(event.type, 'error');
            assert.strictEqual(event.value, err);
            break;
          case 4:
            assert.strictEqual(event.type, 'end');
            done();
            break;
          default:
            throw new Error("Should not happen");
        }
      });
    });

    it('can listen on stream multiple times', function(done) {
      var subject = new Rx.Subject();

      var s = kefirCast(Kefir, subject);

      var calls1 = 0, calls2 = 0;
      s.take(1).onAny(function(event) {
        switch (++calls1) {
          case 1:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, 1);
            break;
          case 2:
            assert.strictEqual(event.type, 'end');

            s.onAny(function(event) {
              switch (++calls2) {
                case 1:
                  assert.strictEqual(event.type, 'value');
                  assert.strictEqual(event.value, 2);
                  break;
                case 2:
                  assert.strictEqual(event.type, 'end');

                  setTimeout(function() {
                    s.onAny(function(event) {
                      assert.strictEqual(event.type, 'end');
                      done();
                    });
                  }, 0);

                  break;
                default:
                  throw new Error("Should not happen");
              }
            });
            break;
          default:
            throw new Error("Should not happen");
        }
      });
      subject.onNext(1);
      subject.onNext(2);
      subject.onCompleted();
    });
  });

  describe('Kefir', function() {
    it('supports basic stream', function(done) {
      testStreamForOneValue(Kefir.later(0, shouldNotBeCalled), shouldNotBeCalled, done);
    });

    it('handles unsubscription', function(done) {
      var calls = 0;
      var s = kefirCast(Kefir, Kefir.fromPoll(0, function() {
        if (++calls === 1) {
          return 'beep';
        } else {
          throw new Error("Should not happen");
        }
      }));
      s.take(1).onEnd(done);
    });

    it('supports all event types', function(done) {
      var s = kefirCast(Kefir, Kefir.merge([
        Kefir.later(0, 'beep'),
        Kefir.later(1, 'bad').flatMap(Kefir.constantError),
        Kefir.later(2, shouldNotBeCalled)
      ]).toProperty(constant('prop')));

      var calls = 0;
      s.onAny(function(event) {
        switch(++calls) {
          case 1:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, 'prop');
            break;
          case 2:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, 'beep');
            break;
          case 3:
            assert.strictEqual(event.type, 'error');
            assert.strictEqual(event.value, 'bad');
            break;
          case 4:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, shouldNotBeCalled);
            break;
          case 5:
            assert.strictEqual(event.type, 'end');
            done();
            break;
          default:
            throw new Error("Should not happen");
        }
      });
    });

    it('can listen on stream multiple times', function(done) {
      var bus = kefirBus();

      var s = kefirCast(Kefir, bus);

      var calls1 = 0, calls2 = 0;
      s.take(1).onAny(function(event) {
        switch (++calls1) {
          case 1:
            assert.strictEqual(event.type, 'value');
            assert.strictEqual(event.value, 1);
            break;
          case 2:
            assert.strictEqual(event.type, 'end');

            s.onAny(function(event) {
              switch (++calls2) {
                case 1:
                  assert.strictEqual(event.type, 'value');
                  assert.strictEqual(event.value, 2);
                  break;
                case 2:
                  assert.strictEqual(event.type, 'end');

                  setTimeout(function() {
                    s.onAny(function(event) {
                      assert.strictEqual(event.type, 'end');
                      done();
                    });
                  }, 0);

                  break;
                default:
                  throw new Error("Should not happen");
              }
            });
            break;
          default:
            throw new Error("Should not happen");
        }
      });
      bus.emit(1);
      bus.emit(2);
      bus.end();
    });
  });

  describe('Constant', function() {
    it('transforms non-streams to single-item streams', function(done) {
      var value = {a: 5};
      testStreamForOneValue(value, value, done);
    });
  });
});
