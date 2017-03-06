const co = require('co')
const url = require('url')
const EventEmitter = require('events')
const debug = require('debug')('rpc:server')
const Log = require('./log')
const Connector = require('./connector')
const Router = require('koa-router')

module.exports = class RpcServer {
  static constitute () { return [Log, Connector] }
  constructor (log, connector) {
    this.connector = connector
  }

  receive ({ receiver, method, params }) {
    if (!receiver) throw new Error('no receiver specified')
    if (!method) throw new Error('no method specified')

    const plugin = this.connector.getPlugin(receiver)

    if (!plugin) throw new Error('no plugin with id', receiver)
    const response = yield plugin.receive(method, params)
    return response
  }
  
  attach (app) {
    const router = Router()
    const self = this
    router.all('/peers/rpc', function * () {
      const ws = this.websocket
      const query = url.parse(ws.upgradeReq.url, true).query
      debug('url:', ws.upgradeReq.url)
      debug('que:', query)
      const receiver = query.receiver
      debug('got connection for receiver', receiver)

      ws.on('message', (data, flags) => {
        co(function * () {

          const parsed = JSON.parse(data)
          if (parsed.method) {
            debug('got call to', parsed.method)

            try {
              const res = yield self.receive({
                receiver: receiver,
                method: parsed.method,
                params: parsed.params
              })

              ws.send(JSON.stringify({
                jsonrpc: '2.0',
                id: parsed.id,
                response: res
              }))
            } catch (e) {
              ws.send(JSON.stringify({
                jsonrpc: '2.0',
                id: parsed.id,
                error: e.message
              })
            }
          }
        })
      })
    })

    app.ws
      .use(router.routes())
      .use(router.allowedMethods())
  }
}
