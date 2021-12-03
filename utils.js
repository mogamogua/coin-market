const crypto = require('crypto');
const axios = require('axios');
const User = require('./models/User');
const Coin = require('./models/Coin');

const encryptPassword = (password) => {
  return crypto.createHash('sha512').update(password).digest('base64');
}


const setAuth = async(req, res, next) => {
  const authorization = req.headers.authorization;
  const [bearer, key] = authorization.split(' ');
  if(bearer !== 'Bearer')
    return res.send({error: 'Wrong Authorization'}).status(400);

  const user = await User.findOne({key});

  if (!user)
    return res.send({error: 'Cannot find user'}).status(404);

    req.user = user;
    return next();
  }

  const checkCoinPrice = async (req, res) => {
    const coinName = req.params.coin_name;
    const activeCoinsData = await Coin.find({isActive: true});
    const activeCoinsName = activeCoinsData.map((coin) => (coin.name));
    const activeCoinName = activeCoinsName.find((activeCoin) => (activeCoin == coinName));
    if (activeCoinName) {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinName}&vs_currencies=usd`;
        const apiRes = await axios.get(url);
        const price = apiRes.data[coinName].usd;
        res.send({price}).status(200);
    } else {
      res.send({error: 'you can only check the price of bitcoin, dogecoin, ripple and etherium'}).status(400);
    }
  }

module.exports = {
  encryptPassword,
  setAuth,
  checkCoinPrice,
}