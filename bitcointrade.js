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
  _public(coin, command, parameters, callback) {
    if (typeof parameters === 'function') {
      callback = parameters;
      parameters = {};
    }

    if(!parameters) {
      parameters = {};
    }

    // parameters.command = command;
    return this._request({
      url: ['/public', coin, command].join('/'),
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

    var method = 'GET';
    if (parameters.method) {
      method = parameters.method;
    }

    var data;
    if (parameters.data) {
      data = parameters.data;
    }

    var request_params = {
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

  ticker(coin, callback) {
    return this._public(coin, 'ticker', callback);
  }

  orders(coin, limit, callback) {
    return this._public(coin, 'orders', {limit: limit}, callback);
  }

  trades(coin, start, end, page_size, current_page, callback) {
    let parameters = {
      start_time: start,
      end_time: end,
      page_size: page_size,
      current_page: current_page
    };
    return this._public(coin, 'trades', parameters, callback);
  }

  /////
  // PRIVATE METHODS

  walletBalance(callback) {
    return this._private('wallets/balance', {}, callback);
  }

  returnCompleteBalances(account, callback) {
    var parameters = {};

    if (typeof account === 'function') {
      callback = account;
    }

    else if (typeof account === 'string' && !!account) {
      parameters.account = account;
    }

    return this._private('returnCompleteBalances', parameters, callback);
  }

  returnDepositAddresses(callback) {
    return this._private('returnDepositAddresses', {}, callback);
  }

  generateNewAddress(currency, callback) {
    return this._private('generateNewAddress', {currency: currency}, callback);
  }

  returnDepositsWithdrawals(start, end, callback) {
    return this._private('returnDepositsWithdrawals', {start: start, end: end}, callback);
  }

  // can be called with `returnOpenOrders('all', callback)`
  returnOpenOrders(currencyA, currencyB, callback) {
    var currencyPair;

    if (typeof currencyB === 'function') {
      currencyPair = currencyA;
      callback = currencyB;
      currencyB = null;
    }

    else {
      currencyPair = joinCurrencies(currencyA, currencyB);
    }

    var parameters = {
      currencyPair: currencyPair
    };

    return this._private('returnOpenOrders', parameters, callback);
  }

  returnTradeHistory(currencyA, currencyB, start, end, callback) {
    if(arguments.length < 5){
      callback = start;
      start = Date.now() / 1000 - 60 * 60;
      end = Date.now() / 1000 + 60 * 60; // Some buffer in case of client/server time out of sync.
    }

    var parameters = {
      currencyPair: joinCurrencies(currencyA, currencyB),
      start: start,
      end: end
    };

    return this._private('returnTradeHistory', parameters, callback);
  }

  returnOrderTrades(orderNumber, callback) {
    var parameters = {
      orderNumber: orderNumber
    };

    return this._private('returnOrderTrades', parameters, callback);
  }

  buy(currencyA, currencyB, rate, amount, callback) {
    var parameters = {
      currencyPair: joinCurrencies(currencyA, currencyB),
      rate: rate,
      amount: amount
    };

    return this._private('buy', parameters, callback);
  }

  sell(currencyA, currencyB, rate, amount, callback) {
    var parameters = {
      currencyPair: joinCurrencies(currencyA, currencyB),
      rate: rate,
      amount: amount
    };

    return this._private('sell', parameters, callback);
  }

  cancelOrder(currencyA, currencyB, orderNumber, callback) {
    var parameters = {
      currencyPair: joinCurrencies(currencyA, currencyB),
      orderNumber: orderNumber
    };

    return this._private('cancelOrder', parameters, callback);
  }

  moveOrder(orderNumber, rate, amount, callback) {
    var parameters = {
      orderNumber: orderNumber,
      rate: rate,
      amount: amount ? amount : null
    };

    return this._private('moveOrder', parameters, callback);
  }

  withdraw(currency, amount, address, callback) {
    var parameters = {
      currency: currency,
      amount: amount,
      address: address
    };

    return this._private('withdraw', parameters, callback);
  }

  returnFeeInfo(callback) {
    return this._private('returnFeeInfo', {}, callback);
  }

  returnAvailableAccountBalances(account, callback) {
    var parameters = {};

    if (typeof account === 'function') {
      callback = account;
    }

    else if (typeof account === 'string' && !!account) {
      parameters.account = account;
    }

    return this._private('returnAvailableAccountBalances', parameters, callback);
  }

  returnTradableBalances(callback) {
    return this._private('returnTradableBalances', {}, callback);
  }

  transferBalance(currency, amount, fromAccount, toAccount, callback) {
    var parameters = {
      currency: currency,
      amount: amount,
      fromAccount: fromAccount,
      toAccount: toAccount
    };

    return this._private('transferBalance', parameters, callback);
  }

  returnMarginAccountSummary(callback) {
    return this._private('returnMarginAccountSummary', {}, callback);
  }

  marginBuy(currencyA, currencyB, rate, amount, lendingRate, callback) {
    var parameters = {
      currencyPair: joinCurrencies(currencyA, currencyB),
      rate: rate,
      amount: amount,
      lendingRate: lendingRate ? lendingRate : null
    };

    return this._private('marginBuy', parameters, callback);
  }

  marginSell(currencyA, currencyB, rate, amount, lendingRate, callback) {
    var parameters = {
      currencyPair: joinCurrencies(currencyA, currencyB),
      rate: rate,
      amount: amount,
      lendingRate: lendingRate ? lendingRate : null
    };

    return this._private('marginSell', parameters, callback);
  }

  getMarginPosition(currencyA, currencyB, callback) {
    var parameters = {
      currencyPair: joinCurrencies(currencyA, currencyB)
    };

    return this._private('getMarginPosition', parameters, callback);
  }

  closeMarginPosition(currencyA, currencyB, callback) {
    var parameters = {
      currencyPair: joinCurrencies(currencyA, currencyB)
    };

    return this._private('closeMarginPosition', parameters, callback);
  }

  createLoanOffer(currency, amount, duration, autoRenew, lendingRate, callback) {
    var parameters = {
      currency: currency,
      amount: amount,
      duration: duration,
      autoRenew: autoRenew,
      lendingRate: lendingRate
    };

    return this._private('createLoanOffer', parameters, callback);
  }

  cancelLoanOffer(orderNumber, callback) {
    var parameters = {
      orderNumber: orderNumber
    };

    return this._private('cancelLoanOffer', parameters, callback);
  }

  returnOpenLoanOffers(callback) {
    return this._private('returnOpenLoanOffers', {}, callback);
  }

  returnActiveLoans(callback) {
    return this._private('returnActiveLoans', {}, callback);
  }

  returnLendingHistory(start, end, limit, callback) {
    var parameters = {
      start: start,
      end: end,
      limit: limit
    };

    return this._private('returnLendingHistory', parameters, callback);
  }

  toggleAutoRenew(orderNumber, callback) {
    return this._private('toggleAutoRenew', {orderNumber: orderNumber}, callback);
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
