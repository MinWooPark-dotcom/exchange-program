/** 메뉴 선택하면 리스트들이 나오도록, 이건 클라이언트에서 메모리를 사용하여 유저맵, 아이템 리스트들을 만들어야 함.**/
const axios = require('axios');
const io = require('socket.io-client');
const readline = require("readline");
/** readline.Interface클래스의 인스턴스는 readline.createInterface()메서드를 사용하여 생성 **/
// input은 ReadableStream ouput은 WritableStream과 연결됨.
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const {
    requestItemId, requestImmediateBidAmount, checkImmediateOrderStatus, checkImmediateOrderPrice,
    checkAuctionTimeUnit, checkAuctionTime
} = require('./utils');
let email; // 로그인할 떄 사용
let password; // 로그인할 떄 사용
let token;  // 로그인 시 얻은 토큰 담을 때 사용 -> 소켓 연결 시 쿼리로 넣음
let socket;  // 소켓 연결 객체 담을 때 사용
let itemList = []; // 유저에게 콘솔로 보여줄 아이템 리스트

/** 7/15 피드백1: userMap.token에서 token없앴음 **/
// 유저맵에 토큰으로 접근하면 발란스, 아이템 정보 가져올 수 있음.
const userMap = {}
// userMap 형태:
// { token:{balance : 1234, items: [{itemId: 'aaaa', itemName: 'a', ability: 'b', status: 'c',}, {...}, ...], ability: 'b', status: 'c'},
// }
// 세일리스트는 마켓에 등록 되있는 물품 정보 가져옴, balance, items처럼 개인적인 내용이 아니라 userMap과 따로
let auctionList = [] // auctionList 형태: [{id: 'a', itemName: 'b', ability: 'c', price: 111, seller: 'd'}, {...}, ...]

/** recursiveAsyncReadLine (1.경매 물품 리스트 보기 2.경매 물품 검색하기 3.경매 물품 등록하기 4.인벤토리 확인 5.지갑 정보 6.로그아웃 7.프로그램 종료 메뉴 선택하는 함수)
 * 안에서 사용하는 함수들 정리 **/

/** 경매 물품 리스트 보기 **/
const searchAuctionList = async () => {
    try{
        await axios.get('http://localhost:3000/market', {
            headers: {
                token: token
            }
        })
    } catch (e) {
        console.log('경매 리스트 검색에 실패했습니다.', e)
        errorHandler()
    }
}

exports.searchAuctionList = searchAuctionList

/** 경매 물품 검색하기 **/
const searchAuctionItem = () => {
    rl.question('1. 검색할 물품 이름 입력하기 2. 메뉴 선택 돌아가기', async (answer) => {
        switch (answer) {
            case "1":
                rl.question("물품 이름: ", async function (itemName) {
                    try {
                        console.log(`검색하신 아이템 \'${itemName}\'을 조회합니다.`)
                        const encodedItemName = encodeURI(itemName)
                        await axios.get(`http://localhost:3000/market?itemName=${encodedItemName}`, {
                            headers: {
                                token: token
                            }
                        });
                    } catch (e) {
                        console.log('물품 검색에 실패했습니다.', e)
                        errorHandler();
                    }
                    // return recursiveAsyncReadLine(socket, token); // 소켓으로 받는 응답보다 먼저 찍힘
                });
                break;
            case "2":
                console.log("메뉴 선택으로 돌아갑니다");
                return recursiveAsyncReadLine(socket, token);
                break;
            default:
                console.log("1~2번 숫자를 입력해 주세요");
                return recursiveAsyncReadLine(socket, token);
        }
    });
};
exports.searchAuctionItem = searchAuctionItem;

/** 경매 물품 등록하기 **/
const registerAuction = async () => {
        try {
            /** 7/15 피드백5: 필수 파라미터만 체크하고 immediateOrderStatus 옵션은 체크 안 함 **/
            const itemId = await requestItemId(rl);
            console.log('')
            const initialBidAmount = await requestImmediateBidAmount(rl);
            const immediateOrderStatus = await checkImmediateOrderStatus(rl) // true or null
            const immediateOrderPrice = await checkImmediateOrderPrice(rl) // 즉시 구매 가격 물음, 값 있거나 없거나
            const auctionTimeUnit = await checkAuctionTimeUnit(rl) // 경매 시간 단위 물음
            const auctionTime = await checkAuctionTime(rl, auctionTimeUnit) // 경매 시간 값 물음, UTC(ms단위)


            /** auctionTime까지 못 기다려줌 **/
            // await axios.post('http://localhost:3000/market/auction', {
            //     itemId: itemId,
            //     initialBidAmount: initialBidAmount,
            //     immediateOrderStatus: immediateOrderStatus,
            //     immediateOrderPrice: immediateOrderPrice,
            //     auctionTime: auctionTime,
            // }, {
            //     headers: {
            //         token: token
            //     }
            // });
        } catch (e) {
            console.log('e', e)
        }
};


/** 에러 핸들러 **/
const errorHandler = () => {
    rl.question("1.메뉴로 돌아가기 2.로그아웃 3.프로그램 종료", async function (answer) {
        switch (answer) {
            case "1":
                return recursiveAsyncReadLine(socket, token); // 왜 메뉴 선택지가 2번이나 찍히지?
            case "2":
                console.log('로그아웃 하였습니다..');
                rl.question("1. 로그인하기 2. 프로그램 종료하기 ", async function (answer) {
                    switch (answer) {
                        case "1":
                            login();
                            break;
                        case "2":
                            console.log('프로그램을 종료합니다.')
                            process.exit();
                    }
                });
                break;
            case "3":
                console.log('프로그램을 종료합니다.')
                process.exit(); // 프로그램 종료
            default:
                console.log("잘못된 번호를 입력하셨습니다. 초기 메뉴 선택으로 돌아갑니다.");
                return errorHandler();
        }
    });
}
exports.errorHandler = errorHandler;

/** 로그아웃 **/
const logOut = async () => {
    try{
        await axios.get(`http://localhost:3000/users//logOut`, {
            headers: {
                token: token
            }
        });
        rl.question("1. 로그인하기 2. 프로그램 종료하기 ", async function (answer) {
            switch (answer) {
                case "1":
                    login();
                    break;
                case "2":
                    console.log('프로그램을 종료합니다.')
                    process.exit();
            }
        });
    } catch(e) {
        console.log('로그아웃 에러 발생')
        console.log('e',e)
    }
}
exports.logOut = logOut;

/** 경매 리스트 검색 시 즉시 구매 or 입찰할 지 물어봄 **/
const immediateOrderOrBid = () => {
    rl.question('\n 1.즉시 구매하기 2.입찰하기 3.메뉴로 돌아가기', async (answer) => {
        try {
            switch (answer) {
                case "1":
                    await immediateOrder();
                    break;
                /** 7/15 피드백6. 입찰-즉시구매가 예외처리(즉구보다 입찰이 비싸면 에러 처리 **/
                case "2":
                    bid()
                    break;
                case "3":
                    console.log('메뉴로 돌아가기를 선택하셨습니다.')
                    return recursiveAsyncReadLine(socket, token);
                default:
                    console.log("잘못된 번호를 입력하셨습니다. \n초기 메뉴 선택으로 돌아갑니다.");
                    return recursiveAsyncReadLine(socket, token);
            }
        } catch (e) {
            console.log(e)
        }
    });
}
exports.immediateOrderOrBid = immediateOrderOrBid;

/** 즉시 구매 **/
const immediateOrder = async () => {
    rl.question("즉시 구매할 marketId를 입력해 주세요: ", async function (marketId) {
        try {
            await axios.post('http://localhost:3000/market/order/immediate', {
                marketId: marketId
            }, {
                headers: {
                    token: token
                }
            });
        } catch(e) {
            console.log('즉시 구매 실패를 실패하였습니다.',e.response.data)
            return errorHandler();
        }
    });
}
exports.immediateOrder = immediateOrder

/** 입찰 **/
const bid = () => {
    rl.question("입찰할 marketId: ", async function (marketId) {
        // 1. 입찰가가 아이템의 즉시구매가보다 큰 지 확인하기 위해 auctionList 중에서 입찰하려는 아이템을 찾음
        const auctionItem = auctionList.filter(el => el.id === marketId)[0];
        if (!auctionItem) {
            console.log('에러: marketId를 잘못 입력하셨습니다.')
            return errorHandler();
        }
        // 2. 즉시 구매가와 입찰액과 비교
        rl.question("입찰액: ", async function (bidAmount) {
            try {
                // 즉시 구매가보다 낮은 금액으로만 입찰 가능
                if (auctionItem.immediateOrderPrice <= bidAmount) {
                    console.log('에러: 입찰액이 즉시 구매가보다 크거나 같아 입찰이 진행되지 않았습니다.')
                    return errorHandler();
                }
                // 즉시 구매가보다 낮은 금액이면 요청
                await axios.post('http://localhost:3000/market/order/basic', {
                    marketId: marketId,
                    bidAmount: bidAmount,
                }, {
                    headers: {
                        token: token
                    }
                });
            } catch (e) {
                // console.log('e', e)
                if (e.response.data.code === 'SELLER_AND_BUYER_ARE_SAME') {
                    console.log('에러: 자신의 물건은 입찰할 수 없습니다.')
                } else if (e.response.data.code === 'EQUAL_TO_OR_SMALLER_THAN_INITIAL_BID_AMOUNT') {
                    console.log('에러: 최초 입찰액보다 높은 가격으로 입찰해야 합니다.')
                } else if (e.response.data.code === 'EQUAL_TO_OR_SMALLER_THAN_THE_EXISTING_BID') {
                    console.log('에러: 현재 입찰액보다 높은 가격으로 입찰해야 합니다.')
                } else if (e.response.data.code === 'INVALID_IMMEDIATE_ORDER_PRICE_TYPE') {
                    console.log('에러: 입찰액의 최소 단위는 1 입니다.')
                } else if (e.response.data.code === 'EQUAL_TO_OR_HIGHER_THAN_IMMEDIATE_ORDER_PRICE') {
                    console.log('에러: 입찰액이 즉시 구매가보다 크거나 같아 입찰이 진행되지 않았습니다.')
                }
                console.log('입찰 실패 시 서버로 부터 받은 에러 코드.', e.response.data);
                return errorHandler()
            }
        });
    });
}
exports.bid = bid;

/** 경매 남은 시간 계산: 종료 시간 - 현재 시간 **/
const getRemainingAuctionTime = (auctionList) => {  // [{endOfAuctionTime: 'YYYY-MM-DD HH:MM:SS', ...}, ...] 리스트로 들어옴.
    console.log('경매 진행 중인 물품 리스트입니다. \n')
    let num = 1; // 아이템 숫자 매기는 용도
    for (const auctionItem of auctionList) {
        const endOfAuctionTimeMs = new Date(auctionItem.endOfAuctionDate).getTime() // 종료 시간 ms
        const nowDateTimeMs = new Date().getTime(); // 현재 시간 ms
        const intervalTime = endOfAuctionTimeMs - nowDateTimeMs

        /** utc알고 쓰기
         * utc 밀리초 단위의 숫자 값 반환하여 1000 = 1초 * 60 => 1분 * 60 => 1시간 * 24 => 24시간
         * Math.floor() 함수는 주어진 숫자와 같거나 작은 정수 중에서 가장 큰 수를 반환합니다. **/
        const intervalHour = Math.floor((intervalTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); //=> 시간 간격 % 하루 / 시간 = 시간 간격의 시간
        const intervalMinutes = Math.floor((intervalTime % (1000 * 60 * 60)) / (1000 * 60)); //=> 시간 간격 % 시간 / 분 = 시간 간격의 분
        const intervalSeconds = Math.floor((intervalTime % (1000 * 60)) / 1000); //=> 시간 간격 % 분 / 초 = 시간 간격의 초
        // 나머지 연산자(%)는 피제수가 제수에 의해 나누어진 후, 그 나머지를 반환합니다. 항상 피제수의 부호를 따릅니다.
        // 어떤 수나 식을 다른 수나 식으로 나눌 때, 그 처음의 수나 식. ‘6÷3＝2’에서 ‘6’을 이른다.
        // ex) 2000(시간 간격) % 60000(분) = 나눌 수 없어서 피제수 그대로 나옴 2000 그리고 1000으로 나누면 초 단위로 값 나옴
        /** 클라이언트에서 경매 물품에 대해 보여줄 정보
         *  0. marketId(즉시 구매, 입찰하기 위함)  1. 아이템 이름 2. 능력치 3. 판매자(본인 물품 입찰 불가하므로 미리 체크) 4. 최초 입찰액 5. 즉시 구매 여부 6. 즉시 구매 가격 7. 현재 입찰액 8. 경매 종료 시간 9. 남은 시간 **/

        // 콘솔 로그 너무 긴데 엔터하면 템플릿 리터럴 때문에 줄바꿈 적용됨.
        if (auctionItem.immediateOrderStatus === 'true') {
            console.log(`${num}.\n marketId: ${auctionItem.id} \n 아이템: ${auctionItem.itemName} \n 능력치: ${auctionItem.ability} \n 판매자: ${auctionItem.seller}  \n 최초 입찰액: ${auctionItem.initialBidAmount}코인 \n 즉시 구매 가격: ${auctionItem.immediateOrderPrice}코인 \n 현재 입찰액: ${auctionItem.bidAmount? auctionItem.bidAmount: 0}코인 \n 경매 종료 시간: ${auctionItem.endOfAuctionDate} \n 경매 종료까지 남은 시간: ${intervalHour}시간 ${intervalMinutes}분 ${intervalSeconds}초`);
        } else {
            console.log(`${num}.\n marketId: ${auctionItem.id} \n 아이템: ${auctionItem.itemName} \n 능력치: ${auctionItem.ability} \n 판매자: ${auctionItem.seller} \n 최초 입찰액: ${auctionItem.initialBidAmount}코인 \n 현재 입찰액: ${auctionItem.bidAmount? auctionItem.bidAmount: 0}코인 \n 경매 종료 시간: ${auctionItem.endOfAuctionDate} \n 경매 종료까지 남은 시간: ${intervalHour}시간 ${intervalMinutes}분 ${intervalSeconds}초`);
        }
        num += 1;
    }
}
exports.getRemainingAuctionTime = getRemainingAuctionTime;

const recursiveAsyncReadLine = async function (socket, token) {
    try {
        rl.question("1.경매 물품 리스트 보기 2.경매 물품 검색하기 3.경매 물품 등록하기 4.인벤토리 확인 5.지갑 정보 6.로그아웃 7.프로그램 종료 \n", async function (answer) {
            switch (answer) {
                /** 1. 경매 물품 리스트 보기 **/
                case "1":
                    console.log('1번 \'경매 물품 리스트 보기\' 선택하셨습니다.');
                    await searchAuctionList()
                    break;
                /** 2. 경매 물품 검색하기 **/
                case "2":
                    console.log('2번 \'경매 물품 검색을\' 선택하셨습니다.');
                    await searchAuctionItem(recursiveAsyncReadLine);
                    break;
                /** 3. 경매 물품 등록하기 **/
                case "3":
                    console.log('3번 \'경매 물품 등록하기를 \' 선택하셨습니다.');
                    itemList = userMap.items.filter(el => el.status === 'UNUSED');
                    console.log(`${userMap.nickname}님의 인벤토리입니다. \n`, itemList);
                    rl.question('\n 1. 경매에 물품 등록하기 2. 메뉴 선택 돌아가기', async (answer) => {
                        try{
                            switch (answer) {
                                case "1":
                                    await registerAuction();
                                    break;
                                case "2":
                                    console.log("메뉴 선택으로 돌아갑니다");
                                    return recursiveAsyncReadLine(socket, token);
                                    break;
                                default:
                                    console.log("1~2번 숫자를 입력해 주세요");
                                    return recursiveAsyncReadLine(socket, token);
                            }
                        } catch(e) {
                            console.log('e', e)
                        }
                    });
                    break;
                /** 인벤토리 확인 **/
                case "4":
                    console.log('4번 \'인벤토리 확인\'을 선택하셨습니다.')
                    itemList = userMap.items.filter(el => el.status === 'UNUSED');
                    console.log(`${userMap.nickname}님의 인벤토리입니다. \n`, itemList);
                    errorHandler(recursiveAsyncReadLine) // 에러는 아니지만 메뉴로 돌아가는 템플릿이 같아서 일단 사용
                    break;
                case "5":
                    console.log('5번 \'지갑 정보 확인\'을 선택하셨습니다.')
                    console.log(`보유 코인: ${userMap.balance}코인`)
                    errorHandler(recursiveAsyncReadLine) // 에러는 아니지만 메뉴로 돌아가는 템플릿이 같아서 일단 사용
                    break;
                case "6":
                    console.log('로그아웃 하였습니다..');
                    await logOut()
                    break;
                case "7":
                    console.log('프로그램을 종료합니다.')
                    process.exit();
                default:
                    console.log("1~4번 숫자를 입력해 주세요");
                    return recursiveAsyncReadLine(socket, token);
            }
        });
    } catch(e) {
        console.log('e', e)
    }
};

/** 로그인 **/
const login = () => {
    rl.question('Email: ', (answer) => {
        console.log(`Your email: ${answer}`);
        email = answer;
        rl.question('Password: ', async (answer) => {
            try {
                console.log(`Your password: ${answer}`);
                password = answer
                const userInfo = await axios.post(
                    'http://localhost:3000/users/signIn',
                    {
                        email,
                        password,
                    }
                );                token = userInfo.data.token // 소켓 연결하기 위한 토큰
                userMap.nickname = userInfo.data.user.nickname; // 로그인 후 메뉴 선택 시 유저 닉네임 보여주기 위함
                userMap.items = [];
                /** 커넥트할 때 주소 뒤에 네임스페이스를 붙이면 서버에서 해당 네임스페이스로 보낸 데이터만 받을 수 있음
                 * socket.io-client 모듈이여서 connect함수는 안쓰고 바로 io()로 사용
                 * 네임스페이스보다 더 세부적인 개념으로 방(room)있음 **/
                socket = io(`http://localhost:3003?token=${token}`); //3001번 포트 사용(서버), token => 정상으로 emit 받음
                // socket.on은 비동기, connect가 되고나서 콜백 함수가 실행
                /** .on은 이벤트 등록, 그렇기 떄문에 한 번 등록해 두어서 아래 함수가 끝나도 해당 이벤트이름으로 이벤트가 발생하면 이벤트 리스너의 콜백함수가 실행됨 **/
                socket.on('connect', () => {
                    console.log('client socket 연결 완료 \n')
                    /** 발란스 정보: socket.on('ojt:balance', ...) **/
                    socket.on('ojt:balance', (res) => {
                        // console.log('balance res',res)
                        userMap.balance = res.data.coin
                    })
                    /** 아이템 정보: socket.on('ojt:items', ...) **/
                    socket.on('ojt:items', (res) => {
                        // console.log('items res', res);
                        // 최초 로그인 시 스냅샷
                        if (res.snapshot) {
                            for (const item of res.data.itemList) {
                                userMap.items.push(item)
                            }
                        }
                        // 즉시 구매시 구매자 인벤토리에 아이템 추가
                        else if (res.action === 'immediateOrder') {
                            /** 7/15 피드백2: 아이템 객체 받은 거 userMap에 저장(인벤토리 확인 시 보여줘야 함) **/
                            userMap.items.push(res.data.item)
                            /** 7/15 피드백3: result를 [] 감싼 건 불필요한 코드임. 클라이어트에서 그냥 받을 수 있음 **/
                            console.log(`${res.data.item.itemName}을 구입하였습니다.\n`, res.data.item)
                            return recursiveAsyncReadLine(socket, token);
                        }
                        // 경매 등록 시 판매 인벤토리에서 제거
                        else if (res.action === 'registerAuction') {
                            userMap.items = userMap.items.filter(el => el.itemId !== res.data.itemId);
                        }
                        // 낙찰 없이 경매 시간 종료시 판매자 인벤토리에 다시 추가
                        else if (res.action === 'endOfAuctionTime') {
                            userMap.items.push(res.data.item);
                        }
                    });
                    /** 경매 정보: socket.on('ojt:auctionList', ...) **/
                    socket.on('ojt:auctionList', (res) => {
                        // console.log('auctionList res', res);
                        /** 경매 등록 **/
                        if (res.action === 'registerAuction') {
                            if (res.seller) {
                                console.log(`\'${res.data.auctionItem.itemName}\' 판매 등록이 완료되었습니다.\n`, res.data.auctionItem)
                                /** 7/15 피드백6: 입찰-즉시 구매가 예외처리(즉시구매가보다 비싼 금액으로 입찰하면 에러)를 하기 위해
                                 * auctionList에 아이템 정보 넣어놓고 비교하여 사용 **/
                                auctionList.push(res.data.auctionItem)
                                return recursiveAsyncReadLine(socket, token);
                            }
                            /** 판매자 포함 모든 유저들의 판매 목록에 추가하기 위함, emit 두 번 함. in으로 특정 소켓(판매자), sockets로 모든 유저 **/
                            auctionList.push(res.data.auctionItem)
                        } else if (res.action === 'searchAuctionList') {
                            if (res.data.auctionList.length > 0) {
                                /** 7/15 피드백6: 입찰-즉시 구매가 예외처리(즉시구매가보다 비싼 금액으로 입찰하면 에러)를 하기위해 메모리에 아이템 넣고 입찰 시 즉시구매가와 비교**/
                                for (const auctionItem of res.data.auctionList) {
                                    auctionList.push(auctionItem)
                                }
                                getRemainingAuctionTime(res.data.auctionList)
                                immediateOrderOrBid() // 검색 결과 나오면 1.즉시 구매 2.입찰 3.메뉴로 돌아가기 선택지 나옴
                            } else {
                                console.log('경매 진행 중인 물품이 없습니다.\n');
                                errorHandler() // 에러는 아니지만 에러핸들러와 같은 로직이라 사용
                            }
                        }
                    });
                    socket.on('ojt:order', (res) => {
                        // console.log('res', res)
                        // 현재 입찰자에게 입찰 알림
                        if (res.action === 'basicOrder') {
                            console.log(`${res.data.order.itemName}을(를) ${res.data.order.bidAmount} 코인에 입찰하였습니다.\n`)
                            return recursiveAsyncReadLine(socket, token);
                        }
                        // 판매자에게 알림
                        else if (res.action === 'noticeNewBid') {
                            console.log(`\n${res.data.order.itemName}을(를) ${res.data.order.bidder}유저가 ${res.data.order.bidAmount} 코인에 입찰하였습니다.\n`, res.data.order)
                        }
                        // 이전 입찰자에게 상위 입찰이 들어와 취소 되었음을 알림
                        else if (res.action === 'noticeCancelBid') {
                            console.log(`\n 입찰하셨던 ${res.data.order.itemName}을(를) ${res.data.order.bidAmount} 코인에 상위 입찰이 들어와 유저의 입찰이 취소되었습니다.\n`)
                        }
                        // 즉시 구매로 인한 경매 종료 판매자에게 알림
                        else if (res.action === 'immediateOrder') {
                            console.log(`${res.data.item.itemName}이 즉시 구매가 들어와 경매가 종료되었습니다.`)
                        }
                        // 경매 종료 낙찰 판매자에게 알림
                        else if (res.action === 'successfulBid' && res.seller) {
                            console.log(`\n경매 시간이 종료되어 ${res.data.order.itemName}을(를) ${res.data.order.bidder}유저가 ${res.data.order.bidAmount} 코인에 낙찰하였습니다.\n`, res.data.order)
                        }
                        // 경매 종료 낙찰 구매자에게 알림
                        else if (res.action === 'successfulBid') {
                            console.log(`\n경매 시간이 종료되어 ${res.data.order.itemName}을(를) ${res.data.order.bidAmount} 코인에 낙찰하였습니다.\n`, res.data.order)
                        }
                        // 경매 종료 입찰자 없어 판매자에게 알림
                        else if (res.action === 'endOfAuctionTime') {
                            console.log(`\n경매 시간이 종료되어 입찰자 없이 ${res.data.order.itemName}의 경매를 마감합니다. \n`, res.data.order)
                        }
                    })
                    socket.on('ojt:error', (res) => {
                        console.log('에러 발생', res);
                    });
                    return recursiveAsyncReadLine(socket, token);
                })
            } catch (e) {
                console.log('로그인에 실패했습니다.', e);
            }
        });
    });
}

/** test 새로 마든 것도 타자가 두 번 입력되는 문제 발생 **/
const test = () => {
    rl.question('Email: ', (answer) => {
        console.log(`Your email: ${answer}`);
        email = answer;
        rl.question('Password: ', async (answer) => {
            try {
                console.log(`Your password: ${answer}`);
                password = answer
            } catch (e) {
            }
        });
    });
};
// test();

login();