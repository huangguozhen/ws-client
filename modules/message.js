import { format, ERROR, parseUTF8, UTF8Length, stringToUTF8 } from './utils'

export const Message = function (newPayload) {
  let payload
  if (typeof newPayload === 'string' ||
    newPayload instanceof ArrayBuffer ||
    newPayload instanceof Int8Array ||
    newPayload instanceof Uint8Array ||
    newPayload instanceof Int16Array ||
    newPayload instanceof Uint16Array ||
    newPayload instanceof Int32Array ||
    newPayload instanceof Uint32Array ||
    newPayload instanceof Float32Array ||
    newPayload instanceof Float64Array) {
    payload = newPayload
  } else {
    throw (format(ERROR.INVALID_ARGUMENT, [newPayload, 'newPayload']))
  }

  this._getPayloadString = function () {
    if (typeof payload === 'string') return payload

    return parseUTF8(payload, 0, payload.length)
  }

  this._getPayloadBytes = function () {
    if (typeof payload !== 'string') return payload

    const buffer = new ArrayBuffer(UTF8Length(payload))
    const byteStream = new Uint8Array(buffer)
    stringToUTF8(payload, byteStream, 0)
    return byteStream
  }
}

Message.prototype = {
  get payloadString () { return this._getPayloadString() },
  get payloadBytes () { return this._getPayloadBytes() }
}

export default Message
