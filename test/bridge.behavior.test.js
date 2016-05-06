// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: strong-pubsub-connection-mqtt
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var Client = require('strong-pubsub');
var Adapter = require('strong-pubsub-mqtt');
var Connection = require('../'); // strong-pubsub-connection-mqtt
var Proxy = require('strong-pubsub-bridge');
var helpers = require('strong-pubsub-test');
var usingMosquitto = helpers.usingMosquitto;
var waitUntilAcceptingConnections = helpers.waitForConnection;
var defineBridgeBehaviorTests = helpers.defineBridgeBehaviorTests;

describe('bridge behavior', function () {
  beforeEach(function(done) {
    var test = this;
    if (process.env.CI) {
      // CI provides a mosquitto server on the default port
      test.brokerPort = 1883;
      return done();
    }
    usingMosquitto(function(err, port) {
      test.brokerPort = port;
      done(err);
    });
  });

  defineBridgeBehaviorTests(Proxy, Client, Adapter, Connection, {
    qos: 2,
    retain: true
  });
});
