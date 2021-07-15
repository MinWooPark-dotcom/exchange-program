// webSocket/server.js: socket.io 객체 만들고 클라이언트가 소켓 붙을 때 쿼리로 token 받음.(userId 값임)
// 웹소켓도 미들웨어 가능해서 socket 객체에 token 넣어놓고 initSocket 실행 시 token(userId)으로 join함(특정 룸에 들어가 해당 소켓이랑만 소통)
'use strict';

const model = require('../common/models')
const redisCtrl = require('../common/modules/redisCtrl');
const { sendDataToUser } = require('./logic/socket');
const { initSocket, middleware } = require('./logic/connector')
const SocketIO = require('socket.io')
const express = require('express');
const app = express();
const serverPort = 3003; // 웹소켓 연결 요청을 받아들이는 곳에서는 어떤 연결 요청(일반적으로 포트 번호로 식별)을 받아들일 것인지를 미리 시스템에 등록
const server = require('http').createServer(app);

// const io = SocketIO(server, {
//     cors: {
//         origin: "http://localhost:3001",
//         methods: ["GET"]  // 클라이언트 핸드쉐이킹 요청 시 GET 메서드 사용
//     },
// });

const io = SocketIO(server);
io.sockets.use(middleware); // 미들웨어를 통해 어떤 클라이언트 소켓이 붙었는지 구분 가능.
io.sockets.on('connection', async function (socket) {
    await initSocket(socket);
});

(async () => {
    await model.syncAllDB()
    // 우리 프로젝트 주키퍼 사용 이유는 코인 버틀러가 웹, 앱 모두 로그인이 가능하기 떄문에 접속한 IP가 다를 수 있음.
    // 그래서 'registInternalSocketUser'함수 보면 Znode여부를 확인하고 없으면 주키퍼에 인터널소켓에 어떤 유저가 들어왔는지 등록해줌.
    // 그리고 getChildren을 통해서(주키퍼는 디렉토리 구조) 하위 znode를 가져올 수 있음.
    // 'getUserConnectedInternalSocket' 함수에 상위 노드인 userId를 넣으면 하위 znode를 가져올 수 있고 이게 internalSocketList가 됨.
    // internalSocketList에서 접속한 유저를 찾고 레디스를 통해서 데이터를 보내줌.
    // 현재 프로젝트에서는 serverIp가 필요하진 않음.
    server.listen(serverPort, async () => {
        console.log('Server Up and Running at %s port', serverPort);
        await redisCtrl.listenQueue(`ojt:socket:internal`, sendDataToUser)  // 이게 프로그램 내내 도는 지 체크
    });
})();

module.exports = io;