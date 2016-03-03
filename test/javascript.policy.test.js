'use strict';
const javascriptPolicy = require('../policies/javascript')();
const should           = require('should');
const bunyan           = require('bunyan');

describe('javascript policy', function() {
  describe('access context', function() {
    // read/access context
    it('should be able to read a property in the context', function(done) {
      var context = {request:
                          {uri: 'http://localhost/foo'}
                     };
      var code = `if (request.uri === undefined ||
                    request.uri !== "http://localhost/foo") {
                    throw {name:'PropertyNotFound'};
                  }`;
      var flow = {
        'proceed': () => {
          done();
        },
        'fail': (error) => {
          throw new Error('failed');
        },
        'logger': bunyan.createLogger(
            {
              name:'flow-engine',
              stream: process.stdout,
              level: 'debug'
          })
      };
      javascriptPolicy({source: code}, context, flow);
    });

    // update properties in context
    it('should be able to update a property in the context', function(done) {
      var context = {request:
                          {uri: 'http://localhost/foo'},
                      myval: 1
                     };
      var code = `request.uri = 'http://localhost/bar';
                  myval = 'myvalue';
        `;

      var flow = {
          'proceed': () => {
            context.request.uri.should.exactly('http://localhost/bar');
            context.myval.should.exactly('myvalue');
            done();
          },
          'fail': (error) => {
            throw new Error('failed');
          },
          'logger': bunyan.createLogger(
              {
                name:'flow-engine',
                stream: process.stdout,
                level: 'debug'
            })
        };
      console.error('context.myval:', context.myval);
      javascriptPolicy({source: code}, context, flow);
    });

    // delete properties in context
    it('should be able to delete a property in the context', function(done) {
      var context = {request:
                          {uri: 'http://localhost/foo'}
                     };
      var code = `delete request.uri;`;

      var flow = {
          'proceed': () => {
            should(context.request.uri).be.a.Undefined();
            done();
          },
          'fail': (error) => {
            throw new Error('failed');
          },
          'logger': bunyan.createLogger(
              {
                name:'flow-engine',
                stream: process.stdout,
                level: 'debug'
            })
        };
      javascriptPolicy({source: code}, context, flow);
    });

    // local variable won't be added into context
    it('should not pollute context with local variable', function(done) {
      var context = {request:
                          {uri: 'http://localhost/foo'}
                     };
      var code = `var a = 'localvar'; a = request.uri;`;

      var flow = {
          'proceed': () => {
            should(context.a).be.a.Undefined();
            done();
          },
          'fail': (error) => {
            throw new Error('failed');
          },
          'logger': bunyan.createLogger(
              {
                name:'flow-engine',
                stream: process.stdout,
                level: 'debug'
            })
        };
      javascriptPolicy({source: code}, context, flow);
    });

  });

  describe('verify capabilities', function() {
    // create/call a function
    it('should be able to add/call function', function(done) {
      var context = {request:
                          {uri: 'http://localhost/foo'}
                     };
      var code = `function fool(bar) {
          return bar+'xxx';
        }
        request.uri = fool('http://localhost/');
        `;

      var flow = {
          'proceed': () => {
            context.request.uri.should.exactly('http://localhost/xxx');
            done();
          },
          'fail': (error) => {
            throw new Error('failed');
          },
          'logger': bunyan.createLogger(
              {
                name:'flow-engine',
                stream: process.stdout,
                level: 'debug'
            })
        };
      javascriptPolicy({source: code}, context, flow);
    });

    // use global functions
    it('should be able to use parseInt()', function(done) {
      var context = {request:
                          {uri: 'http://localhost/foo'},
                     myval : '1'
                     };
      var code = `myval = parseInt(myval);`;

      var flow = {
          'proceed': () => {
            should(context.myval).exactly(1).and.be.a.Number();
            done();
          },
          'fail': (error) => {
            throw new Error('failed');
          },
          'logger': bunyan.createLogger(
              {
                name:'flow-engine',
                stream: process.stdout,
                level: 'debug'
            })
        };

      javascriptPolicy({source: code}, context, flow);
    });

    // use JSON.stringify functions
    it('should be able to use JSON.stringify()', function(done) {
      var context = {request:
                          {uri: 'http://localhost/foo'},
                     myval: '1'
                     };
      var code = `myval = JSON.stringify({ 'a': 'a', 'b':'b'});`;

      var flow = {
          'proceed': () => {
            should(context['myval']).
                exactly(JSON.stringify({ 'a': 'a', 'b':'b'})).
                and.be.a.String();
            done();
          },
          'fail': (error) => {
            throw new Error('failed');
          },
          'logger': bunyan.createLogger(
              {
                name:'flow-engine',
                stream: process.stdout,
                level: 'debug'
            })
        };

      javascriptPolicy({source: code}, context, flow);
    });

//    // using let
//    it('should be able to use let', function(done) {
//      var context = {request:
//                          {uri: 'http://localhost/foo'}
//                     };
//      var code = `let a = 'bar'; request.uri = 'http://localhost/' + a;`;
//
//      javascriptPolicy({source: code}, context, error => {
//        should(error).be.a.Undefined();
//        context.request.uri.should.exactly('http://localhost/bar');
//        done();
//      });
//    });

    // try catch
    it('should be able to use try/catch', function(done) {
      var context = {request:
                          {uri: 'http://localhost/foo'}
                     };
      var code = `try {
          var vm = require('vm');
        } catch (e) {
          request.uri = 'http://localhost/bar'
        }`;


      var flow = {
          'proceed': () => {
            context.request.uri.should.exactly('http://localhost/bar');
            done();
          },
          'fail': (error) => {
            throw new Error('failed');
          },
          'logger': bunyan.createLogger(
              {
                name:'flow-engine',
                stream: process.stdout,
                level: 'debug'
            })
        };
      javascriptPolicy({source: code}, context, flow);
    });

    // using arrow function
    it('should be able to use arrow function', function(done) {
      var context = {request:
                          {uri: 'http://localhost/foo'},
                     myval: '1'
                     };
      var code = `var total = 0;
        [1, 2, 3].forEach( (val) => {
          total += val;
        });
        myval = total;`;

      var flow = {
          'proceed': () => {
            should(context.myval).exactly(6).and.be.a.Number();
            done();
          },
          'fail': (error) => {
            throw new Error('failed');
          },
          'logger': bunyan.createLogger(
              {
                name:'flow-engine',
                stream: process.stdout,
                level: 'debug'
            })
        };
      javascriptPolicy({source: code}, context, flow);
    });

    // no require
    it('should not be able to call require()', function(done) {
      var context = {request:
                          {uri: 'http://localhost/foo'}
                     };
      var code = `var vm = require('vm');`;

      var flow = {
          'proceed': () => {
            throw new Error('failed');
          },
          'fail': (error) => {
            error.name.should.exactly('ReferenceError');
            done();
          },
          'logger': bunyan.createLogger(
              {
                name:'flow-engine',
                stream: process.stdout,
                level: 'debug'
            })
        };

      javascriptPolicy({source: code}, context, flow);
    });

    // no process
    it('should not be able to use process', function(done) {
      var context = {request:
                          {uri: 'http://localhost/foo'}
                     };
      var code = `process.env;`;

      var flow = {
          'proceed': () => {
            throw new Error('failed');
          },
          'fail': (error) => {
            error.name.should.exactly('ReferenceError');
            done();
          },
          'logger': bunyan.createLogger(
              {
                name:'flow-engine',
                stream: process.stdout,
                level: 'debug'
            })
        };

      javascriptPolicy({source: code}, context, flow);
    });

    // no setTimeout
    it('should not be able to use setTimeout', function(done) {
      var context = {request:
                          {uri: 'http://localhost/foo'}
                     };
      var code = `setTimeout(()=>{request.uri='xxx';}, 1000);`;

      var flow = {
          'proceed': () => {
            throw new Error('failed');
          },
          'fail': (error) => {
            error.name.should.exactly('ReferenceError');
            done();
          },
          'logger': bunyan.createLogger(
              {
                name:'flow-engine',
                stream: process.stdout,
                level: 'debug'
            })
        };
      javascriptPolicy({source: code}, context, flow);
    });

  });
});