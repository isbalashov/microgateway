'use strict';

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var express = require('express');
var supertest = require('supertest');
var echo = require('./support/echo-server');
var ldap = require('./support/ldap-server');
var mg = require('../lib/microgw');
var dsc = require('../datastore/client');
var should = require('should');
var apimServer = require('./support/mock-apim-server/apim-server');

function cleanup () {
  var rmfile = function(fpath) {
    return new Promise(function(resolve, reject) {
      console.log(`Removing file ${fpath}`);
      fs.unlink(fpath, function(err) {
        if (err) {
          console.error(`Error removing ${fpath}`);
          reject(err);
        }
        else
          resolve();
      })
    });
  };

  var readdir = function(dir) {
    return new Promise(function(resolve, reject) {
      fs.readdir(ssdir, function(err, files) {
        if (err) {
          console.error(`Error while reading ${ssdir}`);
          reject(err);
        }
        else
          resolve(files);
      });
    });
  };

  var ssdir;

  return dsc.getCurrentSnapshot()
    .then(function(id) {
      ssdir = path.resolve(__dirname, '../config', id);
      return readdir(ssdir);
    })
    .then(function(files) {
      return new Promise(function(resolve) {
        console.log(`Removing ${ssdir}`);
        var p = Promise.all(_.map(files, function(f) { return rmfile(path.resolve(ssdir, f)); }));
        p = p.then(function() {
          fs.rmdir(ssdir, function(err) {
            if (err)
              console.error(`Error removing ${fpath}`);
            resolve(p);
          });
        });
      });
    })
    .catch(function(err) {
      console.error('cleanup() failed due to error', err);
    });
}

describe('basic auth policy', function() {

  var request;
  before(function(done) {
    process.env.CONFIG_DIR = __dirname + '/definitions/basic';
    process.env.DATASTORE_PORT = 5000;
    process.env.APIMANAGER_PORT = 8081;
    process.env.APIMANAGER = '127.0.0.1';
    process.env.NODE_ENV = 'production';
    apimServer.start('127.0.0.1', 8081)
      .then(function() { return mg.start(3000); })
      .then(function() {
        return ldap.start(1389, 1636);
      })
      .then(function() {
        return echo.start(8889);
      })
      .then(function() {
        request = supertest('http://localhost:3000');
      })
      .then(done)
      .catch(function(err) {
        console.error(err);
        done(err);
      });
  });

  after(function(done) {
    cleanup()
      .then(function() { return mg.stop(); })
      .then(function() { return ldap.stop(); })
      .then(function() { return echo.stop(); })
      .then(function() { return apimServer.stop(); })
      .then(function() {
        delete process.env.CONFIG_DIR;
        delete process.env.DATASTORE_PORT;
        delete process.env.APIMANAGER_PORT;
        delete process.env.APIMANAGER;
        delete process.env.NODE_ENV;
      })
      .then(done, done)
      .catch(done);
  });

  describe('Basic Auth with LDAP', function () {

    it('should fail due to missing LDAP registry', function (done) {
      request
      .post('/basic/path-1')
      .auth('root', 'Hunter2')
      .expect(401, done);
    });

    describe('SearchDN', function () {
      it('should pass with root:Hunter2', function (done) {
        request
        .get('/basic/path-1')
        .auth('root', 'Hunter2')
        .expect(200, done);
      });

      it('should fail with root:badpass', function (done) {
        request
        .get('/basic/path-1')
        .auth('root', 'badpass')
        .expect(401, {name: 'PreFlowError', message: 'unable to process the request'}, done);
      });
    });

    describe('ComposeDN', function () {
      it('should pass composeDN with jsmith:foobar', function(done) {
        request
        .get('/basic/path-3')
        .auth('jsmith', 'foobar')
        .expect(200, done);
      });

      it('should fail composeDN with jsmith:wrongpass', function(done) {
        request
        .get('/basic/path-3')
        .auth('jsmith', 'wrongpass')
        .expect(401, done);
      });
    });

    describe('ComposeUPN', function () {

      it('should pass with user1:c@pstone123', function (done) {
        request
        .get('/basic/compose-upn')
        .auth('user1', 'c@pstone123')
        .expect(200, done);
      });

      it('should fail with user1:capstone123', function (done) {
        request
        .get('/basic/compose-upn')
        .auth('user1', 'capstone123')
        .expect(401, done);
      });

    });

    describe('With TLS', function () {
      it('should pass with root:Hunter2 (tls)', function (done) {
        request
        .put('/basic/path-1')
        .auth('root', 'Hunter2')
        .expect(200, done);
      });
    });

  });

  describe('Basic Auth with HTTP', function () {
    it('should pass using http with root:Hunter2', function (done) {
      request
      .get('/basic/path-2')
      .auth('root', 'Hunter2')
      .expect(200, done);
    });

    it('should fail using http with root:badpass', function (done) {
      request
      .get('/basic/path-2')
      .auth('root', 'badpass')
      .expect(401, {name: 'PreFlowError', message: 'unable to process the request'}, done);
    });
  });

});
