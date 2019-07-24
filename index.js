'use strict';

function kefirCast(Kefir, input) {
  if (input && input.subscribe && input.subscribeOnNext) {
    // RxJS <= 4
    return Kefir.stream(function(emitter) {
      var subscription = input.subscribe(
        function onNext(value) {
          emitter.emit(value);
        },
        function onError(err) {
          emitter.error(err);
          emitter.end();
        },
        function onCompleted() {
          emitter.end();
        }
      );
      return function() {
        subscription.dispose();
      };
    });
  } else if (input && input.onAny && input.offAny) {
    // Kefir
    return Kefir.stream(function(emitter) {
      function listener(event) {
        switch (event.type) {
          case 'value':
            emitter.emit(event.value);
            break;
          case 'error':
            emitter.error(event.value);
            break;
          case 'end':
            emitter.end();
            break;
          default:
            // eslint-disable-next-line no-console
            console.error('Unknown type of Kefir event', event);
        }
      }
      input.onAny(listener);
      return function() {
        input.offAny(listener);
      };
    });
  } else if (input && input.subscribe && input.onValue) {
    // Bacon
    return Kefir.stream(function(emitter) {
      return input.subscribe(function(event) {
        if (typeof event.hasValue === 'function') {
          // Bacon v1
          if (event.hasValue()) {
            emitter.emit(event.value());
          } else if (event.isEnd()) {
            emitter.end();
          } else if (event.isError()) {
            emitter.error(event.error);
          } else {
            // eslint-disable-next-line no-console
            console.error('Unknown type of Bacon event', event);
          }
        } else {
          // Bacon 2+
          if (event.hasValue) {
            emitter.emit(event.value);
          } else if (event.isEnd) {
            emitter.end();
          } else if (event.isError) {
            emitter.error(event.error);
          } else {
            // eslint-disable-next-line no-console
            console.error('Unknown type of Bacon event', event);
          }
        }
      });
    });
  } else if (input && input.subscribe && input.lift) {
    // RxJS 5
    return Kefir.stream(function(emitter) {
      var subscription = input.subscribe(
        function onNext(value) {
          emitter.emit(value);
        },
        function onError(err) {
          emitter.error(err);
          emitter.end();
        },
        function onCompleted() {
          emitter.end();
        }
      );
      return function() {
        subscription.unsubscribe();
      };
    });
  } else {
    return Kefir.constant(input);
  }
}

module.exports = kefirCast;
