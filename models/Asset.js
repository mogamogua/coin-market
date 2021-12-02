const mongoose = require('mongoose');
const { Schema } = mongoose;

const assetSchema = new Schema({
  name: String,
  balance: Number,
  user: { type: Schema.Types.ObjectId, ref: 'User'}, //한 asset은 한 명의 user만이 갖는다.
});

assetSchema.index({ name: 1, user: 1 }, { unique: true }); //asset name, user모두 unique하다.(bitcoin지갑은 한개만 있다.)
const Asset = mongoose.model('Asset', assetSchema);

module.exports = Asset;



