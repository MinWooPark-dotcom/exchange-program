// connector.js 파일의 존재 이유: 클라이언트에서 소켓에 붙어서 서버의 connection 이벤트가 실행됬을 때 실행할 로직을 작성하는 파일
'use strict'

const model = require('../../common/models')
const redisCtrl = require('../../common/modules/redisCtrl')
const {CONVERT_INTEGER_VALUE} = require('../../common/enum');
const userSocketMap = {};

const middleware = async (socket, next) => {
    const token = socket.handshake.query.token;
    const userSession = await redisCtrl.getUserSession(token)
    if (userSession) {
        socket.token = token;
        socket.userId = userSession.id;
        socket.nickname = userSession.nickname;
        return next();
    }
    next(new Error('Invalid token'));
}

/** 웹소켓 커넥션 되면 실행, 소켓은 이벤트 기반으로 작동, 커넥션 붙으면 리턴되는 소켓 객체는 각각 하나의 클라이언트임 **/
async function initSocket(socket) {
    try {
        socket.join(socket.userId) // room에 접속
        const req = socket.request; // 요청 객체에 접근
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress; // XFF헤더, 클라이언트 ip를 알아내는 대표적인 방법
        console.log('새로운 클라이언트 접속, ip', ip);

        /** 소켓 미들웨어에서 얻은 유저세션으로 socket.userId에 userSession.id 값을 담음.은 근데 웹소켓 server.js에서 getUserSession이 값을 못 구하니까 여기 로직은 user 구하는 거부터 안 됨.**/
        const user = await model['User'].findByPk(socket.userId)
        const items = await model['Item'].findAll({where: {userId: socket.userId}, attributes:[['id', 'itemId'], 'itemName', 'ability', 'status']}); // form 만들기,
        const saleList = await model['Market'].findAll({
            include: [
                {
                    model: model['Item'],
                    attributes: ['id', 'itemName', 'ability', 'status'],
                },
                {
                    model: model['User'],
                    attributes: ["nickname"],
                },
            ],
            where: {
                status: 'ONGOING'
            },
        });
        const convertFormSaleList = [];
        for(const saleItem of saleList) {
            // console.log('saleItem', saleItem)
            convertFormSaleList.push(await saleItem.convertInfoForm());
        }

        /** 특정 클라이언트를 찾기 위해 in을 사용하는건데 여긴 이미 '특정' 소켓임. 그래서 필요가 없고 안되는 거임.
         * parseFloat() 함수는 문자열을 분석해 부동소수점 실수로 반환합니다.
         * toFixed() 메서드는 숫자를 고정 소수점 표기법으로 표기해 반환합니다.**/

        /** 1. user.balance를 원래대로 만들기 위해 CONVERT_INTEGER_VALUE으로 나눔.
         * 2. 나눈 값을 소수점 표기한 문자열로 반환 => x.xxx
         * 3. parseFloat로 문자열을 실수로 반환 **/
        socket.emit('ojt:balance', {data: {coin: parseFloat((user.balance/CONVERT_INTEGER_VALUE).toFixed(3))}, snapshot: true})  // ojt 화폐단위 coin
        socket.emit('ojt:items', {data: {itemList:items}, snapshot: true})  // items로 주는 정보: id, ItemName, ability, status
        socket.on('disconnect', () => {
            delete socket.userId; // 왜 소켓의 userId를 지우나, 어차피 연결 끊기면 socket객체는 사라지는게 아닌가?
            delete userSocketMap[socket.userId]
            console.log('클라이언트 접속 해제', ip, socket.id);
            socket.leave(socket.id) // 연결이 끊기면 자동으로 방에서 나가지만, 확실히 나가기 위해 추가한 코드
        })
    }
    catch (e) {
        console.log(e);
    }
}

exports.initSocket = initSocket;
exports.middleware = middleware;
exports.userSocketMap = userSocketMap;