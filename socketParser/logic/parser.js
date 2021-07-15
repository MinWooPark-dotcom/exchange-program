/** push메서드: push(task, cb) - 완료 시 옵션 콜백과 함께 작업을 대기열에 푸시합니다. 티켓 개체를 반환합니다. **/
/** parser에서 seqQueue를 만들어야 함. 판매자가 만드는게 아니라 파서 중립자가 만듦. **/
/** 우리 프로젝트에서는 new Queue() 인자로 baseFunc가 들어가는 구조(Queue 상속받고 super(baseFunc)하니까) 우리 프르젝트와 보통 push의 두 번쨰 인자 콜백을 job이라고 표현 **/
/** 시큐에 푸쉬하고 디스트로이하는 시점은 시큐에 푸쉬된 것들이 다 끝나고 디스트로이 해야 첫 번째 푸쉬된 거 말고 그 다음 예외 처리 해 줄 수 있음 **/

const model = require('../../common/models')
const redisCtrl = require('../../common/modules/redisCtrl')
const { CONVERT_INTEGER_VALUE } = require('../../common/enum')
const Queue = require('../../common/modules/queue')
/** seqQueue.status로 현재 큐가 push 받아도 되는지 안되는지 구분
 * 0: push 받을 수 없음(cancel, buy시 destroy함수 push할 때 그 다음으로 push 안들어오도록 막는 잠금 장치 역할)
 * 1: push 받아도 됨(seqQueue 처음 만들 때 기본 값) **/

/** 유저 입찰액 위탁하는 거래소 => 따로 만드는 게 아니라 seqQueueMap/seqQueue 사용 **/
const seqQueueMap = {} // itemId: seqQueue 형태, 현재 요청이 어떤 물품(큐)에 대한 요청인지 찾기 위함, seqQueue.status 0: push 불가, 1: push 가능 => 동시 요청 막기 위함
const schedule = require('node-schedule');

async function parseSocketData(stringInfo) {
    /** 경매 물품 검색은 itemId, dataString 필요 없음 **/
    const [msgType, userId, itemInfo, dataString] = stringInfo.split('||'); // itemInfo는 경매 물품 검색 시 itemId가 아니라 itemName이라서 itemInfo로 지정
    /** basic order는 marketId 받아서 seqQueue가 없음 **/
    let seqQueue =  seqQueueMap[itemInfo]
    try{
        switch (msgType) {
            /** API order/auction(경매 등록) **/
            case 'registerAuction' :
                if (seqQueue) {
                    return await redisCtrl.pushQueue('ojt:socket:internal', `fail||error||${userId}||ALREADY_REGISTERED`)
                }
                seqQueue = new Queue();
                seqQueue.status = 1 // 1은 seqQueue에 push 가능 상태
                seqQueueMap[itemInfo] = seqQueue
                /** action을 보내는 이유는 클라이언트가 saleList의 값이 변할 때 데이터 받기 위해 이벤트 리스너 붙여놓으면 판매 등록을 해서 값이 변한건지, 판매 수정을 해서 값이 변한건지 구분하기 위함**/
                const dataStringForRegistration = `${msgType}|${userId}|${itemInfo}|${dataString}`
                await seqQueue.push(await registerAuction, dataStringForRegistration); // 실제로 마켓에 등록하는 로직은 newSaleRegister
                break;
            /** API order/basic(경매 입찰) **/
            case 'basicOrder' :
                if (!seqQueue || seqQueue.status === 0) {
                    return await redisCtrl.pushQueue('ojt:socket:internal', `fail||error||${userId}||UNREGISTERED_ITEM`)
                }
                const dataStringForBasicOrder = `${msgType}|${userId}|${itemInfo}|${dataString}` // dataString: prevBidderId|bidAmount
                await seqQueue.push(await basicOrder, dataStringForBasicOrder)
                break;
            /** API order/immediate(즉시 구매) **/
            case 'immediateOrder' :
                if (!seqQueue || seqQueue.status === 0) {
                    return await redisCtrl.pushQueue('ojt:socket:internal', `fail||error||${userId}||UNREGISTERED_ITEM`)
                }
                const dataStringForImmediateOrder = `${msgType}|${userId}|${itemInfo}`;
                await seqQueue.push(await immediateOrder, dataStringForImmediateOrder)
                break;
            /** API 경매 물품 리스트 요청
             * 물건 검색은 seqQueue와 상관없음 특정 물품에 접근하는 것이 아니기 때문에
             * 물건 검색은 값이 없어도 에러가 아님, 없다고 알려주면 됨. 에러처리 할 게 없음**/
            case 'searchAuctionList' :
                await searchAuctionList(msgType, userId, itemInfo);
                break;
            default:
                break;
        }
    }catch(e) {
        console.log(e)
        await redisCtrl.pushQueue('ojt:socket:internal', `fail||error||${userId}||미확인된 에러`)
    }
}

/** 경매에 물건 등록
 * 1. 마켓 모델에 등록
 * 2. 아이템 모델에서 status 변경(UNUSED -> REGISTERD)
 * 3. 즉시 구매 가능 시 등록 수수료는 즉시 구매가의 0.1%, 즉시 구매 없으면 기본 값 1원
 * 4. 스케줄러 등록(물품 하나 당 한 개의 스케줄러): 파서는 계속 돌아가는 서버이며  파서에서 시장에 등록하니까 **/
const registerAuction = async (stringInfo) => {
    const [msgType, userId, itemId, initialBidAmount, auctionTime, immediateOrderPrice, immediateOrderStatus] = stringInfo.split('|');
    try {
        // API 서버에서
        // 즉시 구매 가능: `${initialBidAmount}||${immediateOrderPrice}||${auctionTime||${immediateOrderStatus}}` 이렇게 보내줌
        // 즉시 구매 불가: `${initialBidAmount}||${auctionTime}` 이렇게 보내줌
        /** item: item모델의 인스턴스, auctionItem은 Market모델의 인스턴스, 변수명 변경 필요 **/
        /** 예외 처리: 경매 물품 요청을 동시에 두 번 이상한 경우 **/
        const item = await model['Item'].findOne({where: {id: itemId, status: 'UNUSED'}});
        if (!item) {
            return await redisCtrl.pushQueue('ojt:socket:internal', `error||${userId}||fail||ALREADY_REGISTERED`)
        }

        /** scheduleJob에 넣는 시간 구하기 **/
        /** Date 객체는 1970년 1월 1일 UTC(협정 세계시) 자정과의 시간 차이를 밀리초로 나타내는 정수 값을 담습니다. **/
        const nowDateTime = new Date().getTime() // 현재 시간 UTC, getTime() 메서드는 표준시에 따라 지정된 날짜의 시간에 해당하는 숫자 값을 반환합니다.
        const endOfAuctionTimeMs = nowDateTime + Number(auctionTime); // 종료 시간 UTC
        const endOfAuctionDate = new Date(endOfAuctionTimeMs); // 종료 시간 Date, new Date(milliseconds): UTC 기준(UTC+0) 1970년 1월 1일 0시 0분 0초에서 milliseconds 밀리초(1/1000 초) 후의 시점이 저장된 Date 객체가 반환됩니다.
        const auctionItem = await model['Market'].registerForSale(userId, itemId, initialBidAmount, endOfAuctionDate, immediateOrderPrice, immediateOrderStatus);
        if (!auctionItem) {
            return await redisCtrl.pushQueue('ojt:socket:internal', `error||${userId}||fail||INVALID_PARAMETER`)
        }
        await auctionItem.save();
        await item.update({status: 'REGISTERED'})
        /** 스케줄러 등록: 날짜 기반 스케줄링(scheduleJob(날짜, 날짜에 실행될 함수) **/
        const seqQueue = seqQueueMap[itemId]; // seqQueue 찾아서 스케줄 시간 됬을 때 실행할 job을 push해 놓을 예정
        /** schedule.js의 scheduleJob함수 살펴보면
         * arguments(arguments 객체는 함수에 전달된 인수에 해당하는 Array 형태의 객체)에 날짜와 함수가 들어옴 **/
        const job = schedule.scheduleJob(endOfAuctionDate, async () => {
            // 스케줄 시간 됬을 때 실행할 job, 경매 종료시킴
            const scheduleJob = async (...args) => {
                const [userId, itemId, auctionItemId] = args
                console.log('스케줄러 테스트');
                const endAuctionItem = await model['Market'].findByPk(auctionItemId); // 'auctionItem'은 처음 만들어진 값, bidder가 등록된 것을 알기 위해선 현 시점에서 새로 find 해야 함
                // 1.해당 아이템에 접근하여 bidder가 있는지 체크
                if (endAuctionItem.bidder) {
                    // 2-1. 입찰자가 존재하는 경우: 아이템의 유저 아이디 변경, seqQueue 거래소에 위탁된 금액 제거
                    await item.update({userId: endAuctionItem.bidder}); // 아이템의 userId를 낙찰자로 변경
                    const user = await model['User'].findByPk(userId);
                    /** 판매 수수료: 부동 소수점 방지를 위해 1000을 곱한 값을 더함, 이후 발란스 가져올 땐 1000을 나눠서 가져옴 **/
                    await user.increment('balance', {by: endAuctionItem.bidAmount * 0.999 * CONVERT_INTEGER_VALUE}) // 0.1% 수수료 제외하고 입금
                    const seqQueue = seqQueueMap[itemId];
                    delete seqQueue['bidAmount'] // seqQueue에서 위탁한 금액 제거
                    /** 경매 종료 되었음을 판매자, 구매자에게 알림 **/
                    // 구매자
                    await redisCtrl.pushQueue('ojt:socket:internal', `closeAuction||${endAuctionItem.bidder}||${endAuctionItem.id}`)
                    // 판매자 endOfAuctionTime 알림
                    await redisCtrl.pushQueue('ojt:socket:internal', `closeAuction||${endAuctionItem.userId}||${endAuctionItem.id}`)
                } else {
                    // 2-1. 입찰자가 존재하지 않는 경우 - 단순 경매 종료 => 옥션 아이템의 status를 'COMPLETED'
                    /** 경매 종료 되었음을 판매자 알림 **/
                    // 판매자 endOfAuctionTime 알림
                    await redisCtrl.pushQueue('ojt:socket:internal', `closeAuction||${endAuctionItem.userId}||${endAuctionItem.id}`)
                }
                // db status 변경
                await endAuctionItem.update({status: 'COMPLETED'}); // 마켓 모델 경매 종료
                await item.update({status: 'UNUSED'}); // 아이템 모델 UNUSED로 변경
                // 경매 종료하여 seqQueue 제거
                seqQueue.push(destroySeqQueue, itemId) // seqQueue 제거
                seqQueue.status = 0; // seqQueue 상태 닫아서 다음 push 못 받음. 그래야 이전 push된 함수들 다 실행되서 예외 처리 후 destroy하니까
            }
            /** seqQueue에 위의 로직을 넣어서 push된 순서대로 실행 후 seqQueue제거해야 함 **/
            await seqQueue.push(await scheduleJob, userId, itemId, auctionItem.id,);
        });
        // console.log('job', job) // Job {pendingInvocations: Array(1), job: Function, ... }  Job객체는 EventEmitters이고 다음 이벤트를 내보냅니다.
        /** 7/15 피드백4: 즉시 구매 시 스케줄러 삭제하기 위해서 seqQueue.job에 job을 담아둠, cancel()의 인자로 날짜를 넣기 위해 seqQueue.endOfAuctionDate에 endOfAuctionDate 담음 **/
        seqQueue.job = job
        seqQueue.endOfAuctionDate = endOfAuctionDate
        // console.log('잡 넣은 seqQueue', seqQueue) // 확인 완료
         /** 마켓에 등록했으면 등록 수수료 처리 **/
            // immediateOrderStatus === true => 즉시 구매가의 0.1%
            // immediateOrderStatus === false => 기본 값 1원
        const user = await model['User'].findByPk(userId);
        if (immediateOrderStatus === true) {
            /** 부동 소수점 방지를 위해 1000을 곱한 값을 더함, 이후 발란스 가져올 땐 1000을 나눠서 가져옴 **/
            await user.decrement('balance', {by: immediateOrderPrice * 0.001 * CONVERT_INTEGER_VALUE}) // 즉시 구매 가능 등록 수수료: 즉시 구매가의 0.1%, 최소 즉시 구매가가 1코인이니까 수수료 0.001코인까지 나옴
        } else {
            await user.decrement('balance', {by: 1 * CONVERT_INTEGER_VALUE }) // 즉시 구매 불가할 때 등록 수수료: 기본 값 1코인
        }
        await redisCtrl.pushQueue('ojt:socket:internal', `${msgType}||${userId}||${itemId}`);
    } catch(e) {
        console.log(e)
    }
}

/** API order/basic(경매 입찰)
 * 유저는 경매 물품 입찰시 해당 금액은 거래소에 위탁
 * 상위 입찰이 들어오면 기존 입찰자에게 어떻게 돈을 돌려줄 것인가?
 * 1. 메모리 사용: auctionItem 찾아서 bidder찾고 exchangeMap.userId[itemId]로 위탁금 가져오고 이걸 delete하고 이전 입찰자.increment로 업데이트
 * 2. 레디스 사용: 키를 userId/itemId1, itemId2, ...로 만들어서 레디스 위탁금을 넣어두고(입찰 시) 상위 입찰이 들어오면 찾음
 * 어떤 데이터 타입이 적절한지 찾아보고 고민하기
 * 피드백: exchangeMap을 따로 만드는게 아니라 seqQueue.bidder = {userId: bidAmount} 이런 형태로 넣어놈.
 * seqQueueMap[userId]로 seqQueue가져온 후 seqQueue.bidder.userId로 bidAmount 가져올 수 있음.
 * **/
const basicOrder = async (stringInfo) => {
    const seqTransaction = await model.sequelize.transaction(); // try 또는 catch 둘 중 한 곳에서 무조건 쓰이니까 바깥 스코프에서 만듦.
    const [msgType, userId, itemId, prevBidderId, bidAmount] = stringInfo.split('|');
    try{
        // 1. 마켓에 등록되어 있는지 체크
        const auctionItem = await model['Market'].findOne({where: {itemId: itemId, status: 'ONGOING'}});
        if (!auctionItem) {
            return await redisCtrl.pushQueue('ojt:socket:internal', `fail||error||${userId}||UNREGISTERED_ITEM`)
        }
        // 2. 입찰액이 기존보다 커야함
        /** 기존 입찰액보다 새로운 입찰액이 커야함, API에서 처리하지만 동시 요청 들어왔을 때를 대비하여 예외처리
         * auctionItem에 접근? seqQueue에 접근? 값은 똑같음 **/
        if (bidAmount <= auctionItem.bidAmount) throw new Error('EQUAL_TO_OR_SMALLER_THAN_THE_EXISTING_BID')

        // 3. 유저 입찰액 차감 후 거래소에 위탁
        const buyer = await model['User'].findByPk(userId);
        /** 부동 소수점 방지를 위해 1000을 곱한 값을 더함, 이후 발란스 가져올 땐 1000을 나눠서 가져옴 **/
        await buyer.decrement('balance', {by: bidAmount * CONVERT_INTEGER_VALUE})
        const seqQueue = seqQueueMap[itemId];
        // seqQueue.bidder에 입찰액이 없다면 => 최초 입찰
        if (!seqQueue.bidAmount) {
            seqQueue['bidAmount'] = bidAmount;
        } else {
            // 기존 입찰액이 있을 때
            const prevBidAmount = seqQueue['bidAmount'];
            seqQueue['bidAmount'] = bidAmount; // 새로운 입찰액 넣음
            const prevBidder = await model['User'].findByPk(prevBidderId); // 이전 입찰자
            /** 부동 소수점 방지를 위해 1000을 곱한 값을 더함, 이후 발란스 가져올 땐 1000을 나눠서 가져옴 **/
            await prevBidder.increment('balance', {by: prevBidAmount * CONVERT_INTEGER_VALUE}); // 이전 입찰자에게 돈 돌려줌
        }
        /** 1. bidder 변경 2. bidAmount 변경 **/
        await auctionItem.update({bidder: userId, bidAmount:bidAmount})
        await seqTransaction.commit();
        /** pushQueue할 때 기존 입찰자에게 입찰금액도 넣어주면 웹소켓에서 입찰액 돌려받기 가능하긴 한데..  **/
        // 구매자
        await redisCtrl.pushQueue('ojt:socket:internal', `${msgType}||${userId}||${auctionItem.id}`) // msgType은 basicOrder
        // 판매자 noticeNewBid 알림
        await redisCtrl.pushQueue('ojt:socket:internal', `${msgType}||${auctionItem.userId}||${auctionItem.id}`) // msgType은 newBid
        // 기존 입찰자 noticeCancelBid 알림
        await redisCtrl.pushQueue('ojt:socket:internal', `${msgType}||${prevBidderId}||${auctionItem.id}`) // msgType은 cancelBid
    } catch(e) {
        await seqTransaction.rollback();
        console.log(e)
        await redisCtrl.pushQueue('ojt:socket:internal', `fail||error||${userId}||UNREGISTERED_ITEM`)
    }
}

/** API order/immediate **/
/** 7/15 피드백4: 즉시 구매 시 스케줄러 삭제 **/
const immediateOrder = async (stringInfo) => {
    const seqTransaction = await model.sequelize.transaction(); // try 또는 catch 둘 중 한 곳에서 무조건 쓰이니까 바깥 스코프에서 만듦.
    // const [msgType, userId, itemId, buyer, seller] = stringInfo.split('|')
    const [msgType, userId, itemId] = stringInfo.split('|')
    try {
        /** 구매-구매: 두 번째 구매 시 마켓에 물건이 없을테니 확인 후 에러 **/
        const auctionItem = await model['Market'].findOne({where: {itemId: itemId, status: 'ONGOING'}});
        // 예외처리: 두 번째 구매 요청은 status에 걸려 아이템이 없을테니 여기서 에러 처리 남.
        if (!auctionItem) {
            return await redisCtrl.pushQueue('ojt:socket:internal', `fail||error||${userId}||UNREGISTERED_ITEM`)
        }
        const buyer = await model['User'].findByPk(userId);
        const seller = await model['User'].findOne({where: {id: auctionItem.userId}})
        // 구매자 발란스 출금
        /** 부동 소수점 방지를 위해 1000을 곱한 값을 더함, 이후 발란스 가져올 땐 1000을 나눠서 가져옴 **/
        await buyer.decrement('balance', {by: auctionItem.immediateOrderPrice * CONVERT_INTEGER_VALUE})
        // 아이템 오너 변경
        await model['Item'].update({userId: userId, status: 'UNUSED'}, {where: {id: auctionItem.itemId}});
        // 판매자 발란스 입금
        /** 부동 소수점 방지를 위해 1000을 곱한 값을 더함, 이후 발란스 가져올 땐 1000을 나눠서 가져옴 **/
        await seller.increment('balance', {by: auctionItem.immediateOrderPrice * 0.999 * CONVERT_INTEGER_VALUE}) // 판매 수수료 0.1%(0.001)니까 0.999만 increment하는 것도 이상한데..
        // 마켓에서 상태 변경해서 판매 종료
        await auctionItem.update({status: 'COMPLETED'});
        await seqTransaction.commit();
        await redisCtrl.pushQueue('ojt:socket:internal', `${msgType}||${userId}||${itemId}`) // action은 immediateOrder
        await redisCtrl.pushQueue('ojt:socket:internal', `${msgType}||${seller.id}||${itemId}`) // 판매자의 발란스 변경을 위해
        /** 전역으로 seqQueueMap을 만들었으니 인자로 seqQueue를 직적 받는게 아니라 전역변수 맵에 접근해서 가져오는 게 맞음. 그럴라고 만들었으니까**/
        const seqQueue = seqQueueMap[itemId]
        /** 7/15 피드백4: 즉시 구매 시 스케줄러 삭제,
         * job.cancel(reschedule): 다음 cancel()방법으로 모든 작업을 무효화할 수 있습니다
         * 삭제 됬는지 확인하는 법: 즉시 구매 후에 스케줄러가 도는 지(스케줄러 콜백 함수에 있는 콘솔이 찍히는 지) 확인 **/
        // console.log('캔슬 전 seqQueue', seqQueue)
        const endOfAuctionDate = seqQueue.endOfAuctionDate;
        // seqQueue.job.cancel(endOfAuctionDate) // 인자 넣고 캔슳 확인, 안넣고는 ? , 인자 유무의 차이는?
        seqQueue.job.cancel() // 인자 넣고 캔슳 확인, 안넣고는 ? , 인자 유무의 차이는?
        // console.log('캔슬 후 seqQueue', seqQueue) // 캔슬 후에도 차이가 없음 어떻게 캔슬됬는지 알지?
        seqQueue.push(destroySeqQueue, itemId)
        seqQueue.status = 0; // seqQueue 상태 닫아서 다음 push 못 받음. 그래야 이전 push된 함수들 다 실행되서 예외 처리 후 destroy하니까
    } catch (e) {
        await seqTransaction.rollback();
        console.log(e)
        await redisCtrl.pushQueue('ojt:socket:internal', `fail||error||${userId}||UNREGISTERED_ITEM`)
    }
};

/** API market[?itemName=itemName]
 * msgType: searchAuctionList **/
const searchAuctionList = async (msgType, userId, itemName) => {
    try{
        // 경매 리스트 전체 검색
        if (!itemName){
            return await redisCtrl.pushQueue('ojt:socket:internal', `${msgType}||${userId}`);
        }
        // 특정 아이템 검색
        // 검색한 아이템의 풀네임 없다면
        else if (itemName === 'undefined') {
            return await redisCtrl.pushQueue('ojt:socket:internal', `${msgType}Undefined||${userId}`);
        }
        // 검색한 아이템의 풀네임 있음
        else {
            return await redisCtrl.pushQueue('ojt:socket:internal', `${msgType}||${userId}||${itemName}`);
        }
    } catch (e) {
        console.log(e)
        await redisCtrl.pushQueue('ojt:socket:internal', `fail||error||${userId}||미확인된 에러`)
    }
}

/** destroy함수 보면 시큐 자체를 날리는 로직 전혀 없음. 알 떄까지 계속 분석해야 함.
 * 그리고 seqQueue보면 안에 값은 날아갔음. destroy가 그런 함수인거임.
 * seqQueue값 지웠으니 다음 요청 때 이용 못하고 seqQueueMap에서 지웠으니 참조할 수 없어서 가비지 컬렉팅 됨.
 * 이게 seqQueue 지워진거임.**/

/** buyItem에서 보내주는 인자가 itemId이지만 받을 때는 id, uniqueId 등으로 받아야 범용적으로 사용 가능
 * itemId라는 이름으로 받으면 범용적으로 사용하기 어려운 이름이 됨. **/
// 사용처: register하고 스케줄러 시간 도달했을 때, immediateOrder 즉시 구매했을 때
const destroySeqQueue = async (id) => {
    // destroy(cb) - Destroys the queue: closes the store, tries to clean up.
    /** 전역으로 seqQueueMap을 만들었으니 인자로 seqQueue를 직적 받는게 아니라 전역변수 맵에 접근해서 가져오는 게 맞음. 그럴라고 만들었으니까**/
    const seqQueue = seqQueueMap[id]
    seqQueue.destroy(() => {
        delete seqQueueMap[id]
        console.log('seqQueue안의 값 제거 완료', seqQueueMap)
    })
}

exports.parseSocketData = parseSocketData;
