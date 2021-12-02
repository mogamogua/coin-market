const mongoose = require('mongoose');

//모델 4개 (User, Coin, Asset, Key) 가져와서 export해주기
const User = require('./User');
const Coin = require('./Coin');
const Asset = require('./Asset');
const Key = require('./Key');

//mongoose-mongoDB 연결해주기
//id: sugar , password: coinserver
const mongoURL = 'mongodb+srv://sugar:sugarsugar@TestMongo.jw8ng.mongodb.net/?retryWrites=true&w=majority';
mongoose.connect(mongoURL);

//object로 여러개의 정의를 밖으로 내보낼 수 있다. -> main.js에서 import할거임
module.exports = {
  User,
  Coin,
  Asset,
  Key,
}