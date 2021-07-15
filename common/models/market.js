"use strict";
/** 각 모델에서 하는 일: 시퀄라이즈 init, realtion, 모델의 메서드 정의, 메서드 정의할 때 에러 클래스 가져와서 에러 처리 **/

const { DataTypes, Deferrable } = require("sequelize");
const { BaseModel } = require('./base');
const model = require('./Internal');

const marketAttributes = {
    id: {type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true,},
    // deferrable(연기할 수 있는): Deferrable.INITIALLY_DEFERRED(): 트랜잭션 끝까지 제약 조건 검사를 연기하는 속성입니다.
    // DEFERRED 제약 조건은 트랜잭션이 커밋 될 때까지 확인되지 않습니다.
    userId: {type: DataTypes.UUID, references: {model: "Users", key: "id", deferrable: Deferrable.INITIALLY_DEFERRED(),},},
    itemId: {type: DataTypes.UUID, references: {model: "Items", key: "id", deferrable: Deferrable.INITIALLY_DEFERRED()}},
    // 최초 입찰 금액
    initialBidAmount: {type: DataTypes.INTEGER}, // 최소 단위가 1이기 때문에 데이터 타입 정수
    // 즉시 구매 여부
    /** 7/15 피드백5: 필수 파라미터만 체크하고 immediateOrderStatus 옵션은 체크 안 함 **/
    immediateOrderStatus: {type: DataTypes.STRING},
    // 즉시 구매 가격
    immediateOrderPrice: {type: DataTypes.INTEGER},
    // 현재 입찰자
    bidder: {type: DataTypes.UUID, references: {model: "Users", key: "id", deferrable: Deferrable.INITIALLY_DEFERRED(),},},
    // 현재 입찰 금액, 처음 경매 등록 시 최초 입찰 금액만 존재, 현재 입찰 금액은 입찰이 들어와야 생김
    bidAmount: {type: DataTypes.INTEGER},
    // 경매 종료 시간
    endOfAuctionDate: {type: DataTypes.DATE, allowNull: false}, // 경매 종료 시간 Date객체
    // 경매 상태
    status: {type: DataTypes.STRING, allowNull: false, defaultValue: 'ONGOING'}, // 판매 중: ONGOING, 판매 완료: COMPLETED, 판매 취소: CANCELED
};

class MarketModel extends BaseModel {
    // constructor(...args) {
    //     super(...args); // 상속 클래스의 생성자에선 반드시 super(...)를 호출해야 함. 파생 클래스의 기본 생성자임
    // }

    static relationModel() {
        MarketModel.belongsTo(model.User, {foreignKey: "userId", targetKey: "id",});
        MarketModel.belongsTo(model.Item, {foreignKey: "itemId", targetKey: "id"});
    }

    static initModel(sequelize) {
        MarketModel.init(marketAttributes, {sequelize, modelName: "Market"});
    }

    /** 사용처:
     * 1. webSocket/logic/connector.js: 웹소켓으로 옥션리스트 건네줄 떄 사용(현재 사용 안 함)
     * 2. webSocket/logic/socket.js: API요청으로 경매 리스트 검색 시 사용(사용 중)
     * 경매 물품에 대한 정보 뭐 보여줘야각 하는지 고민 **/

    /** 여기서 경매 종료 시간을 계산하였는데 이에 대해 과장님께서 피드백 주셨음
     * 피드백: 만약 물건 100개가 있고 유저 100명이 접근하면 100 x 100 = 10000 만 번을 계산해야 함.
     * 굉장히 비효율적 => 애초에 경매 종료 시간을 db에 넣고 시간 계산은 모두 utc로 함 **/
    async convertInfoForm() {
        let bidderNickname;
        if (this.bidder) { // this는 Market의 인스턴스, bidder는 userId
            const bidder = await model['User'].findByPk(this.bidder)
            bidderNickname = bidder.nickname // 입찰할 때 누가 입찰했는지 알려주기 위함(id말고 nickname으로)
        }
        return {
            id: this.id,
            itemId: this.Item.id,
            itemName: this.Item.itemName,
            ability: this.Item.ability, // '속도 +10'
            seller: this.User.nickname, // 'test1'
            initialBidAmount: this.initialBidAmount, // 최초 입찰 금액
            immediateOrderStatus: this.immediateOrderStatus, // 즉시 구매 여부
            immediateOrderPrice: this.immediateOrderPrice, // 즉시 구매 가격
            bidderId: this.bidder,
            bidder: bidderNickname,
            bidAmount: this.bidAmount, // 현재 입찰 금액
            endOfAuctionDate: this.endOfAuctionDate // 경매 남은 시간
        };
    }

    /** 경매 등록 **/
    static async registerForSale(userId, itemId, initialBidAmount, date, price, status) {
        let marketForm = {
            userId: userId,
            itemId: itemId,
            initialBidAmount: initialBidAmount, // 최초 입찰가
            immediateOrderStatus: status, // 즉시 구매 여부
            immediateOrderPrice: price,  // 즉시 구매 금액
            endOfAuctionDate: date, // 경매 종료 시간
        };
        const newSaleRegistration = MarketModel.build(marketForm);
        return newSaleRegistration;
    }
}

module.exports = MarketModel;