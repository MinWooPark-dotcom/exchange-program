"use strict";

const {DataTypes, Deferrable} = require("sequelize");
const { BaseModel } = require('./base');
const model = require('./Internal');

// 회원가입 시 10개 아이템 랜덤으로 지급하기 위해 만들어둔 아이템 목록
const itemKeyMap = {
    검: "힘 +10",
    해머: "힘 +20",
    창: "힘 +30",
    활: "힘 +10, 사거리 +15",
    지팡이: "지능 +20",
    총: "힘 +15, 사거리 +10",
    대포: "힘 +50, 사거리 +20",
    폭탄: "힘 +40",
    투구: "방어력 +10",
    갑옷: "방어력 +20",
    신발: "방어력 +5, 속도 +10",
    말: "속도 +10",
    자동차: "속도 +30",
    비행기: "속도 +200",
    체력포션: "체력 +30",
    마력포션: "마력 +30",
    망원경: "사거리 +20",
    장갑: "힘 +10, 정확도 +10",
};

const itemAttributes = {
    id: {type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true,},
    userId: {type: DataTypes.UUID, references: {model: "Users", key: "id", deferrable: Deferrable.INITIALLY_DEFERRED(),},},
    itemName: {type: DataTypes.STRING, allowNull: false},
    ability: {type: DataTypes.STRING, allowNull: false},
    status: {type: DataTypes.STRING, allowNull: false, defaultValue: 'UNUSED'}, // 판매 안할 때, 판매 취소: UNUSED, 판매 중: REGISTERED,
}

// isValidQuery 메서드가 item과 market 모델 두 곳 모두에서 중복으로 만들어서 부모 클래스 BaseModel에 만들고 상속받음
class ItemModel extends BaseModel {
    static relationModel() {
        ItemModel.belongsTo(model.User, {foreignKey: "userId", targetKey: "id"});
        ItemModel.hasOne(model.Market, {foreignKey: "itemId", sourceKey: "id"});
    }

    static initModel(sequelize) {
        // init(attributes: object, options: object), attributes는 각 테이블의 열, 옵션은 seqeulize(새 모델에 연결할 sequelize 인스턴스를 정의합니다. 아무것도 제공되지 않으면 오류가 발생합니다), modelName 모델명 설정, 기본값은 클래스 이름과 동일함.
        ItemModel.init(itemAttributes, {sequelize, modelName: "Item"});
    }

    /** 웹소켓으로 아이템 건네줄 때 사용
     * 아이템에 대한 정보 뭐 보내줘야 하는지 고민 **/
    async convertInfoForm() {
        return {
            itemId: this.id,
            itemName: this.itemName,
            ability: this.ability,
            status: this.status // 물건 구입 후 클라이언트에서 userMap.items에 넣을 때 상태가 'UNUSED'인지 확인하기 위함
        }
    }

    // routes/market.js 24줄, 유저가 입력한 아이템 이릉이 문자 중 일부분만 맞더라도 찾게 도와줌.
    /** 피드백: search, match 찾아보기 => 검색 결과 없어도 에러 x, 모든 글자 검색 안 해도 결과 나오게, **/
    static async getFullItemName(itemName) {
        for(let item in itemKeyMap) {
            if(item.search(itemName) >= 0) { return item; } // 일치하는 문자가 있으면 n번 째 값, 없으면 -1
            // if(Array.isArray(item.match(itemName))) { return;} // 일치하는 문자가 있으면 [], 없으면 null
        }
    }

    static async generateItems(userId) {
        if (!userId) throw new Error('INVALID_USER_ID');
        const itemKeys = Object.keys(itemKeyMap); // 객체의 키를 배열로 만듦
        // 여기서 랜덤으로 10개만 생성해야 함.
        for (let i = 0; i < 10; i++) {
            let key = itemKeys[Math.floor(Math.random() * itemKeys.length)];
            const item = ItemModel.build({
                userId: userId,
                itemName: key,
                ability: itemKeyMap[key],
            });
            await item.save();
        }
    }
}

module.exports = ItemModel