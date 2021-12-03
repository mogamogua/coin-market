const express = require('express');
const { body, validationResult } = require('express-validator'); //입력값 validation check위해 사용
const crypto = require('crypto'); //비밀번호 암호화 위해 사용
const mongoose = require('mongoose');
const axios = require('axios');
const {encryptPassword, setAuth, checkCoinPrice } = require("./utils");//자주 쓰는 함수 utils에서 미리 정의하여 가져와 사용
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
  const coinName = coins.map((coin) => (coin.name));
  res.send(coinName);
})

//회원가입
//TODO: validation check
//(1) name을 aphanumeric한 4~12글자 입력받기 O
//(2) email을 100자 이하로 받기(이메일형식으로) O
//(3) password 8~16글자 O
app.post('/register', 
  body('email', '이메일 형식을 확인해주세요.').isEmail({min:1, max: 100}), //express-validator에서 가져온 body
  body('name', '4~12자 사이의 이름을 입력해주세요.').isLength({min:4, max:12}),
  body('password', '8~16자 사이의 비밀번호를 입력해주세요.').isLength({min:8, max:16}),
  async(req, res) => {
    const errors = validationResult(req).errors;
    if (Object.keys(errors).length !== 0) { //error가 비어있지 않으면 = 존재하면 400 bad request를 보내준다.(validation문제니까)
      let messages = errors.map(error => error.msg)  
      return res.status(400).json({ errors: messages });
    }

    const { name, email, password } = req.body; //request로 넘어온 body에 있는 name, email, password를 destructuring해서 변수에 저장
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
  //key는 user당 여러개 생성된다. =>  배열로 저장
  const key = await user.generateKey();
  console.log(key);
  // await user.save();

  res.send({key: key}).status(200);
})

//user authorization이 필요한 balance조회
app.get('/balance', setAuth, async (req, res) => {
  //setAuth가 실행되면서 req.user에 찾은 user가 담긴다.
  //setAuth에서 에러가 발생하지 않으면 async 콜백함수가 실행되면서 해당 유저의 Asset을 찾게된다.
  const user = req.user;

  const assets = await Asset.find({user});
  validAsset = assets.filter((asset) => (asset.balance > 0))
  const name = validAsset.map((asset) => (asset.name));
  const balance = validAsset.map((asset) => (asset.balance));
  const result = validAsset.map((asset) => (`${asset.name} : ${asset.balance}`))
  res.send({result}).status(200);
})

//코인 시세 확인
// ### [] /coins/:coin_name
app.get('/coins/:coin_name', setAuth, async(req, res) => {
  const price = await checkCoinPrice(req, res);
  res.send({price}).status(200); 
})


// request
// - quantity: number. 소수점 4번째 자리까지.

// response
// 구매결과를 리턴한다.
// - {price: 30000, quantity: 1}
// - 구매불가능한 quantity 입력 시 에러(400) 리턴

app.post('/coins/:coin_name/buy', setAuth, async(req, res) => {
  // console.log(`request user ${req.user}`)
  const user = req.user;
  // console.log(user)  //로그인 된 유저정보 가져온다
  const price = await checkCoinPrice(req, res); //prams에 입력된 name의 코인 시세조회
  const assets = await Asset.find({user}); //해당 유저의 지갑가져오기
  // console.log(assets, 'assets');
  let usdAsset = await Asset.find({name: 'USD'});//해당 유저의usd지갑가져오기
  let balance = await usdAsset[0].balance; //usd잔고
  // console.log(usdAsset[0]._id);
  const {quantity} = req.body //quantity는 사용자가 사려고 하는 코인수량
  //todo (1) quantity는 Number, 소수점 4자리까지 받는다.
  const totalPrice = quantity * price;
  const myAsset = Asset.find({_id: usdAsset[0]._id});
  // console.log(myAsset);
  //todo(2) 잔고보다 높은 수량 사려는 경우 에러핸들링
  if (balance < totalPrice) {
    res.send({error: 'Entered quantity is out of your budget!'}).status(400);
  } else {
    let newBalance = balance - totalPrice;
    Asset.updateOne({_id: usdAsset[0]._id},{$set: {balance: newBalance}});
    res.send({price: totalPrice, quantity: quantity}).status(200)
    // .catch((error) => (res.send({error: error}).status(400)))
    // );
    // todo(3) 해당 유저 usd지갑에 잔고 변경되었는지 확인필요
  }
})


app.listen(port, () => {
  console.log(`listening at port : ${port}...`);
})