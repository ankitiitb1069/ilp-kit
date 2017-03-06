const Websocket = require('ws')
const EventEmitter = require('events')
const co = require('co')
const debug = require('debug')('rpc:client')
const uuid = require('uuid')

module.exports = class RpcClient extends EventEmitter {
  constructor ({ uri, receiver, timeout }) {
    super()

    this.timeout = timeout || 2000
    this.receiver = receiver
    this.uri = uri.replace(/\/?$/, '')
    this.ws = null

    this.call = co.wrap(this._call).bind(this)
  }

  connect () {
    return new Promise((resolve) => {
      this.ws = new Websocket(this.uri + '/?receiver=' + this.receiver)
      this.ws.on('open', () => {
        this.ws.on('message', (data, flags) => {
          const parsed = JSON.parse(data)
          if (parsed.response) {
            this.emit('_' + parsed.id, parsed.response)
          }
        })

        debug('connection opened to', this.uri, 'receiver=' + this.receiver)
        resolve()
      })
    })
  }

  * _call (method, params) {
    if (!this.ws) throw new Error('must be connected')

    const id = uuid()
    this.ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: id
    }))

    return new Promise((resolve) => this.on('_' + id, resolve))
  }
}
