// socket.js 파일이란? server.js에서 listenQueue의 콜백함수, socket을 통해 서버에서 클라이언트로 데이터를 보내는 로직 작성
'use strict'

/** 특정 socket에 접근하여 emit해 줘야 함. 1. 소켓 채널 2. userMap **/

/** 웹소켓 예외 처리
 * 1. 파서로부터 dataType 잘못 받았을 때: default로 가서 break걸림
 * 2. 아이템 객체 못 찾을 때
 * 3. 유저 객체 못 찾을 때
 * 4. 판매 목록 객체 못 찾을 때 **/
const {CONVERT_INTEGER_VALUE} = require('../../common/enum');
const model = require('../../common/models')
// const {userSocketMap} = require('./connector') // userSocketMap 메모리는 한계가 있음 -> 웹소켓 채널 개념 공부 후 사용

const sendDataToUser = async (dataString) => {
    /** parser -> webSocket으로 보내는 데이터 규격화 하기
     * 우리 프로젝트: [dataType, userId, exchangeType, dataValue] = dataString.split('||');
     * 내 과제: [msgType, userId, dataValue] = dataString.split('||');
     **/
    const [dataType, userId, dataValue] = dataString.split('||'); // 여기를 통일하거나 각각 분리
    try {
        switch (dataType) {
            // case 'balance':
            //     await sendBalanceData(action, userId, dataValue);
            //     break;
            /** 1.경매에 물품 등록(, 경매가 이루어져서 종료됬을 때
             * Parser -> WebSocket: 'msgType||userId||itemId' **/
            case 'registerAuction' :
                await sendRegisteredItemData(dataType, userId, dataValue);
                break;
            /** 입찰 했을 때
             * Parser -> WebSocket: 'msgType||userId||itemId **/
            case 'basicOrder' :
                await sendBasicOrderData(dataType, userId, dataValue);
                break;
            //         /** 판매자에게 상위 입찰 알림 **/
            // case 'noticeNewBid':
            //     await sendBasicOrderData(dataType, userId, dataValue);
            //     break;
            //     /** 기존 입찰자에게 상위 입찰 알림 **/
            // case 'noticeCancelBid':
            //     await sendBasicOrderData(dataType, userId, dataValue);
            //     break;
            /** 즉시 구매 했을 때
             * Parser -> WebSocket: 'msgType||userId||marketId' **/
            case 'immediateOrder' :
                await sendImmediateOrderData(dataType, userId, dataValue)
                break;
            /** 경매 종료 1. 낙찰하여 마감 2. 입찰자 없이 마감 **/
            case 'closeAuction' :
                await sendCloseAuctionData(dataType, userId, dataValue);
                break;
            /** 경매 리스트 검색, 특정 물품 검색 **/
            case 'searchAuctionList':
                await sendAuctionListData(dataType, userId, dataValue);
                break;
            /** 경매 특정 물품 검색시 아이템 풀네임 없을 때 **/
            case 'searchAuctionListUndefined':
                await sendAuctionListUndefinedData(dataType, userId, dataValue);
                break;
            /** 에러 발생 시**/
            case 'error' :
                /** ojt:socket:internal로 push하는 에러들이 'action||dataType||userId||dataValue' 형태로 들어가야 함 **/
                // action에 fail, userId는 userId, dataValue에 에러 메시지
                await sendErrorMessage(dataType, userId, dataValue); // fail, userId, code
                break;
            default:
                break;
        }
    }
    catch (e) {
        console.log(e); // 에러 처리 할 게 있나?
    }
}

exports.sendDataToUser = sendDataToUser;

/** 경매에 물품 등록했을 때 해당 아이템 정보 보내주기 **/
/** action: registerAuction **/
const sendRegisteredItemData = async (action, userId, itemId) => {
    const io = require('../server')
    const user = await model['User'].findByPk(userId) // 등록 수수료로 인해 변경된 발란스 가져오기 위함
    if (!user) throw new Error('INVALID_USER_ID')
    const registeredItem = await model['Market'].findOne({
        include: [
            {
                model: model['Item'],
                attributes: ['id', 'itemName', 'ability'],
            },
            {
                model: model['User'],
                attributes: ["nickname"],
            },
        ],
        where: {
            itemId: itemId,
            status: 'ONGOING'
        },
    });
    /** 예외처리
     * 4. 판매 목록 못 찾을 때, (1)아이템 아이디가 잘못됬거나 (2)상태가 다른 경우. 어쨋든 아이템 아이디 잘못 준거임 상태를 확인 못한거니까 **/
    if (!registeredItem) {
        io.sockets.in(userId).emit('ojt:error', {status: 'fail', code: 'INVALID_ITEM_ID'});
    }
    const result = await registeredItem.convertInfoForm()
    // 판매자 인벤토리 변경
    io.sockets.in(userId).emit('ojt:items', {data: {itemId: registeredItem.Item.id }, action: action})  // items로 주는 정보: id, ItemName, ability, status
    /** 1.경매 등록, 2.판매 완료(구매 이루어지거나 시간이 종료되거나) 둘 다 모든 유저들에게 알려줘서 업데이트를 하지만 셀러에게는 판매가 완료되었다고 알려줘야하니 seller:true로 구별 **/
    /** 7/15 피드백3: result를 [] 감싼 건 불필요한 코드임. 클라이어트에서 그냥 받을 수 있음 **/
    io.sockets.in(userId).emit('ojt:auctionList', {data: {auctionItem: result}, action: action, seller: true}) // action: registerAuction
    /** 판매자에게 변경된 발란스 보냄**/
    /** 1. user.balance를 원래대로 만들기 위해 CONVERT_INTEGER_VALUE으로 나눔.
     * 2. 나눈 값을 소수점 표기한 문자열로 반환 => x.xxx
     * 3. parseFloat로 문자열을 실수로 반환 **/
    io.sockets.in(userId).emit('ojt:balance', {data: {coin: parseFloat((user.balance/CONVERT_INTEGER_VALUE).toFixed(3))}})
    /** 경매 물품 리스트의 변동 사항은 모든 유저들에게 알려줘서 변경해야함 **/
    // 모든 유저에게 전송
    io.sockets.emit('ojt:auctionList', {data: {auctionItem: [result]}, action: action});
};

/** 입찰 했을 때 **/
const sendBasicOrderData = async (action, userId, marketId) => {
    const io = require('../server')
    const user = await model['User'].findByPk(userId);
    const auctionItem = await model['Market'].findOne({
        include: [
            {
                model: model['Item'],
                attributes: ['id', 'itemName', 'ability'],
            },
            {
                model: model['User'],
                attributes: ["nickname"],
            },
        ],
        where: {
            id: marketId,
            status: 'ONGOING'
        },
    });

    if (!auctionItem) throw new Error('INVALID_MARKET_ID');
    const result = await auctionItem.convertInfoForm();
    // 판매자
    if (user.nickname === result.seller) {
        io.sockets.in(userId).emit('ojt:order', {data: {order: result}, action: 'noticeNewBid'});
    }
    // 현재 입찰자
    else if (user.nickname === result.bidder) {
        io.sockets.in(userId).emit('ojt:order', {data: {order: result}, action: action});
        /** 1. user.balance를 원래대로 만들기 위해 CONVERT_INTEGER_VALUE으로 나눔.
         * 2. 나눈 값을 소수점 표기한 문자열로 반환 => x.xxx
         * 3. parseFloat로 문자열을 실수로 반환 **/
        io.sockets.in(userId).emit('ojt:balance', {data: {coin: parseFloat((user.balance / CONVERT_INTEGER_VALUE).toFixed(3))}});
    }
    else {
        io.sockets.in(userId).emit('ojt:order', {data: {order: result}, action: 'noticeCancelBid'});
        io.sockets.in(userId).emit('ojt:balance', {data: {coin: parseFloat((user.balance / CONVERT_INTEGER_VALUE).toFixed(3))}});
    }
}

/** 즉시 구매 했을 때(구매자)**/
const sendImmediateOrderData = async (action, userId, itemId) => {
    const io = require('../server')
    const item = await model['Item'].findByPk(itemId);
    /*
    { id: '1b09b368-5c94-462a-906a-8fd3fe73e17b',
        userId: '7456a996-369f-494e-ba91-b9740e24c7c7',
        itemId: '7528cd6b-6cd5-4c71-aa7b-42d3c4573f9d',
        initialBidAmount: 1,
        immediateOrderStatus: 'true',
        immediateOrderPrice: 1,
        bidder: '156d3d1b-64e1-4bce-bed7-edf3b40ac0d6',
        bidAmount: 100,
        auctionTime: 1,
        status: 'ONGOING',
        createdAt: '2021-07-09T08:04:42.184Z',
        updatedAt: '2021-07-09T08:05:03.073Z' } },
         action: 'basicOrder' }
     */
    if (!item) throw new Error('INVALID_ITEM_ID');
    const user = await model['User'].findByPk(userId)
    if (!user) throw new Error('INVALID_USER_ID')
    const result = await item.convertInfoForm()
    // 파서에서 구매자 아이디로 item.userId 업데이트 완료
    if (item.userId === userId) {
        // 구매자에게만

        /** 7/15 피드백3: result를 [] 감싼 건 불필요한 코드임. 클라이어트에서 그냥 받을 수 있음 **/
        io.sockets.in(userId).emit('ojt:items', {data: {item: result}, action: action});
    } else {
        io.sockets.in(userId).emit('ojt:order', {data: {item: result}, action: action});
    }
    // 구매자, 판매자 모두 변경된 발란스 정보 보냄
    /** 1. user.balance를 원래대로 만들기 위해 CONVERT_INTEGER_VALUE으로 나눔.
     * 2. 나눈 값을 소수점 표기한 문자열로 반환 => x.xxx
     * 3. parseFloat로 문자열을 실수로 반환 **/
    io.sockets.in(userId).emit('ojt:balance', {data: {coin: parseFloat((user.balance / CONVERT_INTEGER_VALUE).toFixed(3))}});
}



/** 경매 리스트 검색, 특정 물품 검색
 * action: searchAuctionList **/
const sendAuctionListData = async (action, userId, itemName) => {
    const io = require('../server')
    let auctionList;
    /** 특정 아이템 검색 **/
    if (itemName) {
        auctionList = await model['Market'].findAll({
            include: [
                {
                    model: model['Item'],
                    attributes: ['id', 'itemName', 'ability', 'status'],
                    where: {
                        itemName: itemName
                    }
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
    } else {
        /** 경매 리스트 모두 검색 **/
        auctionList = await model['Market'].findAll({
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
    }

    const convertFormAuctionList = [];
    for(const auctionItem of auctionList) {
        convertFormAuctionList.push(await auctionItem.convertInfoForm());
    }
    io.sockets.in(userId).emit('ojt:auctionList', {data: {auctionList: convertFormAuctionList}, action: action,}) // action: searchAuctionList
}

/** 아이템 이름을 검색했는데 검색한 아이템 풀네임 없을 때 **/
const sendAuctionListUndefinedData = async (action, userId) => {
    const io = require('../server')
    io.sockets.in(userId).emit('ojt:auctionList', {data: {auctionList: []}, action: 'searchAuctionList',}); // []빈 배열인 이유는 클라이언트에서 length로 경매 진행 유무를 파악하기 때문
}

/** 경매 마감 1.낙찰 2.낙찰자 없이 시간 종료 **/
const sendCloseAuctionData = async (action, userId, marketId) => {
    const io = require('../server')
    const user = await model['User'].findByPk(userId);
    const auctionItem = await model['Market'].findOne({
        include: [
            {
                model: model['Item'],
                attributes: ['id', 'itemName', 'ability'],
            },
            {
                model: model['User'],
                attributes: ["nickname"],
            },
        ],
        where: {
            id: marketId,
        },
    });
    if (!auctionItem) throw new Error('INVALID_MARKET_ID');
    const result = await auctionItem.convertInfoForm();
    // 입찰자 존재 => 낙찰로 경매 마감
    if (result.bidder) {
        // 판매자
        if (user.nickname === result.seller) {
            io.sockets.in(userId).emit('ojt:order', {data: {order: result}, action: 'successfulBid', seller: true});
            /** 1. user.balance를 원래대로 만들기 위해 CONVERT_INTEGER_VALUE으로 나눔.
             * 2. 나눈 값을 소수점 표기한 문자열로 반환 => x.xxx
             * 3. parseFloat로 문자열을 실수로 반환 **/
            io.sockets.in(userId).emit('ojt:balance', {data: {coin: parseFloat((user.balance / CONVERT_INTEGER_VALUE).toFixed(3))}});
        }
        // 낙찰자
        else if (user.nickname === result.bidder) {
            io.sockets.in(userId).emit('ojt:order', {data: {order: result}, action: 'successfulBid'});
        }
    }
    // 입찰자 없음 => 단순 경매 종료
    else {
        // 판매자 인벤토리에 다시 추가
        const item = await model['Item'].findOne({
            where: {id: auctionItem.Item.id},
            attributes: [['id', 'itemId'], 'itemName', 'ability', 'status']
        });
        if (user.nickname === result.seller) {
            io.sockets.in(userId).emit('ojt:order', {data: {order: result}, action: 'endOfAuctionTime'});
            io.sockets.in(userId).emit('ojt:items', {data: {item: item}, action: 'endOfAuctionTime'});
        }
    }
};

/** 에러 경우의 수가 많아서 체크해야 함. **/
// fail, userId, code
const sendErrorMessage = async (status, userId, code) => {
    const io = require('../server')
    io.sockets.in(userId).emit('ojt:error', {status: status, code: code});
}