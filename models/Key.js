const mongoose = require('mongoose');
const { Schema } = mongoose;
//추가 작성 필요
const keySchema = new Schema({
  name: {type: String, unique: true },
  user: {type: Schema.Types.ObjectId, ref: 'User'},
});


const Key = mongoose.model('Key', keySchema);
