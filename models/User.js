const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  name: String,
  email: {type: String, unique: true },//email 중복여부:중복되었을 경우 에러를 띄워준다.
  password: String,
  key: [{type: Schema.Types.ObjectId, ref: 'Key'}],
  assets: [{type: Schema.Types.ObjectId, ref: 'Asset'}], //고유한 id를 가지게됨. Asset이란 모델을 참고하여 만듦.
  // 배열에 담는다 -> 한 유저가 여러 개의 asset을 가질 수 있다.
});

userSchema.methods.generateKey = async function() {
  this.key = crypto.createHash('sha512').update(crypto.randomBytes(20)).digest('base64');
  await this.save();
  return this.key();
}

const User = mongoose.model('User', userSchema);

module.exports = User;