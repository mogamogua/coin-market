require('dotenv').config();
const mongoose = require('mongoose');

//모델 4개 (User, Coin, Asset, Key) 가져와서 export해주기
const User = require('./User');
const Coin = require('./Coin');
const Asset = require('./Asset');
const Key = require('./Key');

//mongoose-mongoDB 연결해주기
const { MONGO_URI } = process.env;
//id: sugar , password: coinserver
mongoose.connect(MONGO_URI);

//object로 여러개의 정의를 밖으로 내보낼 수 있다. -> main.js에서 import할거임
module.exports = {
  User,
  Coin,
  Asset,
  Key,
}