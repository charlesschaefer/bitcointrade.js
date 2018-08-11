const Poloniex = require('./poloniex');

const p = new Poloniex();

p.returnTicker(console.log);
// p.returnOpenOrders('BTC', 'USDT', console.log)