const crypto = require('crypto');
const axios = require('axios');
const User = require('./models/User');
const Coin = require('./models/Coin');
const Key = require('./models/Key');

const encryptPassword = (password) => {
  return crypto.createHash('sha512').update(password).digest('base64');
}


const setAuth = async(req, res, next) => {
  const authorization = req.headers.authorization;
  const [bearer, key] = authorization.split(' ');
  if(bearer !== 'Bearer')
    return res.send({error: 'Wrong Authorization'}).status(400);

  // const user = await User.find(user => user.keys.includes(key));
  const myKey = await Key.find({key}); //받은 key로 Key모델에서 일치하는 키 찾기
  const user = myKey[0].user; //그 키의 user정보가져오기 - 받은 key와 연결된 유저를 찾았당
  
  if (!user)
    return res.send({error: 'Cannot find user'}).status(404);

  req.user = user;
  return next();
  }

  const checkCoinPrice = async (req, res) => {
    const coinName = req.params.coin_name;//거래하려는 코인 이름가져오깅
    //거래하려는 코인이 active한 코인인지 확인하기 위한 과정
    const activeCoinsData = await Coin.find({isActive: true}); //active한 코인 정보들을 가져온다.
    const activeCoinsName = activeCoinsData.map((coin) => (coin.name)); //active한 코인 이름만 가져온다.
    //request의 코인네임과 일치한게 있는지 찾는다.
    const activeCoinName = activeCoinsName.find((activeCoin) => (activeCoin == coinName));
     //find없으면 fasly한 값 return하니까 if문으로 처리
    if (activeCoinName) {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinName}&vs_currencies=usd`;
        const apiRes = await axios.get(url);
        const price = apiRes.data[coinName].usd; //usd기준의 가격만 가져온다.
        //price를 리턴한다
        return price;
    } else {
      res.send({error: 'you can only check the price of bitcoin, dogecoin, ripple and etherium'}).status(400);
    }
  }

module.exports = {
  encryptPassword,
  setAuth,
  checkCoinPrice,
}