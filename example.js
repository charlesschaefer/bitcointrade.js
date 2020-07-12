const Bitcointrade = require('./bitcointrade');

const p = new Bitcointrade();

p.returnTicker(console.log);


// fil in keys and uncommetn
// const p2 = new Bitcointrade({
//   key: 'x',
//   secret: 'y'
// });
// p2.returnOpenOrders('BTC', 'USDT', console.log)