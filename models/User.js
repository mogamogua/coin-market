const mongoose = require('mongoose');
const { Schema } = mongoose;
const crypto = require('crypto'); //비밀번호 암호화 위해 사용
const Key = require('./Key');


const userSchema = new Schema({
  name: String,
  email: {type: String, unique: true },//email 중복여부:중복되었을 경우 에러를 띄워준다.
  password: String,
  keys: [{type: Schema.Types.ObjectId, ref: 'Key'}],
  assets: [{type: Schema.Types.ObjectId, ref: 'Asset'}], //고유한 id를 가지게됨. Asset이란 모델을 참고하여 만듦.
  // 배열에 담는다 -> 한 유저가 여러 개의 asset을 가질 수 있다.
});

//key생성해서 user.keys 배열에 넣기, key모델 저장하기
userSchema.methods.generateKey = async function() {
  let originKeys = this.keys;
  let newKeyStr = crypto.createHash('sha512').update(crypto.randomBytes(20)).digest('base64');
  let newKey = new Key({key: newKeyStr, user: this});
  this.keys = [...originKeys, newKey];
  await this.save();
  await newKey.save();
  return newKeyStr;
}

const User = mongoose.model('User', userSchema);
module.exports = User;