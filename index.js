'use strict';

const config = require('config');
const zmq = require('zmq');

const MQ_URI = config.get('mq.uri');
const MQ_TOPIC = config.get('mq.topic');

let profit;
let tradeCount;
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

function updateRecord(message) {
  const newPosition = message.position;
  const newAsk = message.ask;
  const newBid = message.bid;

  if(lastPosition !== null) {
    const lastTradeProfit = lastPosition >= 0 ?
      lastPosition * (newBid - lastAsk) :
      lastPosition * (newAsk - lastBid);
    profit += lastTradeProfit;
  }

  tradeCount++;

  lastPosition = newPosition;
  lastAsk = newAsk;
  lastBid = newBid;

  if(timer) clearTimeout(timer);
  timer = setTimeout(() => {
    logResult(message);
    resetRecord();

    timer = null;

  }, 1000);
}

function logResult(message) {
  const strategy = message.strategy;
  const instrument = message.instrument;

  const actualTradeCount = tradeCount - 1;
  console.log(`result: ${strategy} / ${instrument}`);
  console.log(`total profit = ${profit}`);
  console.log(`number of trades = ${actualTradeCount}`);
  console.log(`profit per trade = ${profit / actualTradeCount}`);  
}

function resetRecord() {
  profit = 0;
  tradeCount = 0;
  lastPosition = null;
  lastAsk = null;
  lastBid = null;
}

init();
