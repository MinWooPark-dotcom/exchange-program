/** 데이터 주고 받을 때 auth, error,  등 핸들링해야 할 것들 작성하는 곳 **/
"use strict";

const { redisCtrl } = require('../../common')
const {DatabaseError} = require('sequelize');
const {ParameterError} = require('../../common/modules/error')
const { USER_SESSION_EXPIRE_TIME } = require('../../common/enum')
const model = require("../../common/models");

const passedUrlList = [
    '/signIn',
    '/signUp',
];

exports.validateParameter = (checkArray, parameters) => {
    const parmeterKeys = Object.keys(parameters);
    for (const key of checkArray) {
        if (!parmeterKeys.includes(key) || !parameters[key]) {
            console.log('parmeterKeys',parmeterKeys)
            console.log('key', key)
            throw new ParameterError();
        }
    }
}

exports.authHandler = async (req, res, next) => {
    try {
        // 이 부분들이 있어야 session 만료 시 에러 발생시킴, token이 있으면 signInByToken, 없으면 signInByEmailAndPassword 실행
        if(passedUrlList.includes(req.url.split('?')[0])) {
            return next();
        }
        /** get할 때 여기서 에러남, 왜 레디스에 유저세션이 없지? **/
        console.log('req.headers[token]', req.headers['token'])
        let userData = await redisCtrl.getUserSession(req.headers['token']);
        if(!userData) throw new Error('AuthToken Expired'); // 만료되거나 로그인 자체를 안해서 토큰이 없거나
        const userModel = model['User'].build(userData);
        req.user = userModel; // req.user 넣어둔 것으로 라우터에서 유저 정보 접근
        await redisCtrl.setUserSession(req.headers['token'], userData, USER_SESSION_EXPIRE_TIME);
        next(); // 여기서 멈춰버림
    }
    catch (e) {
        next(e);
    }
}

// app.js에서 마지막 미들웨어에 errorHandler 함수 넣어서 사용
// modules/error.js에서 각 에러 클래스 가져와서 사용
exports.errorHandler = async (result, req, res, next) => {
    // 에러가 아니고 응답 상태 값이 있다면 json()으로 보냄
    if (!(result instanceof Error) && result['status']) {
        return await res.json(result);
    }

    // * 피드백: DatabaseError가 왜 400인지? => api 요청 시 잘못된 userId나 itemId를 넣으면 sequelize에서 쿼리를 할 때 에러가 나기 때문에,
    // 클라이언트 에러라고 생각했는데 그건 파라미터 체크해서 에러를 내야함. DatabaseError는 서버 자체 에러가 맞으니 500임.
    // * 2차 피드백: 코인버틀러에서 404 아닌 것들은 400으로 하기로 약속해 두었기 떄문에 400으로 한 것임.
    if(result instanceof  DatabaseError) {
        const returnForm = {
            status: "fail",
            code: result.parent.routine
        };
        return await res.status(400).json(returnForm) // returnForm객체를 못 받음
        /** 피드백: 500은 Internal Server Error, 서버 죽었을 때 **/
    }

    // throw new Error('에러 메세지')로 에러 핸들링한 부분
    if (!result.code && result instanceof Error) {
        const returnForm = {
            status: "fail",
            code: result.message
        };
        return await res.status(400).json(returnForm);
    }
    2
    // error 클래스 상속받아서 만든 클래스 사용 시
    if (result instanceof Error) {
        // 위에서 특수한 에러들 조건문으로 확인하고 나머지 기본적인 에러
        const returnForm = {
            status: "fail",
            code: result.code
        };
        return await res.status(400).json(returnForm);
    }
}
