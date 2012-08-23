node-benchmark-pages
====================

A library for benchmarking your web service.

Suppose you want to measure the average response time of your service under a typical load scenario.
This library allows you to declare such a scenario (in terms of pages and their frequency) and then measure their average response time under a different loads (different simultaneous requests limits).
Various statistical methods are available for the raw measurements data; the library may also output the statistical data into the console in the convenient form if you like.

Another use case is when you have more than one version of the same service and want to compare their response time or maximum load.

# Examples

See the [example](https://github.com/penartur/node-benchmark-pages/tree/master/example) directory.

# Installation

```bash
$ npm install benchmark-pages
```

# Notes

It makes little sense to measure the remote services, as the result will generally depend of your network connection and not of your service performance.

Also, the library assumes service responses are consistent.
That is, it assumes that, for any given engine and page, the response length will not change over the time.
If suddenly your service sent a response of a different length, the library assumes something went wrong, writes an error into your console, and does not use this data when computing statistics.

Currently, you're only limited to a single running benchmark per process.
It is related to a global `http.globalAgent.maxSockets` variable.

# License

(The MIT License)

Copyright (C) 2012 penartur <https://github.com/penartur/>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
