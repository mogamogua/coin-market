const express = require("express");
const { body, validationResult } = require("express-validator"); //입력값 validation check위해 사용
const crypto = require("crypto"); //비밀번호 암호화 위해 사용
const mongoose = require("mongoose");
const axios = require("axios");
const { encryptPassword, setAuth, checkCoinPrice } = require("./utils"); //자주 쓰는 함수 utils에서 미리 정의하여 가져와 사용
//모델들을 가져온다
const { User, Coin, Asset, Key } = require("./models");
const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//active한 coin들 response
app.get("/coins", async (req, res) => {
  const coins = await Coin.find({ isActive: true });
  const coinName = coins.map((coin) => coin.name);
  return res.send(coinName);
});

//회원가입
//TODO: validation check
//(1) name을 aphanumeric한 4~12글자 입력받기 O
//(2) email을 100자 이하로 받기(이메일형식으로) O
//(3) password 8~16글자 O
app.post(
  "/register",
  body("email", "이메일 형식을 확인해주세요.").isEmail({ min: 1, max: 100 }), //express-validator에서 가져온 body
  body("name", "4~12자 사이의 이름을 입력해주세요.").isLength({
    min: 4,
    max: 12
  }),
  body("password", "8~16자 사이의 비밀번호를 입력해주세요.").isLength({
    min: 8,
    max: 16
  }),
  async (req, res) => {
    const errors = validationResult(req).errors;
    if (Object.keys(errors).length !== 0) {
      //error가 비어있지 않으면 = 존재하면 400 bad request를 보내준다.(validation문제니까)
      let messages = errors.map((error) => error.msg);
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
        password: encryptedPassword
      });
      await user.save();
      //가입 시 10000달러 주기
      const usdAsset = new Asset({ name: "USD", balance: 10000, user: user }); //가입시 해당 유저에게 10000usd달러를 준다.
      await usdAsset.save();

      const coins = await Coin.find({ isActive: true }); //active가 true인 애들을 가지고 user의 지갑을 만들어준다.
      for (const coin of coins) {
        const asset = new Asset({
          name: coin.name,
          balance: 0,
          user: user
        });
        await asset.save();
      }

      return res.send({ success: "successfully registered" }).status(200);
    } catch (err) {
      return res.send({ error: "email is duplicated" }).status(400);
    }
  }
);

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  //email과 password의 validation체크 필요
  const encryptedPassword = encryptPassword(password);
  const user = await User.findOne({ email, password: encryptedPassword });

  if (user === null)
    return res
      .json({ error: "please check your email or password" })
      .status(400);
  //key생성해서 user에 저장한다.
  //key는 user당 여러개 생성된다. =>  배열로 저장
  const key = await user.generateKey();
  console.log(key);
  // await user.save();

  return res.send({ key: key }).status(200);
});

//user authorization이 필요한 balance조회
app.get("/balance", setAuth, async (req, res) => {
  //setAuth가 실행되면서 req.user에 찾은 user가 담긴다.
  //setAuth에서 에러가 발생하지 않으면 async 콜백함수가 실행되면서 해당 유저의 Asset을 찾게된다.
  const userId = await req.userId;
  const assets = await Asset.find({ user: userId });
  const validAsset = assets.filter((asset) => asset.balance > 0);
  console.log(validAsset);
  const result = validAsset.map((asset) => `${asset.name} : ${asset.balance}`);
  res.send({ result }).status(200);
});

//코인 시세 확인
// ### [] /coins/:coin_name
app.get("/coins/:coin_name", setAuth, async (req, res) => {
  const price = await checkCoinPrice(req, res);
  return res.send({ price }).status(200);
});

//구매하려는 코인 quantity는 소수점 4자리로 제한. usd잔고는 소수점 제한 없음 -> price계산에선 4자리 제한 필요없다
app.post(
  "/coins/:coin_name/buy",
  setAuth,
  body("quantity", "숫자만 입력해주세요").isNumeric(),
  async (req, res) => {
    const errors = validationResult(req).errors;
    if (Object.keys(errors).length !== 0) {
      //error존재하면 400 bad request를 보내준다.(validation문제니까)
      let messages = errors.map((error) => error.msg);
      return res.status(400).json({ errors: messages });
    }
    const { quantity } = await req.body; //quantity는 사용자가 사려고 하는 코인수량 string type.
    //todo (1) quantity는 Number, 소수점 4자리까지 받는다.
    const numberedQuantity = Number(parseFloat(quantity).toFixed(4)); //quantity 소수점 4자리까지 만들기
    if (numberedQuantity !== Number(quantity)) {
      // 1.0000과 1비교할 땐 true, 1.231432와 1.2314비교할 땐 false
      //소수점 4자리넘게 입력한 경우.
      return res
        .send({ error: "소수점 4자리까지 입력 가능합니다." })
        .status(400);
    }

    //제대로입력한경우
    const userId = req.userId; //로그인 된 유저id 가져온다
    const price = await checkCoinPrice(req, res); //prams에 입력된 name의 코인 시세조회
    const [asset] = await Asset.find({ name: "USD", user: userId }); //해당 유저의 usd지갑가져오기
    const balance = await asset.balance; //usd잔고
    const totalPrice = numberedQuantity * price;
    //todo(2) 잔고보다 높은 수량 사려는 경우 에러핸들링
    if (balance < totalPrice) {
      return res
        .send({ error: "Entered quantity is out of your budget!" })
        .status(400);
    } else {
      let newBalance = balance - totalPrice;
      await Asset.findOneAndUpdate({ _id: asset._id }, { balance: newBalance }); //await안붙여주면 반영안된당.. 삽질두시간
      // todo(3) 유저가 구매한 코인지갑 + 수량
      const [coinAsset] = await Asset.find({
        name: req.params.coin_name,
        user: userId
      });
      const coinQuantity = coinAsset.balance + numberedQuantity;
      await Asset.findOneAndUpdate(
        { name: req.params.coin_name, user: userId },
        { balance: coinQuantity }
      );

      return res
        .send({ price: totalPrice, quantity: numberedQuantity })
        .status(200);
      // todo(4) 해당 유저 usd지갑에 잔고 변경되었는지 확인필요 - 변경된다
    }
  }
);

//코인 전량 구매하기
app.post(
  "/coins/:coin_name/buyAll",
  setAuth,
  body("all", "true 혹은 false값을 입력해주세요").isBoolean(),
  async (req, res) => {
    const errors = validationResult(req).errors;
    if (Object.keys(errors).length !== 0) {
      //error존재하면 400 bad request
      let messages = errors.map((error) => error.msg);
      return res.status(400).json({ errors: messages });
    }
    const { all } = req.body; //request body의 all
    if (all) {
      //all이 true라면
      const userId = req.userId; //로그인 된 유저id 가져온다
      const [asset] = await Asset.find({ name: "USD", user: userId }); //해당 유저의 usd지갑가져오기
      const balance = await asset.balance; //해당 유저의usd잔고
      if (balance > 0) {
        const price = await checkCoinPrice(req, res); //prams에 입력된 name의 코인 시세조회
        const allQuantity = Number((balance / price).toFixed(4)); //구매할 수 있는 수량 4자리까지 제한
        const totalPrice = allQuantity * price; //총 구매 가격
        console.log(balance, "balance");
        console.log(totalPrice, "totalPrice");
        const newBalance = balance - totalPrice; //전량구매 후 usd잔고
        console.log(newBalance, "newBalance");
        await asset.updateOne({ balance: newBalance }); // usd잔고 변경
        await Asset.findOneAndUpdate(
          { name: req.params.coin_name, user: userId },
          { balance: allQuantity }
        );
      } else {
        //전량 구매하려는 개별 코인 가격이 잔고보다 클 때
        res.send({ error: "you are broken" }).status(400);
      }
    } else {
      res.send({ error: "all : true만 가능합니다" }).status(400);
    }
  }
);

//코인 판매하기
app.post(
  "/coins/:coin_name/sell",
  setAuth,
  body("quantity", "숫자만 입력 가능합니다").isNumeric(),
  async (req, res) => {
    const errors = validationResult(req).errors;
    if (Object.keys(errors).length !== 0) {
      //error존재하면 400 bad request를 보내준다.(validation문제니까)
      let messages = errors.map((error) => error.msg);
      return res.json({ errors: messages }).status(400);
    }
    const { quantity } = await req.body; //quantity는 사용자가 팔고자 하는 코인수량
    const numberedQuantity = Number(parseFloat(quantity).toFixed(4)); //quantity 소수점 4자리까지 만들기
    if (numberedQuantity !== Number(quantity)) {
      // 1.0000과 1비교할 땐 true, 1.231432와 1.2314비교할 땐 false
      //소수점 4자리넘게 입력한 경우.
      return res
        .send({ error: "소수점 4자리까지 입력 가능합니다." })
        .status(400);
    }

    const userId = req.userId; //로그인 된 유저id 가져온다
    const price = await checkCoinPrice(req, res); //prams에 입력된 name의 코인 시세조회
    const [usdAsset] = await Asset.find({ name: "USD", user: userId }); //해당 유저의 usd지갑가져오기
    const usdBalance = await usdAsset.balance; //usd잔고
    const totalPrice = Number(parseFloat(numberedQuantity * price).toFixed(4));
    const [coinAsset] = await Asset.find({
      name: req.params.coin_name,
      user: userId
    }); //팔려고하는 코인 지갑

    //todo(2) 가지고있는 코인 수보다 더 큰 수를 입력한 경우
    if (numberedQuantity > coinAsset.balance) {
      return res
        .send({ error: "Entered quantity is out of your balance!" })
        .status(400);
    } else {
      let newQuantity = parseFloat(
        coinAsset.balance - numberedQuantity
      ).toFixed(4);
      await coinAsset.updateOne({ balance: newQuantity }); // 판매 개수만큼 balance에서 차감
      // todo(3) 코인가격 x 개수 만큼 usd지갑에 넣어주기
      const newUsdBalance = usdBalance + totalPrice;
      await usdAsset.updateOne({ balance: newUsdBalance });
      //  await Asset.findOneAndUpdate({_id: asset._id, name: 'USD'},{balance: balance + totalPrice})

      return res
        .send({ price: totalPrice, quantity: numberedQuantity })
        .status(200);
      // todo(4) 해당 유저 usd지갑에 잔고 변경되었는지 확인필요 - 변경된다
    }
  }
);

//코인 전량 판매하기
app.post(
  "/coins/:coin_name/sellAll",
  setAuth,
  body("all", "true 혹은 false값을 입력해주세요").isBoolean(),
  async (req, res) => {
    const errors = validationResult(req).errors;
    if (Object.keys(errors).length !== 0) {
      //error존재하면 400 bad request
      let messages = errors.map((error) => error.msg);
      return res.status(400).json({ errors: messages }); //isBoolean에 걸리는 에러
    }
    const { all } = req.body; //request body의 all
    if (all) {
      //all이 true라면 전량 판매가능
      const userId = req.userId; //로그인 된 유저id 가져온다
      const [coinAsset] = await Asset.find({
        name: req.params.coin_name,
        user: userId
      });
      console.log(`coinAsset.balance ${coinAsset.balance}`);
      if (coinAsset.balance > 0) {
        //팔려고 하는 코인 잔고가 있을 때
        const price = await checkCoinPrice(req, res); //params에 입력된 name의 코인 시세조회
        const income = coinAsset.balance * price;
        const [usdAsset] = await Asset.find({ name: "USD", user: userId }); //해당 유저의 usd지갑가져오기
        const newBalance = usdAsset.balance + income;
        await usdAsset.updateOne({ balance: newBalance }); //usdAsset에 판매한 가격만큼 넣어주기
        await coinAsset.updateOne({ balance: 0 }); //판매한 코인 지갑 수량 0으로만들기
        return res.send({ price: income, quantity: coinAsset.balance });
      } else {
        return res
          .send({ error: "you don't have any coin to sell." })
          .status(400);
      }
    } else {
      return res.send({ error: "all : true만 가능합니다" }).status(400);
    }
  }
);

app.listen(port, () => {
  console.log(`listening at port : ${port}...`);
});
