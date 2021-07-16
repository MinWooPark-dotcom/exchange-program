'use strict'

const express = require("express");
const router = express.Router();
const model = require("../../common/models") // Internal.js
const {authHandler, validateParameter} = require("../handler/packetHandler");
const {redisCtrl, utils} = require('../../common');
const {checkAuctionTime} = utils;
const {auctionTimeList} = require('../../common/enum');

/** 캡슐화: 파라미터 체크 시 2개 이상부터는 길어지니까 이렇게 맵으로 만들어 둠 **/
const requiredKeyMap = {
    registerImmediateOrderAuction: ['immediateOrderPrice'], // 즉시 구매 가능은 즉시 구매가 필요
    /** 7/15 피드백5: 필수 파라미터만 체크하고 immediateOrderStatus같은 옵션은 체크 안 함 **/
    registerBasicAuction: ['itemId', 'initialBidAmount', 'auctionTime'], // 즉시 구매 불가 경매 등록
    basicOrder: ['marketId', 'bidAmount'], // POST, 경매 입찰
    immediateOrder: ['marketId'], // POST, 즉시 구매
};

/** 각 라우터마다 항상 먼저 실행, 현재 토큰 유효 기간 체크하고 req객체에 유저 정보 넣기 위함 **/
router.use(authHandler)

/** 경매 입찰 **/
// POST Basic order
// 인자: itemId, bidAmount(입찰액)
router.post('/order/basic', async (req, res, next) => {
    try{
        const buyerId =  req.user.id;
        const checkArray = requiredKeyMap['basicOrder'];
        validateParameter(checkArray, req.body);
        const {marketId, bidAmount} = req.body;
        const auctionItem = await model['Market'].findByPk(marketId);
        if (!auctionItem) throw new Error('INVALID_MARKET_ID');
        /** 1. 거래 최소 단위는 1, 정수
         * 2.기존 입찰액보다 새로운 입찰액이 커야함
         * 3.기존 입찰액이 없으면 최초 입찰액보다 커야함**/

        /** 7/15 피드백6: 입찰-즉시 구매가 예외처리(즉시구매가보다 비싼 금액으로 입찰하면 에러)
         * 클라이언트에서 처리하지만 서버에서도 예외처리는 해 놓음 **/
        if (auctionItem.immediateOrderPrice <= bidAmount) throw new Error('EQUAL_TO_OR_HIGHER_THAN_IMMEDIATE_ORDER_PRICE')
        // 거래 최소 단위 1(정수)
        if (!Number.isInteger(Number(bidAmount))) throw new Error('INVALID_ORDER_PRICE_TYPE');
        // 최초 입찰시 판매자가 제시한 최초 입찰액보다 높은 금액으로 제시해야 함
        if(!auctionItem.bidAmount && auctionItem.initialBidAmount >= bidAmount) {
            throw new Error('EQUAL_TO_OR_SMALLER_THAN_INITIAL_BID_AMOUNT')
        }
        // 현재 입찰액보다 낮은 금액으로 입찰한 경우
        else if (bidAmount <= auctionItem.bidAmount) throw new Error('EQUAL_TO_OR_SMALLER_THAN_THE_EXISTING_BID')
        // 판매자(자신의 물건에 입찰하는지 체크하기 위함)
        const seller = await model['User'].findOne({where: {id: auctionItem.userId}});
        // 기존 입찰자(상위 입찰로 인해 입찰 취소되었다고 알리기 위함)
        const prevBidderId = auctionItem.bidder; // userId
        // 구매자(본인이 최고가 입찰이라면 상위 입찰 불가)
        const buyer = await model["User"].findByPk(buyerId);
        if (buyer.id === seller.id) throw new Error('SELLER_AND_BUYER_ARE_SAME')
        if (buyer.id === prevBidderId) throw new Error('ALREADY_HIGHEST_BID') // 본인이 최고가 입찰이라면 상위 입찰 불가
        /** 구매자의 발란스가 충분한지 체크 **/
        if (buyer.balance >= auctionItem.bidAmount) {
            const dataString = `${prevBidderId}|${bidAmount}`
            await redisCtrl.pushQueue('ojt:socket:parser', `basicOrder||${buyerId}||${auctionItem.itemId}||${dataString}`);
            return next({status: 'success'});
        } else {
            throw new Error('OUT_OF_BALANCE');
        }
    } catch(e) {
        next(e)
    }
})

/** 경매 물품 즉시 구매**/
// POST Immediate order
// 인자: itemId
router.post('/order/immediate', async (req, res, next) => {
    try{
        const buyerId =  req.user.id;
        const checkArray = requiredKeyMap["immediateOrder"];
        validateParameter(checkArray, req.body);
        const {marketId} = req.body;
        const auctionItem = await model['Market'].findByPk(marketId)
        if (!auctionItem) throw new Error('INVALID_MARKET_ID')
        const seller = await model['User'].findOne({where: {id: auctionItem.userId}});
        const salePrice = auctionItem.immediateOrderPrice
        const buyer = await model["User"].findByPk(buyerId)
        /** 구매자의 발란스가 판매가보다 크거나 같아야 함. **/
        if (buyer.balance >= salePrice) {
            if (seller.id === buyerId) throw new Error('SELLER_AND_BUYER_ARE_SAME');
            await redisCtrl.pushQueue('ojt:socket:parser', `immediateOrder||${buyerId}||${auctionItem.itemId}`);
            return next({status: 'success'});
        } else {
            throw new Error('OUT_OF_BALANCE');
        }
    } catch(e) {
        next(e)
    }
});


/** 경매 물품 등록
 * API POST -> Parser `msgType||userId||itemId||dataString(추가적으로 필요한 값들은 '|'로 구분하여 하나로 만듦)**/
// POST Auction
// 인자:
// 즉시 구매 가능: itemId, initialBidAmount(최초 입찰액), immediateOrderStatus(즉시 구매 여부-true), immediateOrderPrice(즉시 구매 금액), auctionTime(경매 시간)
// 즉시 구매 불가: itemId, initialBidAmount(최초 입찰액), immediateOrderStatus(즉시 구매 여부-false), auctionTime(경매 시간)
/** 등록 수수료 0.1% (즉시 구매 열면 즉시 구매가의 0.1%, 즉시 구매 없으면 기본 값 1원) **/
router.post('/auction', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const {itemId, immediateOrderStatus, auctionTime} = req.body;
        /** 7/15 피드백5: 필수 파라미터만 체크하고 immediateOrderStatus 옵션은 체크 안 함 **/
         const checkArray = immediateOrderStatus === true ? requiredKeyMap["registerBasicAuction"].concat(requiredKeyMap['registerImmediateOrderAuction']) : requiredKeyMap["registerBasicAuction"];
        validateParameter(checkArray, req.body);
        // 최초 입찰액: 최소 금액 1원, 최소 단위 1
        let initialBidAmount = Number(req.body.initialBidAmount)
        // 즉시 구매: 최소 금액, 최소 단위 1
        let immediateOrderPrice;
        if (immediateOrderStatus === true) { // 즉시 구매는 선택, true라면
            immediateOrderPrice = Number(req.body.immediateOrderPrice);
            if (immediateOrderPrice < 1 || !Number.isInteger(immediateOrderPrice)) {
                throw new Error('INVALID_IMMEDIATE_ORDER_PRICE')
            }
        }
        // 최초 입찰액, 즉시 구매 최소 금액 1원보다 작거나, 최소 단위 1이 아닌 소수를 사용한다면 에러
        if (initialBidAmount < 1 || !Number.isInteger(initialBidAmount)) {
            throw new Error('INVALID_INITIAL_BID_AMOUNT')
        }
        /** 경매 시간 체크: 현재 시간 단위만 되어있지만 확장성을 고려해야 함. 30분, 60초... 뭐든 들어올 수 있게 만들기 **/
        checkAuctionTime(auctionTimeList, auctionTime)
        // 이미 등록되어 있는지 체크
        const checkRegistration = await model['Market'].findOne({where: {itemId: itemId, status: 'ONGOING'}});
        if (checkRegistration) throw new Error('ALREADY_REGISTERED');

        /** 우리 프로젝트 parser가 받는 정보 'msgType||userId||exchangeType||dataString
         *  우리 프로젝트랑 형태가 조금 다를 수 있는게 우리 프로젝트는 apiServer에서 db에 접근하고 orderPlanId를 넘겨주는 등을 함
         *  근데 과제에서는 db에 접근하는 모든 로직이 seqQueue를 통해 이루어지고 그 seqQueue는 파서에 있음
         *  그래서 파서로 보내줄 dataString이 더 많은 수 있음 **/

        /** parser로 보내는 다른 값들과 dataString을 구분하기 위해 '|'를 사용했는데 조금 무식한 방법 같음. '||'를 쓰면서도 구분할 수 있는 방법은 없을까? **/
        let dataString;
        if (immediateOrderStatus === true) {
            dataString = `${initialBidAmount}|${auctionTime}|${immediateOrderPrice}|${immediateOrderStatus}` // immediateOrderStatus가 문자열로 바뀜
        } else {
            dataString = `${initialBidAmount}|${auctionTime}`
        }
        await redisCtrl.pushQueue('ojt:socket:parser', `registerAuction||${userId}||${itemId}||${dataString}`)
        return await next({status: 'success'});
    } catch (e) {
        next(e)
    }
});

/** 개인 정보가 아닌 경매 리스트는 API로 대체  **/
/** 경매 물품 리스트, 경매 물품 검색 **/
// GET Auction list
// router.get('/', async (req, res, next) => {
//     try {
//         const {itemName} = req.query;
//         const userId = req.user.id;
//         /** GET market?itemName=itemName (경매 리스트 중 아이템 검색) **/
//         if (itemName) {
//             /** itemName 유효성 검사 **/
//             const fullItemName = await model['Item'].getFullItemName(itemName); // 일치하는 문자가 없으면 -1
//             // 검색한 아이템 이름 풀네임 구함
//             if (fullItemName !== -1) {
//                 await redisCtrl.pushQueue('ojt:socket:parser', `searchAuctionList||${userId}||${fullItemName}`);
//             }
//             // 검색한 아이템 이름 풀네임 없음
//             else if (fullItemName === -1) {
//                 await redisCtrl.pushQueue('ojt:socket:parser', `searchAuctionList||${userId}||undefined`);
//             }
//         }
//         /** GET market (경매 리스트 검색) **/
//         else {
//             await redisCtrl.pushQueue('ojt:socket:parser', `searchAuctionList||${userId}`);
//         }
//         return await next({status: 'success'});
//     } catch (e) {
//         next(e)
//     }
// });

/** GET market?itemName=itemName (경매 리스트 중 아이템 검색) **/
router.get('/', async (req, res, next) => {
    try {
        const {itemName} = req.query;
        const userId = req.user.id;
        let auctionList;
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
        return await next({status: 'success', auctionList: convertFormAuctionList});
    } catch (e) {
        next(e)
    }
});

module.exports = router;