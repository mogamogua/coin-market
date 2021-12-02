const mongoose = require('mongoose');
const { Schema } = mongoose;

const coinSchema = new Schema({
  name: {type: String, unique: true}, //코인이름도 중복되지 않는다.
  // coingeckoId: String,
  isActive: Boolean,
});

const Coin = mongoose.model('Coin', coinSchema);

module.exports = Coin;