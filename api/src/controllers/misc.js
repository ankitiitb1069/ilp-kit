"use strict"

module.exports = MiscControllerFactory

const exec = require('child_process').exec
const Auth = require('../lib/auth')
const Log = require('../lib/log')
const Config = require('../lib/config')
const Ledger = require('../lib/ledger')
const Utils = require('../lib/utils')
const currencySymbolMap = require('currency-symbol-map').currencySymbolMap
const Connector = require('../lib/connector')
const InvalidBodyError = require('../errors/invalid-body-error')

MiscControllerFactory.constitute = [Auth, Log, Config, Ledger, Utils, Connector]
function MiscControllerFactory (Auth, log, config, ledger, utils, connector) {
  log = log('misc')

  return class MiscController {
    static init (router) {
console.log('INIT MISC')
      router.get('/parse/destination', this.destination)
      router.get('/config', this.config)
    }

    /**
     * @api {GET} /parse/destination Parse destination
     * @apiName ParseDestination
     * @apiGroup Misc
     * @apiVersion 1.0.0
     *
     * @apiDescription Parse a destination
     *
     * @apiExample {shell} Parse a destination
     *    curl -X GET
     *    https://wallet.example/parse/destination?destination=alice@wallet.example
     *
     * @apiSuccessExample {json} 200 Response:
     *    HTTP/1.1 200 OK
     *    {
     *      {
     *        "type": "local",
     *        "ledgerUri": "http://wallet.example/ledger",
     *        "paymentUri": "http://wallet.example/api/spsp/alice",
     *        "ilpAddress": "wallet.alice",
     *        "currencyCode": "USD",
     *        "name": "Alice Faye",
     *        "imageUrl": ""
     *      }
     *    }
     */
    static * destination () {
      const destination = this.query.destination

      if (!destination) {
        throw new InvalidBodyError('No destination specified')
      }

      this.body = yield utils.parseDestination({ destination })
    }

    /**
     * @api {GET} /config Wallet config
     * @apiName GetConfig
     * @apiGroup Misc
     * @apiVersion 1.0.0
     *
     * @apiDescription Get wallet config
     *
     * @apiExample {shell} Get wallet config
     *    curl -X GET
     *    https://wallet.example/config
     *
     * @apiSuccessExample {json} 200 Response:
     *    HTTP/1.1 200 OK
     *    {
     *      "ledgerUri": "https://wallet.example/ledger",
     *      "currencyCode": "USD",
     *      "currencyScale": 6
     *    }
     */
    static * config () {
      const ledgerInfo = yield ledger.getInfo()
console.log('CALLED MISC', ledgerInfo)

      const packageVersion = require('../../../package.json').version
      const gitCommit = yield new Promise(resolve => {
        exec('git rev-parse --short HEAD', { cwd: __dirname }, (err, stdout) => {
          resolve(stdout.split('\n').join(''))
        })
      })

      const response = {
        clientUri: config.data.get('client_host'),
        ledgerUri: config.data.getIn(['ledger', 'public_uri']),
        currencyCode: ledgerInfo.currency_code,
        currencySymbol: currencySymbolMap[ledgerInfo.currency_code],
        registration: config.data.get('registration'),
        antiFraud: !!config.data.getIn(['antifraud', 'service_url']),
        title: config.data.get('client_title'),
        track: {
          ga: config.data.getIn(['track', 'ga']),
          mixpanel: config.data.getIn(['track', 'mixpanel'])
        },
        githubAuth: (config.data.getIn(['github', 'client_id']) && config.data.getIn(['github', 'client_secret'])),
        version: `${packageVersion}-${gitCommit}`
      }

      response.settlementMethods = yield connector.getSelfSettlementMethods(false, 0)

      if (config.data.get('reload')) {
        response.reload = true
      }

      this.body = response
    }
  }
}
