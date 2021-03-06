const constant = require('lodash/constant');
const noop = require('lodash/noop');
const assert = require('assert');
const Rx = require('rx');
const Kefir = require('kefir');
const kefirBus = require('kefir-bus');

const kefirCast = require('..');

function testStreamForOneValue(stream, value, callback) {
  const s = kefirCast(Kefir, stream);
  let values = 0;
  s.onValue(x => {
    expect(x).toBe(value);
    values++;
  });
  s.onEnd(() => {
    expect(values).toBe(1);
    callback();
  });
}

function shouldNotBeCalled() {
  throw new Error('Should not be called');
}

describe('Bacon', () => {
  const BaconVersions = [
    ['v1', require('baconjs-v1')],
    ['v3', require('baconjs')]
  ];
  for (const [name, Bacon] of BaconVersions) {
    describe(name, () => {
      it('supports basic stream', done => {
        testStreamForOneValue(
          Bacon.later(0, shouldNotBeCalled),
          shouldNotBeCalled,
          done
        );
      });

      it('handles unsubscription', done => {
        let calls = 0;
        const s = kefirCast(
          Kefir,
          Bacon.fromPoll(0, () => {
            if (++calls === 1) {
              return 'beep';
            } else {
              throw new Error('Should not happen');
            }
          })
        );
        s.take(1).onEnd(done);
      });

      it('supports all event types', done => {
        const s = kefirCast(
          Kefir,
          Bacon.mergeAll(
            Bacon.later(0, 'beep'),
            Bacon.later(20, new Bacon.Error('bad')),
            Bacon.later(40, shouldNotBeCalled)
          ).toProperty('prop')
        );

        let calls = 0;
        s.onAny(event => {
          switch (++calls) {
            case 1:
              expect(event.type).toBe('value');
              expect(event.value).toBe('prop');
              break;
            case 2:
              expect(event.type).toBe('value');
              expect(event.value).toBe('beep');
              break;
            case 3:
              expect(event.type).toBe('error');
              expect(event.value).toBe('bad');
              break;
            case 4:
              expect(event.type).toBe('value');
              expect(event.value).toBe(shouldNotBeCalled);
              break;
            case 5:
              expect(event.type).toBe('end');
              done();
              break;
            default:
              throw new Error('Should not happen');
          }
        });
      });

      it('can listen on stream multiple times', done => {
        const bus = new Bacon.Bus();

        const s = kefirCast(Kefir, bus);

        let calls1 = 0,
          calls2 = 0;
        s.take(1).onAny(event => {
          switch (++calls1) {
            case 1:
              expect(event.type).toBe('value');
              expect(event.value).toBe(1);
              break;
            case 2:
              expect(event.type).toBe('end');

              s.onAny(event => {
                switch (++calls2) {
                  case 1:
                    expect(event.type).toBe('value');
                    expect(event.value).toBe(2);
                    break;
                  case 2:
                    expect(event.type).toBe('end');

                    setTimeout(() => {
                      s.onAny(event => {
                        expect(event.type).toBe('end');
                        done();
                      });
                    }, 0);

                    break;
                  default:
                    throw new Error('Should not happen');
                }
              });
              break;
            default:
              throw new Error('Should not happen');
          }
        });
        bus.push(1);
        bus.push(2);
        bus.end();
      });
    });
  }

  it('works on mock stream object', done => {
    let unsubbed = 0;
    const s = kefirCast(Kefir, {
      onValue: true,
      subscribe: sink => {
        sink({
          isInitial: true,
          isNext: false,
          isError: false,
          isEnd: false,
          value: 'prop',
          hasValue: true
        });
        setTimeout(() => {
          sink({
            isInitial: false,
            isNext: true,
            isError: false,
            isEnd: false,
            value: 'beep',
            hasValue: true
          });
          sink({
            isInitial: false,
            isNext: false,
            isError: true,
            isEnd: false,
            error: 'bad',
            hasValue: false
          });
          sink({
            isInitial: false,
            isNext: true,
            isError: false,
            isEnd: false,
            value: shouldNotBeCalled,
            hasValue: true
          });
          sink({
            isInitial: false,
            isNext: false,
            isError: false,
            isEnd: true,
            hasValue: false
          });
          sink({
            isInitial: false,
            isNext: true,
            isError: false,
            isEnd: false,
            value: () => {
              throw new Error('Post-end event should not be evaluated');
            },
            hasValue: true
          });
        }, 0);

        return () => {
          unsubbed++;
          sink = noop;
        };
      }
    });

    let calls = 0;
    s.onAny(event => {
      switch (++calls) {
        case 1:
          expect(event.type).toBe('value');
          expect(event.value).toBe('prop');
          break;
        case 2:
          expect(event.type).toBe('value');
          expect(event.value).toBe('beep');
          break;
        case 3:
          expect(event.type).toBe('error');
          expect(event.value).toBe('bad');
          break;
        case 4:
          expect(event.type).toBe('value');
          expect(event.value).toBe(shouldNotBeCalled);
          break;
        case 5:
          expect(event.type).toBe('end');
          setTimeout(() => {
            assert.strictEqual(unsubbed, 1);
            done();
          }, 1);
          break;
        default:
          throw new Error('Should not happen');
      }
    });
  });
});

describe('RxJS 4', () => {
  it('supports basic observable', done => {
    const s = kefirCast(Kefir, Rx.Observable.from(['beep', shouldNotBeCalled]));

    let calls = 0;
    s.onAny(event => {
      switch (++calls) {
        case 1:
          expect(event.type).toBe('value');
          expect(event.value).toBe('beep');
          break;
        case 2:
          expect(event.type).toBe('value');
          expect(event.value).toBe(shouldNotBeCalled);
          break;
        case 3:
          expect(event.type).toBe('end');
          done();
          break;
        default:
          throw new Error('Should not happen');
      }
    });
  });

  it('handles unsubscription', done => {
    let calls = 0;
    const s = kefirCast(
      Kefir,
      Rx.Observable.interval(0).map(() => {
        if (++calls === 1) {
          return 'beep';
        } else {
          process.nextTick(() => {
            throw new Error('Unsubscription failed');
          });
        }
      })
    );
    s.take(1).onEnd(done);
  });

  it('supports observable with error', done => {
    const err = new Error('some err');
    const s = kefirCast(
      Kefir,
      Rx.Observable.from(['beep', shouldNotBeCalled]).concat(
        Rx.Observable.throw(err)
      )
    );

    let calls = 0;
    s.onAny(event => {
      switch (++calls) {
        case 1:
          expect(event.type).toBe('value');
          expect(event.value).toBe('beep');
          break;
        case 2:
          expect(event.type).toBe('value');
          expect(event.value).toBe(shouldNotBeCalled);
          break;
        case 3:
          expect(event.type).toBe('error');
          expect(event.value).toBe(err);
          break;
        case 4:
          expect(event.type).toBe('end');
          done();
          break;
        default:
          throw new Error('Should not happen');
      }
    });
  });

  it('can listen on stream multiple times', done => {
    const subject = new Rx.Subject();

    const s = kefirCast(Kefir, subject);

    let calls1 = 0,
      calls2 = 0;
    s.take(1).onAny(event => {
      switch (++calls1) {
        case 1:
          expect(event.type).toBe('value');
          expect(event.value).toBe(1);
          break;
        case 2:
          expect(event.type).toBe('end');

          s.onAny(event => {
            switch (++calls2) {
              case 1:
                expect(event.type).toBe('value');
                expect(event.value).toBe(2);
                break;
              case 2:
                expect(event.type).toBe('end');

                setTimeout(() => {
                  s.onAny(event => {
                    expect(event.type).toBe('end');
                    done();
                  });
                }, 0);

                break;
              default:
                throw new Error('Should not happen');
            }
          });
          break;
        default:
          throw new Error('Should not happen');
      }
    });
    subject.onNext(1);
    subject.onNext(2);
    subject.onCompleted();
  });
});

describe('RxJS 6', () => {
  // Shadow this name to let us know if we accidentally use Rx 4 in this test.
  // eslint-disable-next-line no-unused-vars
  const Rx = null;

  const { from, interval, concat, throwError, Subject } = require('rxjs');
  const { map } = require('rxjs/operators');

  it('supports basic observable', done => {
    const s = kefirCast(Kefir, from(['beep', shouldNotBeCalled]));

    let calls = 0;
    s.onAny(event => {
      switch (++calls) {
        case 1:
          expect(event.type).toBe('value');
          expect(event.value).toBe('beep');
          break;
        case 2:
          expect(event.type).toBe('value');
          expect(event.value).toBe(shouldNotBeCalled);
          break;
        case 3:
          expect(event.type).toBe('end');
          done();
          break;
        default:
          throw new Error('Should not happen');
      }
    });
  });

  it('handles unsubscription', done => {
    let calls = 0;
    const s = kefirCast(
      Kefir,
      map.call(interval(0), () => {
        if (++calls === 1) {
          return 'beep';
        } else {
          process.nextTick(() => {
            throw new Error('Unsubscription failed');
          });
        }
      })
    );
    s.take(1).onEnd(done);
  });

  it('supports observable with error', done => {
    const err = new Error('some err');
    const s = kefirCast(
      Kefir,
      concat(from(['beep', shouldNotBeCalled]), throwError(err))
    );

    let calls = 0;
    s.onAny(event => {
      switch (++calls) {
        case 1:
          expect(event.type).toBe('value');
          expect(event.value).toBe('beep');
          break;
        case 2:
          expect(event.type).toBe('value');
          expect(event.value).toBe(shouldNotBeCalled);
          break;
        case 3:
          expect(event.type).toBe('error');
          expect(event.value).toBe(err);
          break;
        case 4:
          expect(event.type).toBe('end');
          done();
          break;
        default:
          throw new Error('Should not happen');
      }
    });
  });

  it('can listen on stream multiple times', done => {
    const subject = new Subject();

    const s = kefirCast(Kefir, subject);

    let calls1 = 0,
      calls2 = 0;
    s.take(1).onAny(event => {
      switch (++calls1) {
        case 1:
          expect(event.type).toBe('value');
          expect(event.value).toBe(1);
          break;
        case 2:
          expect(event.type).toBe('end');

          s.onAny(event => {
            switch (++calls2) {
              case 1:
                expect(event.type).toBe('value');
                expect(event.value).toBe(2);
                break;
              case 2:
                expect(event.type).toBe('end');

                setTimeout(() => {
                  s.onAny(event => {
                    expect(event.type).toBe('end');
                    done();
                  });
                }, 0);

                break;
              default:
                throw new Error('Should not happen');
            }
          });
          break;
        default:
          throw new Error('Should not happen');
      }
    });
    subject.next(1);
    subject.next(2);
    subject.complete();
  });
});

describe('Kefir', () => {
  it('supports basic stream', done => {
    testStreamForOneValue(
      Kefir.later(0, shouldNotBeCalled),
      shouldNotBeCalled,
      done
    );
  });

  it('handles unsubscription', done => {
    let calls = 0;
    const s = kefirCast(
      Kefir,
      Kefir.fromPoll(0, () => {
        if (++calls === 1) {
          return 'beep';
        } else {
          throw new Error('Should not happen');
        }
      })
    );
    s.take(1).onEnd(done);
  });

  it('supports all event types', done => {
    const s = kefirCast(
      Kefir,
      Kefir.merge([
        Kefir.later(0, 'beep'),
        Kefir.later(20, 'bad').flatMap(Kefir.constantError),
        Kefir.later(40, shouldNotBeCalled)
      ]).toProperty(constant('prop'))
    );

    let calls = 0;
    s.onAny(event => {
      switch (++calls) {
        case 1:
          expect(event.type).toBe('value');
          expect(event.value).toBe('prop');
          break;
        case 2:
          expect(event.type).toBe('value');
          expect(event.value).toBe('beep');
          break;
        case 3:
          expect(event.type).toBe('error');
          expect(event.value).toBe('bad');
          break;
        case 4:
          expect(event.type).toBe('value');
          expect(event.value).toBe(shouldNotBeCalled);
          break;
        case 5:
          expect(event.type).toBe('end');
          done();
          break;
        default:
          throw new Error('Should not happen');
      }
    });
  });

  it('can listen on stream multiple times', done => {
    const bus = kefirBus();

    const s = kefirCast(Kefir, bus);

    let calls1 = 0,
      calls2 = 0;
    s.take(1).onAny(event => {
      switch (++calls1) {
        case 1:
          expect(event.type).toBe('value');
          expect(event.value).toBe(1);
          break;
        case 2:
          expect(event.type).toBe('end');

          s.onAny(event => {
            switch (++calls2) {
              case 1:
                expect(event.type).toBe('value');
                expect(event.value).toBe(2);
                break;
              case 2:
                expect(event.type).toBe('end');

                setTimeout(() => {
                  s.onAny(event => {
                    expect(event.type).toBe('end');
                    done();
                  });
                }, 0);

                break;
              default:
                throw new Error('Should not happen');
            }
          });
          break;
        default:
          throw new Error('Should not happen');
      }
    });
    bus.emit(1);
    bus.emit(2);
    bus.end();
  });
});

describe('Constant', () => {
  it('transforms non-streams to single-item streams', done => {
    const value = { a: 5 };
    testStreamForOneValue(value, value, done);
  });
});
