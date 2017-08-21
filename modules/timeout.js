/**
 * Monitor request completion.
 * @ignore
 */
export const Timeout = function (client, window, timeoutSeconds, action, args) {
  this._window = window
  if (!timeoutSeconds) timeoutSeconds = 30

  const doTimeout = function (action, client, args) {
    return function () {
      return action.apply(client, args)
    }
  }

  this.timeout = setTimeout(doTimeout(action, client, args), timeoutSeconds * 1000)
  this.cancel = function () {
    this._window.clearTimeout(this.timeout)
  }
}

export default Timeout
