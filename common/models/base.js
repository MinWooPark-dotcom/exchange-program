/** 특정 모델이 아닌 여러 모델에서 사용하는 메서드가 있을 떄 BaseModel에 메서드 정의하고 다른 모델에서 extends로 상속받아서 씀 **/

"use strict";

const { Model } = require("sequelize");

class BaseModel extends Model {
    // constructor 생략 시 기본 생성자(constructor(){}) 만들어짐. 파생 클래스의 경우는 아래와 같음.
    // constructor(...args) {
    //     super(...args);
    // }

    // 아이템 모델 특정 로우가 아니라 전체에 접근하니 static
    static async isValidQuery(sort = 'ASC', by = 'createdAt', limit = '10', offset = '0') {
        if ((sort === 'ASC' || sort === 'DESC') &&
            (by === 'createdAt' || by === 'itemName' || by === 'ability') &&
            (limit === '10' || limit === '20' || limit === '30') &&
            (Number(offset) % 10 === 0)) {
            return;
        } else {
            throw new Error('INVALID_REQUEST_QUERY')
        }
    }
}


exports.BaseModel = BaseModel;
// module.exports = BaseModel; // moduel.exports 일 때는 에러 발생. 무슨 차이며 왜지?

// exports객체는 module.exports와 같음
// exports 객체는 module.exports 객체를 call by reference방식으로 바라보고 있음

// base.js를 item.js에서 const { BaseModel } = require('./base')하면 BaseModel 값이 없음.
// (node:59441) UnhandledPromiseRejectionWarning: TypeError: Class extends value undefined is not a constructor or null