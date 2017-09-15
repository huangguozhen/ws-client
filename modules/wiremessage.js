import { MESSAGE_TYPE, encodeMBI, writeUint16, readUint16 } from './utils'
import Message from './message'

const VERSION = 0
export const WireMessage = function (type, options = {}) {
  this.type = type
  for (let name in options) {
    this[name] = options[name]
  }
}

WireMessage.prototype.encode = function () {
  const first = ((this.type & 0x0f) << 4) | (VERSION & 0x03)
  let remLength = 0
  let payloadBytes

  if (this.messageIdentifier !== undefined) remLength += 2

  if (this.payloadMessage) {
    payloadBytes = this.payloadMessage.payloadBytes
    remLength += payloadBytes.byteLength

    if (payloadBytes instanceof ArrayBuffer) {
      payloadBytes = new Uint8Array(payloadBytes)
    } else if (!(payloadBytes instanceof Uint8Array)) {
      payloadBytes = new Uint8Array(payloadBytes.buffer)
    }
  }

  const mbi = encodeMBI(remLength)
  let pos = mbi.length + 1
  const buffer = new ArrayBuffer(remLength + pos)
  const byteStream = new Uint8Array(buffer)

  byteStream[0] = first
  byteStream.set(mbi, 1)

  // Output the messageIdentifier - if there is one
  if (this.messageIdentifier !== undefined) {
    pos = writeUint16(this.messageIdentifier, byteStream, pos)
  }

  if (payloadBytes) {
    byteStream.set(payloadBytes, pos)
  }

  return buffer
}

export function decodeMessage (input, pos) {
  const startingPos = pos
  let first = input[pos]
  const type = first >> 4
  pos += 1

  // Decode the remaining length (MBI format)
  let digit
  let remLength = 0
  var multiplier = 1
  do {
    if (pos === input.length) return [null, startingPos]

    digit = input[pos++]
    remLength += ((digit & 0x7F) * multiplier)
    multiplier *= 128
  } while ((digit & 0x80) !== 0)

  const endPos = pos + remLength
  if (endPos > input.length) return [null, startingPos]

  const wireMessage = new WireMessage(type)

  // 除了AUTH，BEAT都需要messageIdentifier
  if (type > 3 && type < 12) {
    wireMessage.messageIdentifier = readUint16(input, pos)
    pos += 2
  }

  const message = new Message(input.subarray(pos, endPos))
  wireMessage.payloadMessage = message

  return [wireMessage, endPos]
}

export default WireMessage
