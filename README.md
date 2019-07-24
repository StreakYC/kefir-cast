# KefirCast

[![Circle CI](https://circleci.com/gh/StreakYC/kefir-cast.svg?style=shield)](https://circleci.com/gh/StreakYC/kefir-cast)
[![npm version](https://badge.fury.io/js/kefir-cast.svg)](https://badge.fury.io/js/kefir-cast)

Converts various types of streams to Kefir streams. This is intended for use
by libraries which use Kefir internally, but want to be able to accept streams
from other libraries or other versions of Kefir as arguments given by the
application.

- Supports converting RxJS (v2-v5) Observables into Kefir streams.
- Supports converting Bacon.js streams into Kefir streams.
- Supports converting a Kefir stream created by one instance of the Kefir
  library into a stream usable by a different instance of a Kefir library.
  (This smooths over possible issues if the application uses a different
  version of Kefir.)
- Casts non-streams into a Kefir stream of one item by using Kefir.constant().

KefirCast is intended for use in nodejs and in browsers via CommonJS bundlers
like Browserify. This project is in NPM and can be installed with

    npm install kefir-cast

The related project [BaconCast](https://github.com/StreakYC/bacon-cast) exists
to convert streams to Bacon.js streams.

## Example

Suppose you have a library that exports a single function `doStuff`, which can
take a stream as an argument. By using KefirCast, you can support any RxJS
streams, Kefir streams, Bacon.js streams, or constants that your users might
pass to you.

```javascript
var Kefir = require('kefir');
var kefirCast = require('kefir-cast');

module.exports = function doStuff(input) {
  var inputStream = kefirCast(Kefir, input);
  // Log anything that comes through the stream for 5 seconds.
  inputStream.takeUntilBy(Kefir.later(5000)).onValue(function(value) {
    console.log('doStuff received value', value);
  });
};
```

If you did not use KefirCast, then your users would be required to use the same
version of Kefir as you, you wouldn't support RxJS or Bacon streams without
more work, and you would have to handle non-stream constant values specially.

## API

`kefirCast(Kefir, input)` takes your Kefir library instance as the first
argument, and the input stream or constant to convert into a Kefir stream as
the second argument. A Kefir stream compatible with the given Kefir library
will be returned.

## Types

[Flow](https://flowtype.org/) type declarations for this module are included!
If you are using Flow, they won't require any configuration to use.
