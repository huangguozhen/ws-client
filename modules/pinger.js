/**
 * Repeat keepalive requests, monitor responses.
 * @ignore
 */
import WireMessage from './wiremessage'
import { MESSAGE_TYPE, ERROR, format } from './utils'

export const Pinger = function (client, window, keepAliveInterval) {
  this._client = client
  this._window = window
  this._keepAliveInterval = (keepAliveInterval || 5) * 1000
  this.isReset = false

  const pingReq = new WireMessage(MESSAGE_TYPE.PINGREQ).encode()

  const doTimeout = function (pinger) {
    return function () {
      return doPing.apply(pinger)
    }
  }

  /** @ignore */
  const doPing = function () {
    if (!this.isReset) {
      this._client._disconnected(ERROR.PING_TIMEOUT.code, format(ERROR.PING_TIMEOUT))
    } else {
      this.isReset = false
      this._client.socket.send(pingReq)
      this.timeout = this._window.setTimeout(doTimeout(this), this._keepAliveInterval)

      // const bytes = new Uint8Array(pingReq)
      // console.log(`[PING] ${UTF8ToHex(bytes)}`, bytes)
    }
  }

  this.reset = function () {
    this.isReset = true
    this._window.clearTimeout(this.timeout)
    if (this._keepAliveInterval > 0) {
      this.timeout = setTimeout(doTimeout(this), this._keepAliveInterval)
    }
  }

  this.cancel = function () {
    this._window.clearTimeout(this.timeout)
  }
}

export default Pinger
