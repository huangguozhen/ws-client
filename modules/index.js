/*******************************************************************************
 * Copyright (c) 2017 Molmc Corp.
 *
 * Contributors:
 *    Guozhen Huang
 *******************************************************************************/
/* eslint no-unused-expressions: 0 */
import { ERROR, MESSAGE_TYPE, format, scope } from './utils'
import Message from './message'
import WireMessage, { decodeMessage } from './wiremessage'
import Timeout from './timeout'
import Pinger from './pinger'

export const WsClient = function (uri, host, port, path, clientId) {
  if (!('WebSocket' in global && global['WebSocket'] !== null)) {
    throw new Error(format(ERROR.UNSUPPORTED, ['WebSocket']))
  }
  if (!('localStorage' in global && global['localStorage'] !== null)) {
    throw new Error(format(ERROR.UNSUPPORTED, ['localStorage']))
  }
  if (!('ArrayBuffer' in global && global['ArrayBuffer'] !== null)) {
    throw new Error(format(ERROR.UNSUPPORTED, ['ArrayBuffer']))
  }

  this.uri = uri
  this.clientId = clientId

  this._msg_queue = []
  this._notify_msg_sent = {}
  this._message_identifier = 1
}

WsClient.prototype.uri
WsClient.prototype.clientId
WsClient.prototype.socket
WsClient.prototype.connected = false
WsClient.prototype.maxMessageIdentifier = 65536
WsClient.prototype.connectOptions
WsClient.prototype.hostIndex
WsClient.prototype.onConnectionLost
WsClient.prototype.onMessageDelivered
WsClient.prototype.onMessageArrived
WsClient.prototype._msg_queue = null
WsClient.prototype._connectTimeout
WsClient.prototype.sendPinger = null
// WsClient.prototype.receivePinger = null
WsClient.prototype.receiveBuffer = null

WsClient.prototype.connect = function (connectOptions) {
  if (this.connected) {
    throw new Error(format(ERROR.INVALID_STATE, ['already connected']))
  }
  if (this.socket) {
    throw new Error(format(ERROR.INVALID_STATE, ['already connected']))
  }

  this.connectOptions = connectOptions
  if (connectOptions.uris) {
    this.hostIndex = 0
    this._doConnect(connectOptions.uris[0])
  } else {
    this._doConnect(this.uri)
  }
}

WsClient.prototype.send = function (type, message) {
  if (!this.connected) {
    throw new Error(format(ERROR.INVALID_STATE, ['not connected']))
  }
  const wireMessage = new WireMessage(type)
  wireMessage.payloadMessage = message

  if (type === MESSAGE_TYPE.SEND_SMS) {
    wireMessage.messageIdentifier = this._message_identifier++
    if (this._message_identifier === this.maxMessageIdentifier) {
      this._message_identifier = 1
    }
  }

  this._schedule_message(wireMessage)
}

WsClient.prototype.disconnect = function () {
  if (!this.socket) {
    throw new Error(format(ERROR.INVALID_STATE, ['not connecting or connected']))
  }

  this._disconnected(ERROR.INVALID_MQTT_MESSAGE_TYPE.code,
    format(ERROR.INVALID_MQTT_MESSAGE_TYPE, [MESSAGE_TYPE.DISCONNECT]))
}

WsClient.prototype._doConnect = function (wsurl) {
  this.connected = false
  this.socket = new WebSocket(wsurl)

  this.socket.binaryType = 'arraybuffer'
  this.socket.onopen = scope(this._on_socket_open, this)
  this.socket.onmessage = scope(this._on_socket_message, this)
  this.socket.onerror = scope(this._on_socket_error, this)
  this.socket.onclose = scope(this._on_socket_close, this)

  const { keepAliveInterval, timeout } = this.connectOptions
  this.sendPinger = new Pinger(this, window, keepAliveInterval)
  // this.receivePinger = new Pinger(this, window, keepAliveInterval)
  this._connectTimeout = new Timeout(this, window, timeout, this._disconnected,
    [ERROR.CONNECT_TIMEOUT.code, format(ERROR.CONNECT_TIMEOUT)])
}

WsClient.prototype._schedule_message = function (message) {
  this._msg_queue.push(message)
  if (this.connected) this._process_queue()
}

WsClient.prototype._process_queue = function () {
  let message = null
  const fifo = this._msg_queue.reverse()

  // eslint-disable-next-line
  while ((message = fifo.pop())) {
    this._socket_send(message)

    if (this._notify_msg_sent[message]) {
      this._notify_msg_sent[message]()
      delete this._notify_msg_sent[message]
    }
  }
}

WsClient.prototype._on_socket_open = function () {
  // console.log('_on_socket_open')
  const payloadMessage = new Message(JSON.stringify({
    id: this.connectOptions.userName,
    accessToken: this.connectOptions.password
  }))

  const wireMessage = new WireMessage(MESSAGE_TYPE.CONNECT, { payloadMessage })
  setTimeout(() => this._socket_send(wireMessage), 500)
}

WsClient.prototype._on_socket_message = function (event) {
  let data = event.data

  // this.receivePinger.reset()
  // console.log(`[RECEIVED] ${UTF8ToHex(data)}`, new Uint8Array(data))
  const messages = this._deframeMessages(data)
  for (let i = 0; i < messages.length; i += 1) {
    this._handleMessage(messages[i])
  }
}

WsClient.prototype._deframeMessages = function (data) {
  const messages = []
  let byteArray = new Uint8Array(data)

  if (this.receiveBuffer) {
    let newData = new Uint8Array(this.receiveBuffer.length + byteArray.length)
    newData.set(this.receiveBuffer)
    newData.set(byteArray, this.receiveBuffer.length)
    byteArray = newData
    delete this.receiveBuffer
  }

  try {
    let offset = 0
    while (offset < byteArray.length) {
      const result = decodeMessage(byteArray, offset)
      const wireMessage = result[0]
      offset = result[1]

      if (!wireMessage) break
      messages.push(wireMessage)
    }

    if (offset < byteArray.length) {
      this.receiveBuffer = byteArray.subarray(offset)
    }
  } catch (error) {
    this._disconnected(ERROR.INTERNAL_ERROR.code,
      format(ERROR.INTERNAL_ERROR, [error.message, error.stack.toString()]))
    return
  }

  return messages
}

WsClient.prototype._handleMessage = function (wireMessage) {
  try {
    switch (wireMessage.type) {
      case MESSAGE_TYPE.CONNACK:
        this._connectTimeout.cancel()
        this.connected = true
        if (this.connectOptions.onSuccess) {
          this.connectOptions.onSuccess({
            invocationContext: this.connectOptions.invocationContext
          })
        }
        this._process_queue()
        break
      case MESSAGE_TYPE.SEND_SMS:
      case MESSAGE_TYPE.SEND_SMS_REPLY:
      case MESSAGE_TYPE.ACTION:
      case MESSAGE_TYPE.ACTION_REPLY:
      case MESSAGE_TYPE.DEV_DBG:
      case MESSAGE_TYPE.DEV_DBG_REPLY:
      case MESSAGE_TYPE.SEND_META:
      case MESSAGE_TYPE.SEND_META_REPLY:
        if (this.onMessageArrived) this.onMessageArrived(wireMessage)
        break
      case MESSAGE_TYPE.PINGRESP:
        this.sendPinger.reset()
        break
      case MESSAGE_TYPE.DISCONNECT:
        this._disconnected(ERROR.INVALID_MQTT_MESSAGE_TYPE.code,
          format(ERROR.INVALID_MQTT_MESSAGE_TYPE, [wireMessage.type]))
        break
      default:
        this._disconnected(ERROR.INVALID_MQTT_MESSAGE_TYPE.code,
          format(ERROR.INVALID_MQTT_MESSAGE_TYPE, [wireMessage.type]))
    }
  } catch (error) {
    this._disconnected(ERROR.INTERNAL_ERROR.code,
      format(ERROR.INTERNAL_ERROR, [error.message, error.stack.toString()]))
    return
  }
}

WsClient.prototype._on_socket_error = function (error) {
  this._disconnected(ERROR.SOCKET_ERROR.code, format(ERROR.SOCKET_ERROR, [error.data]))
}

WsClient.prototype._on_socket_close = function () {
  this._disconnected(ERROR.SOCKET_CLOSE.code, format(ERROR.SOCKET_CLOSE))
}

WsClient.prototype._socket_send = function (wireMessage) {
  const buffer = wireMessage.encode()
  this.socket.send(buffer)
  this.sendPinger.reset()

  // const bytes = new Uint8Array(buffer)
  // console.log(`[SEND] ${UTF8ToHex(bytes)}`, bytes)
}

WsClient.prototype._disconnected = function (errorCode, errorText) {
  this.sendPinger.cancel()
  // this.receivePinger.cancel()
  if (this._connectTimeout) this._connectTimeout.cancel()

  this._msg_queue = []
  this._notify_msg_sent = {}

  if (this.socket) {
    this.socket.onopen = null
    this.socket.onmessage = null
    this.socket.onerror = null
    this.socket.onclose = null
    if (this.socket.readyState === 1) this.socket.close()
    delete this.socket
  }

  const { uris, onFailure, invocationContext } = this.connectOptions
  if (uris && this.hostIndex < (uris.length - 1)) {
    this.hostIndex++
    this._doConnect(uris[this.hostIndex])
  } else {
    if (errorCode === undefined) {
      errorCode = ERROR.OK.code
      errorText = format(ERROR.OK)
    }

    if (this.connected) {
      this.connected = false
      if (this.onConnectionLost) this.onConnectionLost({ errorCode, errorMessage: errorText })
    } else {
      if (uris) {
        this.hostIndex = 0
        this._doConnect(uris[0])
      } else {
        this._doConnect(this.uri)
      }

      if (onFailure) onFailure({ invocationContext, errorCode, errorMessage: errorText })
    }
  }
}

export default WsClient
