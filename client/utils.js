const axios = require('axios');
const readline = require("readline");
/** readline.Interface클래스의 인스턴스는 readline.createInterface()메서드를 사용하여 생성 **/
// input은 ReadableStream ouput은 WritableStream과 연결됨.
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
exports.rl = rl;

const searchAuctionList = async (token, errorHandler) => {
    try{
        await axios.get('http://localhost:3000/market', {
            headers: {
                token: token
            }
        })
    } catch (e) {
        console.log('경매 리스트 검색에 실패했습니다.', e)
        return errorHandler();
    }
}
exports.searchAuctionList = searchAuctionList;

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

/** 2.경매 물품 검색하기 **/
const searchAuctionItem = (token, errorHandler) => {
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
            return errorHandler();
        }
    });
}
exports.searchAuctionItem = searchAuctionItem;

const registerAuction = (recursiveAsyncReadLine, token, errorHandler) => {
    rl.question("itemId: ", async function (itemId) {
        rl.question("최초 입찰액(최소 금액 1코인, 최소 단위 1): ", async function (initialBidAmount) {
            /** 7/15 피드백5: 필수 파라미터만 체크하고 immediateOrderStatus 옵션은 체크 안 함 **/
            rl.question("즉시 구매 여부(true or false로 입력해 주세요: ", async function (immediateOrderStatus) {
                switch (immediateOrderStatus) {
                    case "true":
                        immediateOrderStatus = true
                        break;
                    case "false":
                        /** 즉시 구매 불가면 즉시 구매 금액을 물어볼 필요가 없음
                         * => 바로 경매 시간으로 넘어감 **/
                        rl.question("경매 시간 단위(1.시간 2.분 3.초 중 원하시는 단위의 번호를 입력해 주세요): ", async function (auctionTimeUnit) {
                            switch (auctionTimeUnit) {
                                case "1":
                                    auctionTimeUnit = 'hours'
                                    break;
                                case "2":
                                    auctionTimeUnit = 'minutes'
                                    break;
                                case "3":
                                    auctionTimeUnit = 'seconds'
                                    break;
                                default:
                                    console.log('1~3번 중 하나를 입력해 주세요')
                                    return recursiveAsyncReadLine(token);
                            }
                            /** auctionTime 받은 걸 UTC(밀리세컨드)로 바꿔서 서버로 넘겨주기
                             * 시간: 1000(밀리세컨드) * 60 * 60 * auctionTime(입력 시간) = 시간을 밀리세컨드초로 변환
                             * 분: 1000 * 60 * auctionTime(입력 시간) = 분을 밀리세컨드로 변환
                             * 초: 1000 * auctionTime(입력 시간) = 초를 밀리세컨드로 변환
                             * cf. Math.floor() 함수는 주어진 숫자와 같거나 작은 정수 중에서 가장 큰 수를 반환합니다.(내림)
                             * **/
                            rl.question("경매 시간: ", async function (auctionTime) {
                                try {
                                    if (auctionTimeUnit === 'hours') {
                                        auctionTime = Math.floor(1000 * 60 * 60 * auctionTime);
                                    } else if (auctionTimeUnit === 'minutes') {
                                        auctionTime = Math.floor(1000 * 60 * auctionTime);
                                    } else {
                                        auctionTime = Math.floor(1000 * auctionTime);
                                    }
                                    await axios.post('http://localhost:3000/market/auction', {
                                        itemId: itemId,
                                        initialBidAmount: initialBidAmount,
                                        auctionTime: auctionTime,
                                    }, {
                                        headers: {
                                            token: token
                                        }
                                    });
                                } catch (e) {
                                    console.log('경매 등록에 실패했습니다.', e.response.data)
                                    return errorHandler();
                                }
                            });
                        });
                        break;
                    default:
                        console.log('true 또는 false를 입력해 주세요')
                        return errorHandler();
                }
                rl.question("즉시 구매 금액(최소 금액1코인, 최소 단위1): ", async function (immediateOrderPrice) {
                    rl.question("경매 시간 단위(1.시간 2.분 3.초 중 원하시는 단위의 번호를 입력해 주세요): ", async function (auctionTimeUnit) {
                        switch (auctionTimeUnit) {
                            case "1":
                                auctionTimeUnit = 'hours'
                                break;
                            case "2":
                                auctionTimeUnit = 'minutes'
                                break;
                            case "3":
                                auctionTimeUnit = 'seconds'
                                break;
                            default:
                                console.log('1~3번 중 하나를 입력해 주세요')
                                return errorHandler();
                        }
                        /** auctionTime 받은 걸 UTC값으로 바꿔서 서버로 넘겨주기
                         * UTC는 밀리세컨드 단위 사용
                         * 시간: 1000(밀리세컨드) * 60 * 60 * auctionTime(입력 시간) = 시간을 밀리세컨드초로 변환
                         * 분: 1000 * 60 * auctionTime(입력 시간) = 분을 밀리세컨드로 변환
                         * 초: 1000 * auctionTime(입력 시간) = 초를 밀리세컨드로 변환
                         * cf. Math.floor() 함수는 주어진 숫자와 같거나 작은 정수 중에서 가장 큰 수를 반환합니다.(내림)
                         * **/
                        rl.question("경매 시간: ", async function (auctionTime) {
                            try {
                                if (auctionTimeUnit === 'hours') {
                                    auctionTime = Math.floor(1000 * 60 * 60 * auctionTime);
                                } else if (auctionTimeUnit === 'minutes') {
                                    auctionTime = Math.floor(1000 * 60 * auctionTime);
                                } else {
                                    auctionTime = Math.floor(1000 * auctionTime);
                                }
                                await axios.post('http://localhost:3000/market/auction', {
                                    itemId: itemId,
                                    initialBidAmount: initialBidAmount,
                                    immediateOrderStatus: immediateOrderStatus,
                                    immediateOrderPrice: immediateOrderPrice,
                                    auctionTime: auctionTime,
                                }, {
                                    headers: {
                                        token: token
                                    }
                                });
                            } catch (e) {
                                console.log('경매 등록에 실패했습니다.', e.response)
                                return errorHandler();
                            }
                        });
                    });
                });
            });
        });
    });
}
exports.registerAuction = registerAuction;

/** 경매 리스트 검색 시 즉시 구매 or 입찰할 지 물어봄 **/
/** 7/15 피드백6: 입찰-즉시 구매가 예외처리(즉시구매가보다 비싼 금액으로 입찰하면 에러)
 * 클라이언트에서 확인하는 방법은 마켓 아이디로 auctionList를 체크해서 즉시 구매가를 알아내고 유저가 입찰한 입찰액과 비교 **/
const immediateOrderOrBid = (recursiveAsyncReadLine, auctionList, token, errorHandler) => {
    /** 즉시 구매 불가 상품은 즉시 구매가 애초에 선택지에 없으면 좋은데 불가능한 이유는 경매 리스트를 본 후 그 중에서 구매를 진행하기 때문에 그 중에 즉시 구매가 가능한 것도 있고
     * 불가능한 아이템도 섞여 있으므로 메뉴에서 미리 제외할 수 없었음. 그래서 즉시 구매 안되는 물건을 즉시 구매 요청하면 예외 처리 해야 함. **/
    rl.question('\n 1.즉시 구매하기 2.입찰하기 3.메뉴로 돌아가기', async (answer) => {
        try {
            switch (answer) {
                case "1":
                    rl.question("즉시 구매할 marketId를 입력해 주세요: ", async function (marketId) {
                        try {
                            /** 추가 8번: 즉시 구매 불가 상품을 즉시 구매 했을 때 예외 처리 **/
                            const auctionItem = auctionList.filter(el => el.id === marketId)[0];
                            if (!auctionItem.immediateOrderStatus) {
                                console.log('에러: 즉시 구매 가능한 아이템이 아닙니다.')
                                return errorHandler();
                            }
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
                    break;
                case "2":
                    rl.question("입찰할 marketId: ", async function (marketId) {
                        const auctionItem = auctionList.filter(el => el.id === marketId)[0];
                        // if (!auctionItem) throw new Error('INVALID_MARKET_ID')
                        if (!auctionItem) {
                            console.log('에러: marketId를 잘못 입력하셨습니다.')
                            errorHandler();
                        }
                        /** 7/15 피드백6. 입찰-즉시구매가 예외처리(즉구보다 입찰이 비싸면 에러 처리 클라이언트에서 먼저, 서버는 API에서 처리 **/
                        rl.question("입찰액: ", async function (bidAmount) {
                            try {
                                // 즉시 구매가보다 낮은 금액으로만 입찰 가능
                                if (auctionItem.immediateOrderPrice <= bidAmount) {
                                    console.log('에러: 입찰액이 즉시 구매가보다 크거나 같아 입찰이 진행되지 않았습니다.')
                                    return errorHandler();
                                }
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
                                return errorHandler();
                            }
                        });
                    });
                    break;
                case "3":
                    console.log('메뉴로 돌아가기를 선택하셨습니다.')
                    return recursiveAsyncReadLine(token);
                default:
                    console.log("잘못된 번호를 입력하셨습니다. \n초기 메뉴 선택으로 돌아갑니다.");
                    // 여기서 다시 아이템 구입하기로 가야하는데 아예 메뉴 선택으로 가버림
                    return recursiveAsyncReadLine(token);
            }
        } catch (e) {
            console.log(e)
        }
    });
}
exports.immediateOrderOrBid = immediateOrderOrBid;