const crypto = require('crypto');
const nonce = require('nonce');

const querystring = require('querystring');
const https = require('https');

const version = require('./package.json').version;
const name = require('./package.json').name;

const USER_AGENT = `${name}@${version}`;

const joinCurrencies = (currencyA, currencyB) => {
  // If only one arg, then return the first
  if (typeof currencyB !== 'string') {
    return currencyA;
  }

  return currencyA + '_' + currencyB;
}

const currency_names = {
  'BTC' => 'bitcoin',
  'XRP' => 'ripple',
  'LTC' => 'litecoin',
  'ETH' => 'ethereum',
  'BCH' => 'bitcoincash',
  'EOS' => 'eos',
  'DAI' => 'dai'
};

class Bitcointrade {
  constructor(config) {
    this.ua = USER_AGENT;
    this.timeout = 60 * 1000;
    this.noncer = nonce();

    if(!config) {
      return;
    }

    if(config.key) {
      this.key = config.key;
    }

    if(config.timeout) {
      this.timeout = config.timeout;
    }

    if(config.userAgent) {
      this.ua += ' | ' + config.userAgent;
    }
  }

  _getPrivateHeaders() {
    if (!this.key) {
      throw new Error('Bitcointrade: Error. API key required');
    }

    return {
      'x-api-key': this.key
    };
  }

  _request({url, qs, method, data, headers = {}}, callback) {

    const path = '/v3' + url + '?' + querystring.stringify(qs);

    const options = {
      host: 'api.bitcointrade.com.br',
      path,
      method,
      headers: {
        'User-Agent': this.ua,
        ...headers
      }
    };

    const rawData = querystring.stringify(data);

    if(method === 'POST') {
      options.headers['Content-Length'] = rawData.length;
      // options.headers['content-type'] = 'application/x-www-form-urlencoded';
      options.headers['content-type'] = 'application/json';
    }
    console.log("[Bitcointrade] Calling ", path, " with options: ", options);
    const req = https.request(options, res => {
      res.setEncoding('utf8');
      let buffer = '';
      res.on('data', function(data) {
        buffer += data;
      });
      res.on('end', function() {
        if (res.statusCode !== 200) {
          let message;

          try {
            message = JSON.parse(buffer);
          } catch(e) {
            message = {
              error: buffer
            }
          }

          return callback(new Error(`[Bitcointrade] ${res.statusCode} ${message.error}`));
        }

        let json;
        try {
          json = JSON.parse(buffer);
        } catch (err) {
          return callback(err);
        }
        callback(null, json);
      });
    });

    req.on('error', err => {
      callback(err);
    });

    req.on('socket', socket => {
      socket.setTimeout(this.timeout);
      socket.on('timeout', function() {
        req.abort();
      });
    });

    req.end(rawData);
  }

  // Make a public API request
  _public(pair, command, parameters, callback) {
    if (typeof parameters === 'function') {
      callback = parameters;
      parameters = {};
    }

    if(!parameters) {
      parameters = {};
    }

    // parameters.command = command;
    return this._request({
      url: ['/public', pair, command].join('/'),
      qs: parameters,
      method: 'GET'
    }, callback);
  }

  // Make a private API request
  _private(command, parameters, callback) {

    if (typeof parameters === 'function') {
      callback = parameters;
      parameters = {};
    }

    if(!parameters) {
      parameters = {};
    }

    let method = 'GET';
    if (parameters.method) {
      method = parameters.method;
    }

    let data;
    if (parameters.data) {
      data = parameters.data;
    }

    let request_params = {
      url: '/' + command,
      headers: this._getPrivateHeaders(parameters),
      method: method
    };

    if (method == 'GET') {
      request_params.qs = data;
    } else {
      request_params.data = data;
    }

    return this._request(request_params, callback);
  }

  ticker(pair, callback) {
    return this._public(pair, 'ticker', callback);
  }

  orders(pair, limit, callback) {
    return this._public(pair, 'orders', {limit: limit}, callback);
  }

  trades(pair, start, end, page_size, current_page, callback) {
    let parameters = {
      start_time: start,
      end_time: end,
      page_size: page_size,
      current_page: current_page
    };
    return this._public(pair, 'trades', parameters, callback);
  }

  /////
  // PRIVATE METHODS

  walletBalance(callback) {
    return this._private('wallets/balance', {}, callback);
  }

  summary(pair, callback) {
    let data = {
      pair = pair
    };

    return this._private('market/summary', {data: data}, callback);
  }

  estimatedPrice(pair, amount, type, callback) {
    var data = {
      amount: amount,
      type: type,
      pair: pair
    };

    return this._private('market/estimated_price', {data: data}, callback);
  }

  bookOrders(pair, limit, callback) {
    let data {
      pair: pair,
      limit: limit
    };

    return this._private('market', {data: data}, callback);
  }

  userOrders(pair, start, end, type, status, page_size, current_page, callback) {
    let data = {
      pair: pair,
      start_date: start,
      end_date: end,
      type: type,
      status: status,
      page_size: page_size,
      current_page: current_page
    };

    return this._private('market/user_orders/list', {data: data}, callback);
  }

  buy(pair, price, amount, subtype, callback) {
    let data = {
      pair: pair,
      type: 'buy',
      unit_price: price,
      amount: amount,
      subtype: subtype
    };

    return this._private('market/create_order', {data: data, method: 'POST'}, callback);
  }

  sell(pair, price, amount, subtype, callback) {
    let data = {
      pair: pair,
      type: 'sell',
      unit_price: price,
      amount: amount,
      subtype: subtype
    };

    return this._private('market/create_order', {data: data, method: 'POST'}, callback);
  }

  cancelOrder(orderId, orderCode, callback) {
    let data = {};
    if (orderId) {
      data.id = orderId;
    } else if (orderCode) {
      data.code = orderCode;
    }

    return this._private('market/user_orders', {data: data, method: 'DELETE'}, callback);
  }

  withdrawFeeEstimate(currency, callback) {
    let currency_name = currency_names[currency];

    return this._private(currency_name + '/withdraw/fee', {}, callback);
  }

  depositList(currency, status, start, end, page_size, current_page, callback) {
    let data = {
      status: status,
      start_date: start,
      end_date: end,
      page_size: page_size,
      current_page: current_page
    };

    let currency_name = currency_names[currency];

    return this._private(currency_name + '/deposits', {data: data}, callback);
  }

  createWithdraw(currency, destination, fee_type, amount, tag, callback) {
    let currency_name = currency_names[currency];

    let data = {
      destination: destination,
      fee_type: fee_type,
      amount: amount,
      tag: tag
    };

    return this._private(currency_name + '/withdraw', {data: data, method: "POST"}, callback);
  }

  syncTransaction(hash, callback) {
    let data = {
      hash: hash
    };

    return this._private('ripple/sync_transaction', {data: data, method: "POST"}, callback);
  }

};

// Backwards Compatibility
Bitcointrade.prototype.getTicker = Bitcointrade.prototype.returnTicker;
Bitcointrade.prototype.get24hVolume = Bitcointrade.prototype.return24hVolume;
Bitcointrade.prototype.getOrderBook = Bitcointrade.prototype.returnOrderBook;
Bitcointrade.prototype.getTradeHistory = Bitcointrade.prototype.returnChartData;
Bitcointrade.prototype.myBalances = Bitcointrade.prototype.returnBalances;
Bitcointrade.prototype.myOpenOrders = Bitcointrade.prototype.returnOpenOrders;
Bitcointrade.prototype.myTradeHistory = Bitcointrade.prototype.returnTradeHistory;

module.exports = Bitcointrade;
