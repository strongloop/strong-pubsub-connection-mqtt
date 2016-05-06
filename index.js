// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: strong-pubsub-connection-mqtt
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = Connection;

var MqttConnection = require('mqtt-connection');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var debug = require('debug')('strong-pubsub-connection:mqtt');

/**
 * Upgrade a `net.Socket` like object into a protocol specific connection object.
 *
 * #### Events
 *
 * **Event: `connect`**
 *
 * Emitted with a `ctx` object containing the following.
 *
 * - `ctx.auth` - `Object` containing auth information
 * - `ctx.auth.username` - `Object` containing client username
 * - `ctx.auth.password` - `Object` containing client password
 *
 * Emitted on successful connection (or reconnection).
 *
 * **Event: `error`**
 *
 * Emitted when a connection error has occurred.
 *
 * **Event: `publish`**
 *
 * Emitted with a `ctx` object containing the following.
 *
 * - `ctx.topic` - `String` the topic the client would like to publish the message to
 * - `ctx.message` - `String` or `Buffer` the message to publish
 * - `ctx.options` - `Object` protocol specific options
 *
 * **Event: `subscribe`**
 *
 * Emitted with a `ctx` object containing the following.
 *
 * - `ctx.topic` - `String` the topic the client would like to publish the message to
 * - `ctx.options` - `Object` protocol specific options
 *
 * **Event: `unsubscribe`**
 *
 * Emitted with a `ctx` object containing the following.
 *
 * - `String` the topic the client would like to unsubscribe from.
 *
 * @param {net.Socket} socket The `Socket` like object to upgrade.
 * @class
 */

function Connection(socket) {
  EventEmitter.call(this);
  var connection = this;
  var mqttConnection = this.mqttConnection = new MqttConnection(socket);

  mqttConnection.on('connect', function(packet) {
    debug('received connect packet');
    connection.emit('connect', {
      auth: {
        username: packet.username,
        password: packet.password
      },
      clientId: packet.clientId,
      mqttPacket: packet
    });
  });

  mqttConnection.on('pingreq', function(packet) {
    // packet only includes header info and can be ignored
    mqttConnection.pingresp();
  });

  mqttConnection.on('publish', function(packet) {
    debug('received publish packet');
    connection.emit('publish', {
      topic: packet.topic,
      message: packet.payload,
      options: {qos: packet.qos},
      clientId: packet.clientId,
      mqttPacket: packet
    });
  });

  mqttConnection.on('subscribe', function(packet) {
    debug('received subscribe packet');
    var subscriptions = {};
    packet.subscriptions.forEach(function(subscription) {
      subscriptions[subscription.topic] = {qos: subscription.qos};
    });
    connection.emit('subscribe', {
      subscriptions: subscriptions,
      clientId: packet.clientId,
      mqttPacket: packet
    });
  });

  mqttConnection.on('unsubscribe', function(packet) {
    debug('received unsub packet');
    connection.emit('unsubscribe', {
      unsubscriptions: packet.unsubscriptions,
      clientId: packet.clientId,
      mqttPacket: packet
    });
  });
}

inherits(Connection, EventEmitter);

// Return codes:
// [
//   '',
//   'Unacceptable protocol version',
//   'Identifier rejected',
//   'Server unavailable',
//   'Bad username or password',
//   'Not authorized'
// ];

Connection.prototype.ack = function(action, ctx, cb) {
  var mqttConnection = this.mqttConnection;
  var messageId = ctx.mqttPacket && ctx.mqttPacket.messageId;

  debug('ack %s', action);

  switch(action) {
    case 'connect':
      var code = ctx.returnCode || 0;
      if(ctx.error) {
        // TODO(ritch) determine if the error is "Server unavailable" or "Identifier rejected"
        code = ctx.returnCode || 2;
      }

      if(ctx.authorized === false || ctx.reject) {
        // Not authorized
        code = 5;
      }
      if(ctx.badCredentials) {
        code = 4;
      }

      mqttConnection.connack({
        returnCode: code
      }, cb);
    break;
    case 'subscribe':
      mqttConnection.suback({
        messageId: messageId,
        granted: ctx.authorized === false 
          ? []
          : ctx.mqttPacket.subscriptions.map(function (e) {
              return e.qos;
            })
      }, cb);
    break;
    case 'unsubscribe':
      mqttConnection.unsuback({
        messageId: messageId,
      }, cb);
    break;
    case 'publish':
      switch(ctx.qos) {
        case 1:
          mqttConnection.puback({messageId: messageId}, cb);
        break;
        case 2:
          mqttConnection.pubrec({messageId: messageId}, cb);
        break;
        default:
          // no acknowledgement
          process.nextTick(cb);
        break;
      }
    break;
  }
}

Connection.prototype.publish = function(topic, message, options, cb) {
  options = options || {};
  this.mqttConnection.publish({
    topic: topic,
    payload: message,
    qos: options.qos,
    retain: options.retain
  }, cb);
}
