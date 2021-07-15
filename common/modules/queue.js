/** 우리 프로젝트에서 virtual or actual subscribe할 때 계속 인풋이 들어오면 가장 마지막에 선택한 걸로 만들기 위해 사용하는 push
 * push메서드: push(task, cb) - 완료 시 옵션 콜백과 함께 작업을 대기열에 푸시합니다. 티켓 개체를 반환합니다.
 * 인자를 하나밖에 못 받아서 상속받고 push를 오버라이딩 함 **/
'use strict'

const Queue = require('better-queue');

// new Sequeue()의 인자로 함수 넣는 것처럼 하기 위해서 baseFunc만듦, contructor() 실행 시 super에 인자로 넣음
async function baseFunc (job, callback) {
    await job();
    await callback();
}

class SeqQueue extends Queue {
    constructor() {
        super(baseFunc);
    }
    // seqQueue.push(task, cb)을 오버라이딩(상속받은 부모의 메소드를 재정의)
    // 그래서 seqQueue.push(함수(job), 함수에 들어갈 인자들)
    // 하지만 여긴 오버라이딩 한거지 실제로 job이 실행되진 않음
    // 실제로 job이 실행되기 위해 baseFunc를 만들고 그 안에서 실행
    // baseFunc가 constructor () { super(baseFunc) }에 들어가는 건
    // new Sequeue (baseFunc) 여기 들어가는 거와 같음
    async push(job, ...args) {
        super.push(async () => {
            await job(...args);
        })
    }
}

module.exports = SeqQueue;
