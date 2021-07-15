'use strict'

//! routes: 모든 응답은 success로 응답, 데이터는 웹소켓으로
const express = require("express");
const router = express.Router();
const model = require("../../common/models");
const {ParameterError, SessionError, SameAsPrevNickname, SameAsPrevPassword, InvalidPasswordError} = require('../../common/modules/error')
const {authHandler, validateParameter} = require("../handler/packetHandler");
const { redisCtrl, utils } = require('../../common')
const { USER_SESSION_EXPIRE_TIME } = require('../../common/enum')
const {randomString} = utils;

// 캡슐화. 왜? 파라미터가 2개 이상이면 너무 길어짐 req.body.email, req.body.password ... 이렇게 하는 것보다 미리 만들어두면 편하니까
const requiredKeyMap = {
  signUp: ["email", "password", "nickname"],
  signIn: ["email", "password"],
  modifyUserInformation: ["userId", "password", "newNickname"],
  updatePassword: ["userId", "prevPassword", "newPassword"],
};

router.use(authHandler);

//! POST/signup
// 중복 검사 로직 추가
router.post("/signUp", async (req, res, next) => {
  try {
    const {email, password, nickname} = req.body;
    const checkArray = requiredKeyMap['signUp'];
    validateParameter(checkArray, {email, password, nickname});
    // 아이디 중복 검사
    await model["User"].validateEmail(email);
    // 닉네임 중복 검사
    await model["User"].validateUserNickName(nickname);
    // 유저 인스턴스 생성
    const user = await model["User"].makeNew({email, password, nickname});
    await user.save();
    // 가입 시 물건 랜덤 10개 지급
    await model["Item"].generateItems(user.id);
    return await next({status: "success"});
  } catch (e) {
    next(e);
  }
});

//! POST/signIn
router.post("/signIn", async (req, res, next) => {
  try {
    let userModel, token;
    if(req.body.token || req.headers.token) {
      token = req.body.token || req.headers.token;
      userModel = await model['User'].signInByToken(token);
    } else {
      const {email, password} = req.body;
      const checkArray = requiredKeyMap["signIn"];
      validateParameter(checkArray, {email, password});
      token = randomString();
      userModel = await model["User"].signInByEmailAndPassword(email, password);
    }
    await redisCtrl.setUserSession(token, userModel, USER_SESSION_EXPIRE_TIME);
    // console.log('set 완료')
    return await next({status: 'success', token:token, user: userModel.convertInfoForm()});
  } catch (e) {
    next(e);
  }
});

//! POST/logout
router.post("/logOut", async (req, res, next) => {
  try {
    await redisCtrl.delUserSession(req.headers['token']);
    return await next({status: "success"});
  } catch (e) {
    next(e);
  }
});

module.exports = router;
