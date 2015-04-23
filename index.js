function kefirCast(Kefir, input) {
  if (input && input.subscribe && input.subscribeOnNext) { // RxJS
    return Kefir.stream(function(emitter) {
      var subscription = input.subscribe(function onNext(value) {
        emitter.emit(value);
      }, function onError(err) {
        emitter.error(err);
        emitter.end();
      }, function onCompleted() {
        emitter.end();
      });
      return subscription.dispose.bind(subscription);
    });
  } else if (input && input.onAny && input.offAny) { // Kefir
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
            console.error("Unknown type of Kefir event", event);
        }
      }
      input.onAny(listener);
      return input.offAny.bind(input, listener);
    });
  } else if (input && input.subscribe && input.onValue) { // Bacon
    return Kefir.stream(function(emitter) {
      return input.subscribe(function(event) {
        if (event.hasValue()) {
          emitter.emit(event.value());
        } else if (event.isEnd()) {
          emitter.end();
        } else if (event.isError()) {
          emitter.error(event.error);
        } else {
          console.error("Unknown type of Bacon event", event);
        }
      });
    });
  } else {
    return Kefir.constant(input);
  }
}

module.exports = kefirCast;
