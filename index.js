'use strict';

const config = require('config');
const zmq = require('zmq');

const MQ_URI = config.get('mq.uri');
const MQ_TOPIC = config.get('mq.topic');

let profit;
let unitProfit;
let tradeCount;
let totalSpread;
let tickCount;
let lastPosition;
let lastAsk;
let lastBid;

let timer;

function init() {
  resetRecord();

  const socket = zmq.socket('sub');

  socket.connect(MQ_URI);
  socket.subscribe(MQ_TOPIC);
  socket.on('message', handleMessage);
}

function handleMessage(topic, data) {
  const message = JSON.parse(data);
  if(!timer) console.log(`start test: ${message.strategy} / ${message.instrument}`);

  updateRecord(message);
}

function updateRecord(message, isSettlement) {
  const strategy = message.strategy;
  const instrument = message.instrument;
  const newAsk = message.ask;
  const newBid = message.bid;
  const newPosition = message.position;

  tickCount++;
  totalSpread += newAsk - newBid;

  if(newPosition !== lastPosition) {
    console.log(`order received: ${strategy} / ${instrument}`);

    if(lastPosition) {
      const lastUnitProfit = lastPosition >= 0 ?
        (newBid - lastAsk) :
        -(newAsk - lastBid);

      unitProfit += lastUnitProfit;

      const lastTradeProfit = Math.abs(lastPosition) * lastUnitProfit;
      profit += lastTradeProfit;
    }

    lastAsk = newAsk;
    lastBid = newBid;
  }

  const action = message.action;
  if(action === 'match') {
    if(newPosition !== 0 && lastPosition !== newPosition) tradeCount++;
    lastPosition = message.position;

  } else if(action === 'close') {
    lastPosition = 0;

  } else if(action === 'buy') {
    lastPosition = message.size;
    tradeCount++;

  } else if(action === 'sell') {
    lastPosition = message.size;
    tradeCount++;
  }

  if(isSettlement) return;

  if(timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const settlementMessage = {
      strategy: strategy,
      instrument: instrument,
      action: 'match',
      position: 0,
      ask: newAsk,
      bid: newBid,
    };

    updateRecord(settlementMessage, true);
    logResult(message);
    resetRecord();
  }, config.get('backtest.resultDelay') * 1000);
}

function logResult(message) {
  const strategy = message.strategy;
  const instrument = message.instrument;

  const avgProfit = profit / tradeCount;
  const avgUnitProfit = unitProfit / tradeCount;
  const avgSpread = totalSpread / tickCount;

  console.log(`result: ${strategy} / ${instrument}`);
  console.log(`total profit = ${Math.floor(profit * 1000) / 1000}`);
  console.log(`number of trades = ${tradeCount}`);
  console.log(`profit per trade = ${Math.floor(avgProfit * 1000) / 1000}`);
  console.log(`unit profit per trade = ${Math.floor(avgUnitProfit * 10000 * 1000) / 1000} PIPS`);
  console.log(`average spread = ${Math.floor(avgSpread * 10000 * 1000) / 1000} PIPS`);
}

function resetRecord() {
  profit = 0;
  unitProfit = 0;
  tradeCount = 0;
  totalSpread = 0;
  tickCount = 0;
  lastPosition = 0;
  lastAsk = null;
  lastBid = null;

  timer = null;
}

init();
