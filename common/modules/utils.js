function randomString() {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
    const string_length = 30;
    let randomstring = '';
    for (let i=0; i<string_length; i++) {
        const rnum = Math.floor(Math.random() * chars.length);
        randomstring += chars.substring(rnum,rnum+1);
    }
    return randomstring;
}
exports.randomString = randomString;

const checkAuctionTime = (auctionTimeList, auctionTime ) => {
    for (const possibleTime of auctionTimeList) {
        if (possibleTime == auctionTime) { // auctionTime이 문자열로 들어와서 '==' 타입 말고 값만 비교하는 연산자 사용
            return; // 가능한 시간이면 함수 끝남
        }
    }
    throw new Error('INVALID_AUCTION_TIME') // 정해진 경매 시간 목록 중 값이 아니라면 에러
}
exports.checkAuctionTime = checkAuctionTime;
