/** enumerate: 열거하다.
 * 우리 프로젝트에서는 각종 값들을 작성해 놓고 가져다 씀 **/
'use strict';

exports.CONVERT_INTEGER_VALUE = 1000; // 소수점 세 자리까지 나올 수 있음. 그래서 미리 1000을 곱하고 계산 후 다시 1000으로 나누면 됨
exports.USER_SESSION_EXPIRE_TIME = 14400; // 4시간, 레디스에 저장하는 시간 set할 때 옵션으로 넣음
// exports.auctionTimeHoursList = [3600000, 10800000, 21600000, 43200000]; // auction time 설정 시 가능한 '시간' 단위, 1h->3600000ms, 3h->10800000ms 6h->21600000, 12h->43200000
// exports.auctionTimeMinutesList = [60000, 1800000]; // auction time 설정 시 가능한 '분' 단위, 1m->6000ms, 30m->180000ms
// exports.auctionTimeSecondsList = [10000, 20000, 30000]; // auction time 설정 시 가능한 '초' 단위, 10s->10000ms, 20s->20000ms, ...
/** 가능한 시간
 * 초: 10, 20, 30
 * 분: 1, 30
 * 시: 1, 3, 6, 12**/
exports.auctionTimeList = [10000, 20000, 30000, 60000, 1800000, 3600000, 10800000, 21600000, 43200000]