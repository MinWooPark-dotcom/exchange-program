/** 레디스 관련 함수 작성 **/
'use strict'

const config = require('../modules/config')
const asyncRedis = require('async-redis');  // 버전 확인, 우리 버전 1.1.7버전은 에러 안나는데 최신 버전에서는 에러 있었음(정확히 어떤 에러인지 기억 안 남)
/** 서버 하나에 클라이언트가 여러 개가 붙는다는 서버 기본 생각하기, 그렇기에 클라이언트가 두 개 따로임. **/
const excClient = asyncRedis.createClient(config.redis.base_info); // host, port, db를 넣음,
const listenClient = asyncRedis.createClient(config.redis.base_info); // host, port, db를 넣음,

excClient.on('connect', (ready) => {
    console.log("Connected Redis - Execute Client");
});

excClient.on('error', (err) => {
    console.log(err)
});

listenClient.on('connect', () => {
    console.log("Connected Redis - Listen Client");
})

listenClient.on('error', (err) => {
    console.log(err)
});

/** signIn 할 때 유저 세션 생성 **/
const setUserSession = async (authToken, data, expireTime, sessionType='connection') => {
    const inputData = (typeof data == 'object') ? JSON.stringify(data) : data;
    // set(키, 값, EX(expire), 초 단위 시간) 할 때 키를 ':'로 구분하면 깊이가 생김(디렉토리 구조)
    // console.log('redisCtrl.js set완료')
    return await excClient.set(`user_session:${sessionType}:${authToken}`, inputData, 'EX', expireTime); // 지정한 시간 이후에 데이터 지워짐: EX <초 단위 지정>
};
exports.setUserSession = setUserSession

const getUserSession = async function (authToken, sessionType='connection') {
    let data;
    try {
        data = await excClient.get(`user_session:${sessionType}:${authToken}`);
    }
    catch (e) {
        console.log(e);
    }

    if(data) {
        if(data.startsWith('{') || data.startsWith('[')) {
            return JSON.parse(data);
        }
    }
    return data;
};

exports.getUserSession = getUserSession;

const delUserSession = async (authToken, sessionType='connection') => {
    return await excClient.del(`user_session:${sessionType}:${authToken}`);
};
exports.delUserSession = delUserSession;

/** pushQueue, apiServer에서 응답으로 주었던 데이터들을 레디스로 넣고 웹소켓을 통해 서버에서 클라이언트로 보낼 것임. 각 라우터에서 사용 **/
// rpush key value
const pushQueue = async (path, data) => {
    // return await excClient.rpush(path, data); //
    return await excClient.rpush(path, data).catch(async (err) => {
        console.log(err);
        // return await pushQueue(path);
    });
}
exports.pushQueue = pushQueue;


/** listenQueue, pushQueue 한 거 blpop으로 빼서 사용. 이 함수는 웹소켓에서 사용 **/
// blpop key timeout, 리턴 값은 [key, value] // 타임아웃이 0이면 데이터가 들어올 때 까지 기다림

const listenQueue = async (path, callback) => {
    // let [queueName, result] = await listenClient.blpop(path, 0);
    let [queueName, result] = await listenClient.blpop(path, 0).catch(async(err) => {
        console.log(err);
        return await listenQueue(path, callback); // 리슨 큐는 프로그램 도는 동안 계속 실행되어야 하기 떄문에 재귀로 무한 반복
    });
    callback(result)
    return await listenQueue(path, callback);  // 리슨 큐는 프로그램 도는 동안 계속 실행되어야 하기 떄문에 재귀로 무한 반복
};
exports.listenQueue = listenQueue;