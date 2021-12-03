const mongoose = require('mongoose');
const { Schema } = mongoose;
//추가 작성 필요
const keySchema = new Schema({
  key: String,
  user: {type: Schema.Types.ObjectId, ref: 'User'},
});

// assetSchema.index({ key: 1, user: 1 }, { unique: true });
const Key = mongoose.model('Key', keySchema);

module.exports = Key;