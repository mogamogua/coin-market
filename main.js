const express = require('express');
const { body, validationResult } = require('express-validator'); //입력값 validation check위해 사용
const crypto = require('crypto'); //비밀번호 암호화 위해 사용
const mongoose = require('mongoose');
const axios = require('axios');
const {encryptPassword, setAuth} = require("./utils");//자주 쓰는 함수 utils에서 미리 정의하여 가져와 사용
//모델들을 가져온다
const { User, Coin, Asset, Key } = require('./models');
const app = express();
const port = 3000;

app.use(express.urlencoded({extended: true}));
app.use(express.json());


//그냥 user모델과 coin모델 콘솔에 찍어보기
// app.get('/', async (req, res) => {
//   console.log(User, Coin);
//   res.send('hello');
// })

//active한 coin들 response
app.get('/coins', async(req, res) => {
  const coins = await Coin.find({isActive: true});
  res.send(coins);
})

//회원가입
//TODO: validation check
//(1) name을 aphanumeric한 4~12글자 입력받기
//(2) email을 100자 이하로 받기(이메일형식으로)
//(3) password 8~16글자
app.post('/register', 
  body('email').isEmail(), //express-validator에서 가져온 body
  body('name').isLength({min:5}),
  body('password').isLength({min:8}),
  async(req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { //error가 비어있지 않으면 = 존재하면 400 bad request를 보내준다.(validation문제니까)
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body; //request로 넘어온 body에 있는 name, email, password를 destructuring해서 변수에 저장
    //const encryptedPassword = crypto.createHash('sha512').update(password).digest('base64');
    const encryptedPassword = encryptPassword(password); //utils에서 가져온 비밀번호암호화
    
    // body에서 가져온 name, email과 암호화한 비밀번호로 user생성.
    // let user = null;
    try {
      const user = new User({
        name: name, 
        email: email, 
        password: encryptedPassword,
      }) 
      await user.save();
      //가입 시 10000달러 주기
      const usdAsset = new Asset({name: 'USD', balance: 10000, user: user});//가입시 해당 유저에게 10000usd달러를 준다.
      await usdAsset.save();
      
      const coins = await Coin.find({isActive: true}); //active가 true인 애들을 가지고 user의 지갑을 만들어준다.
      for (const coin of coins) {
        const asset = new Asset({
          name: coin.name, 
          balance: 0, 
          user: user
        });
        await asset.save();
      }
      
      res.send({success: 'successfully registered'}).status(200);
    } catch (err) {
      return res.send({error: 'email is duplicated'}).status(400)
    }
  })

app.post('/login', async(req, res) => {
  const {email, password} = req.body;
  //email과 password의 validation체크 필요
  const encryptedPassword = encryptPassword(password);
  const user = await User.findOne({email, password: encryptedPassword})

  if (user === null)
    return res.json({error: 'please check your email or password'}).status(400);
  //key생성해서 user에 저장한다.
  user.key = [...user.key, encryptPassword(crypto.randomBytes(200))]; //key는 user당 여러개 생성된다. =>  배열로 저장
  await user.save();

  res.send({key: user.key}).status(200);
})

//user authorizaiton이 필요한 balance조회
app.get('/balance', setAuth, async (req, res) => {
  //setAuth가 실행되면서 req.user에 찾은 user가 담긴다.
  //etAuth에서 에러가 발생하지 않으면 async 콜백함수가 실행되면서 해당 유저의 Asset을 찾게된다.
  const user = req.user;

  const assets = await Asset.find({user});
  res.send(assets);
})

// app.post('/coin/:coinName/buy', setAuth, async(req, res) => {
//   const coinId = 'bitcoin';
//   const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
//   const apiRes = await axios.get(url);
//   const price = apiRes.data[coinId].usd;
//   const {quantity} = req.body;
// })


app.listen(port, () => {
  console.log(`listening at port : ${port}...`);
})