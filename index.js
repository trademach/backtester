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
  const newAsk = message.ask;
  const newBid = message.bid;
  const newPosition = message.position;

  tickCount++;
  totalSpread += newAsk - newBid;

  if(newPosition !== lastPosition) {
    if(lastPosition) {
      const lastUnitProfit = lastPosition >= 0 ?
        (newBid - lastAsk) :
        -(newAsk - lastBid);

      unitProfit += lastUnitProfit;

      const lastTradeProfit = lastPosition * lastUnitProfit;
      profit += lastTradeProfit;
    }

    lastAsk = newAsk;
    lastBid = newBid;
  }


  const action = message.action;
  if(action === 'match') {
    if(newPosition !== 0 && lastPosition !== newPosition) tradeCount++;
    lastPosition = message.position;
  }

  if(isSettlement) return;

  if(timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const settlementMessage = {
      strategy: message.strategy,
      instrument: message.instrument,
      action: 'match',
      position: 0,
      ask: newAsk,
      bid: newBid,
    };

    updateRecord(settlementMessage, true);
    logResult(message);
    resetRecord();
  }, 1000);
}

function logResult(message) {
  const strategy = message.strategy;
  const instrument = message.instrument;

  console.log(`result: ${strategy} / ${instrument}`);
  console.log(`total profit = ${profit}`);
  console.log(`number of trades = ${tradeCount}`);
  console.log(`profit per trade = ${profit / tradeCount}`);
  console.log(`unit profit per trade = ${unitProfit / tradeCount}`);
  console.log(`average spread = ${totalSpread / tradeCount}`);
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
