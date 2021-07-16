/** 메뉴 선택하면 리스트들이 나오도록, 이건 클라이언트에서 메모리를 사용하여 유저맵, 아이템 리스트들을 만들어야 함.**/
const axios = require('axios');
const io = require('socket.io-client');
/** 7/15 피드백7: 인덴트 너무 큼 => 인덴트 크고 자주 쓰는 것들 함수화 하여 사용 **/
const {
    rl,
    searchAuctionList,
    getRemainingAuctionTime,
    searchAuctionItem,
    registerAuction,
    immediateOrderOrBid,
} = require('./utils');

let email; // 로그인할 떄 사용
let password; // 로그인할 떄 사용
let token;  // 로그인 시 얻은 토큰 담을 때 사용 -> 소켓 연결 시 쿼리로 넣음
let socket;  // 소켓 연결 객체 담을 때 사용
let itemList = []; // 유저에게 콘솔로 보여줄 아이템 리스트

/** 7/15 피드백1: userMap.token에서 token필요없음 => 유저 맵에는 클라이언트 1명만 존재하니까 **/
// 유저맵에 토큰으로 접근하면 발란스, 아이템 정보 가져올 수 있음.
const userMap = {}
// userMap 형태:
// {
// balance : 1234, items: [{itemId: 'aaaa', itemName: 'a', ability: 'b', status: 'c',}, {...}, ...], ability: 'b', status: 'c'}
// }
// 세일리스트는 마켓에 등록 되있는 물품 정보 가져옴, balance, items처럼 개인적인 내용이 아니라 userMap과 따로
let auctionList = []
// auctionList 형태: [{id: 'a', itemName: 'b', ability: 'c', price: 111, seller: 'd'}, {...}, ...]

const recursiveAsyncReadLine = async function (token) {
    rl.question("1.경매 물품 리스트 보기 2.경매 물품 검색하기 3.경매 물품 등록하기 4.인벤토리 확인 5.지갑 정보 6.로그아웃 7.프로그램 종료 \n", async function (answer) {
        switch (answer) {
            /** 1. 경매 물품 리스트 보기 **/
            case "1":
                console.log('1번 \'경매 물품 리스트 보기\' 선택하셨습니다.');
                await searchAuctionList(token, errorHandler)
                break;
            /** 2. 경매 물품 검색하기 **/
            case "2":
                console.log('2번 \'경매 물품 검색을\' 선택하셨습니다.');
                rl.question('1. 검색할 물품 이름 입력하기 2. 메뉴 선택 돌아가기', async (answer) => {
                    switch (answer) {
                        case "1":
                            searchAuctionItem(token, errorHandler);
                            break;
                        case "2":
                            console.log("메뉴 선택으로 돌아갑니다");
                            return recursiveAsyncReadLine(token);
                            break;
                        default:
                            console.log("1~2번 숫자를 입력해 주세요");
                            return recursiveAsyncReadLine(token);
                    }
                });
                break;
            /** 3. 경매 물품 등록하기 **/
            case "3":
                console.log('1번 \'경매 물품 등록하기를 \' 선택하셨습니다.');
                // 유저 맵에서 유저 아이템 가져옴
                itemList = userMap.items.filter(el => el.status === 'UNUSED');
                console.log(`${userMap.nickname}님의 인벤토리입니다. \n`, itemList);
                rl.question('\n 1. 경매에 물품 등록하기 2. 메뉴 선택 돌아가기', async (answer) => {
                    switch (answer) {
                        case "1":
                            if (itemList.length === 0) {
                                console.log('보유하고 있는 아이템이 없습니다.')
                                errorHandler();
                            }
                            registerAuction(recursiveAsyncReadLine, token, errorHandler)
                            break;
                        case "2":
                            console.log("메뉴 선택으로 돌아갑니다");
                            itemList = []; // 아예 빈 배열로 만들면 매번 판매 등록 클릭할 때 마다 새로 넣어서 중복 안 생김
                            return recursiveAsyncReadLine(token);
                            break;
                        default:
                            console.log("1~2번 숫자를 입력해 주세요");
                            itemList = []; // 아예 빈 배열로 만들면 매번 판매 등록 클릭할 때 마다 새로 넣어서 중복 안 생김
                            // 여기서 다시 아이템 구입하기로 가야하는데 아예 메뉴 선택으로 가버림
                            return recursiveAsyncReadLine(token);
                    }
                });
                break;
            /** 4. 인벤토리 확인 **/
            case "4":
                itemList = []; // 아예 빈 배열로 만들면 매번 판매 등록 클릭할 때 마다 새로 넣어서 중복 안 생김
                console.log('4번 \'인벤토리 확인\'을 선택하셨습니다.')
                // 유저 맵에서 유저 아이템 가져옴
                for (const item of userMap.items) {
                    if (item.status === 'UNUSED') {
                        itemList.push(item)
                    }
                }
                console.log(`${userMap.nickname}님의 인벤토리입니다. \n`, itemList);
                errorHandler() // 에러는 아니지만 메뉴로 돌아가는 템플릿이 같아서 일단 사용
                break;
            /** 지갑 정보 확인 **/
            case "5":
                console.log('5번 \'지갑 정보 확인\'을 선택하셨습니다.')
                console.log(`보유 코인: ${userMap.balance}코인`)
                errorHandler() // 에러는 아니지만 메뉴로 돌아가는 템플릿이 같아서 일단 사용
                break;
            /** 6. 로그아웃 **/
            case "6":
                console.log('로그아웃 하였습니다.');
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
            /** 7. 프로그램 종료 **/
            case "7":
                console.log('프로그램을 종료합니다.')
                process.exit();
            default:
                console.log("1~4번 숫자를 입력해 주세요");
                return recursiveAsyncReadLine(socket, token);
        }
    });
};

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
                );
                token = userInfo.data.token // 소켓 연결하기 위한 토큰
                userMap.nickname = userInfo.data.user.nickname; // 로그인 후 메뉴 선택 시 유저 닉네임 보여주기 위함
                userMap.items = [];
                /** 커넥트할 때 주소 뒤에 네임스페이스를 붙이면 서버에서 해당 네임스페이스로 보낸 데이터만 받을 수 있음
                 * socket.io-client 모듈이여서 connect함수는 안쓰고 바로 io()로 사용
                 * 네임스페이스보다 더 세부적인 개념으로 방(room)있음 **/
                socket = io(`http://localhost:3003?token=${token}`);  //3001번 포트 사용(서버), token => 정상으로 emit 받음
                // socket.on은 비동기, connect가 되고나서 콜백 함수가 실행
                /** .on은 이벤트 등록, 그렇기 떄문에 한 번 등록해 두어서 아래 함수가 끝나도 해당 이벤트이름으로 이벤트가 발생하면 이벤트 리스너의 콜백함수가 실행됨 **/
                socket.on('connect', () => {
                    console.log('client socket 연결 완료 \n')
                    socket.on('ojt:balance', (res) => {
                        // console.log('balance res',res)
                        userMap.balance = res.data.coin
                    })
                    socket.on('ojt:items', (res) => {
                        // console.log('items res', res);
                        if (res.snapshot) {
                            for (const item of res.data.itemList) {
                                userMap.items.push(item)
                            }
                        }  else if (res.action === 'immediateOrder') {
                            /** 7/15 피드백2: 아이템 객체 받은 거 userMap에 저장(인벤토리 확인 시 보여줘야 함), push하는 코드 누락됬었음 **/
                            userMap.items.push(res.data.item)
                            /** 7/15 피드백3: result를 [] 감싼 건 불필요한 코드임. 클라이어트에서 그냥 받을 수 있음 **/
                            console.log(`${res.data.item.itemName}을 구입하였습니다.\n`, res.data.item)
                            return recursiveAsyncReadLine(token);
                        }   else if (res.action === 'saleCompleted') {
                            console.log(`${res.data.item.itemName} 판매 완료되었습니다.`, res.data.item)
                            auctionList = auctionList.filter(el => el.itemId !== res.data.item.itemId); // 판매 완료 후 saleList에서 제거, 작동 확인
                        } else if (res.action === 'registerAuction') {
                            userMap.items = userMap.items.filter(el => el.itemId !== res.data.itemId);
                        } else if (res.action === 'endOfAuctionTime') {
                            userMap.items.push(res.data.item);
                        }
                    });
                    socket.on('ojt:auctionList', (res) => {
                        // console.log('auctionList res', res);
                        /** 경매 등록 **/
                        if (res.action === 'registerAuction') {
                            if (res.seller) {
                                console.log(`\'${res.data.auctionItem.itemName}\' 판매 등록이 완료되었습니다.\n`, res.data.auctionItem)
                                auctionList.push(res.data.auctionItem)
                                return recursiveAsyncReadLine(token);
                            }
                            /** 판매자 포함 모든 유저들의 판매 목록에 추가하기 위함, emit 두 번 함. in으로 특정 소켓(판매자), sockets로 모든 유저 **/
                            auctionList.push(res.data.auctionItem)
                        } else if (res.action === 'searchAuctionList') {
                            if (res.data.auctionList.length > 0) {
                                for (const auctionItem of res.data.auctionList) {
                                    auctionList.push(auctionItem)
                                }
                                getRemainingAuctionTime(res.data.auctionList) // 경매 남은 시간 구하는 함수
                                immediateOrderOrBid(recursiveAsyncReadLine, auctionList, token, errorHandler) // 검색 결과 나오면 1.즉시 구매 2.입찰 3.메뉴로 돌아가기 선택지 나옴
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
                            return recursiveAsyncReadLine(token);
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
                    return recursiveAsyncReadLine(token);
                })
            } catch (e) {
                console.log('로그인에 실패했습니다.', e);
            }
        });
    });
}

/** errorHandler를 utils로 안 뺸 이유:
 * 예를 들어 경매 리스트 검색 시 await searchAuctionList(token, errorHandler)할 때 errorHandler함수를 인자로 주는데
 * errorHandler에 필요ㅕ한 인자가 token, recursiveAsyncReadLine, login이 있어서 errorHandler 넣을 때 부가적으로 필요한 인자들이 많아져서 번거로움 **/
const errorHandler = () => {
    rl.question("1.메뉴로 돌아가기 2.로그아웃 3.프로그램 종료", async function (answer) {
        switch (answer) {
            case "1":
                return recursiveAsyncReadLine(token);
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

login();