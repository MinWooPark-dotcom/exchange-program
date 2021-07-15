// /** defer 안되서 테스트 **/
//
// "use strict";
//
// const {Sequelize, DataTypes, Model, Deferrable, Op} = require("sequelize");
// const { BaseModel } = require('./base');
// const model = require('./Internal');
// const {
//     SessionError,
//     ParameterError,
//     DoNotHaveItemError
// } = require('../modules/error');
//
// const marketAttributes = {
//     id: {type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true,},
//     userId: {type: DataTypes.UUID, references: {model: "Users", key: "id", deferrable: Deferrable.INITIALLY_DEFERRED(),},},
//     itemId: {type: DataTypes.UUID, references: {model: "Items", key: "id", deferrable: Deferrable.INITIALLY_DEFERRED(),},},
//     price: {type: DataTypes.FLOAT, allowNull: false},
//     status: {type: DataTypes.STRING, allowNull: false, defaultValue: 'ONGOING'}, // 판매 중: ONGOING, 판매 완료: COMPLETED, 판매 취소: CANCELED
// };
//
// class MarketModel extends BaseModel {
//     // constructor(...args) {
//     //     super(...args); // 상속 클래스의 생성자에선 반드시 super(...)를 호출해야 함. 파생 클래스의 기본 생성자임
//     // }
//
//     static relationModel() {
//         MarketModel.belongsTo(model.User, {foreignKey: "userId", targetKey: "id",});
//         MarketModel.belongsTo(model.Item, {foreignKey: "itemId", targetKey: "id"});
//     }
//
//     static initModel(sequelize) {
//         MarketModel.init(marketAttributes, {sequelize, modelName: "Market"});
//     }
//
//     async convertInfoForm() {
//         return {
//             id: this.id,
//             itemId: this.Item.id,
//             itemName: this.Item.itemName,
//             ability: this.Item.ability, // '속도 +10'
//             price: this.price,
//             seller: this.User.nickname, // 'test1'
//             // createdAt: this.createdAt,
//             // updatedAt: this.updatedAt,
//         };
//     }
//
//     // 웹소켓으로 판매 리스트 보내줘서 안 씀
//     // * 피드백: 파라미터 받는 값 중에 없을 수도 있는 건 맨 뒤로 주로 보냄. itemName을 맨 뒤로, 근데 일단 괜찮다고 하심
//     // static async searchItem(sort = 'ASC', by = 'createdAt', limit = '10', offset = '0', itemName) {
//     //     // * 피드백: 과장님 팁인데 이렇게 경우에 따라 달라질 수 있는 옵션은 먼저 필수 틀을 만들고 조건문에 따라 옵션을 추가하도록 함
//     //     const itemSearchOptions = {
//     //         model: model['Item'],
//     //         attributes: ['id', 'itemName', 'ability', 'status'],
//     //         order: [[by, sort]]
//     //     }
//     //     if(itemName) {
//     //         itemSearchOptions['where'] = {itemName}
//     //     }
//     //     // 위에서 조건문에 따른 옵션 만들고 include에서 사용
//     //         const saleList = await MarketModel.findAll({
//     //             include: [
//     //                 itemSearchOptions,
//     //                 {
//     //                     model: model['User'],
//     //                     attributes: ["nickname"],
//     //                 },
//     //             ],
//     //             where : {
//     //                 status: 'ONGOING'
//     //             },
//     //             limit: limit,
//     //             offset: offset
//     //         });
//     //         if (saleList) {
//     //             const result = [];
//     //             for(const item of saleList) {
//     //                 result.push(await item.convertInfoForm());
//     //             }
//     //             return result;
//     //         } else {
//     //             return []; // 검색한 아이템이 시장에 판매 중인게 없는 경우 빈 배열 리턴
//     //             // throw new Error('NO_ITEMS_ON_SALE') // 에러는 아니니 빈 배열 리턴
//     //         }
//     // }
//
//     // 물건 판매 등록, 이 메서드 쓰기 이전에 이미 userId, itemId등을 다 검사하기 때문에 체크 스킵, Price는 여기서 처음 확인
//     static async registerForSale(userId, itemId, price) {
//         // itemId, price가 언디파인드로 나옴
//         let marketForm = {
//             userId: userId,
//             itemId: itemId,
//             price: price,
//             // status는 기본 값으로 등록되면 'ONGOING'함
//         };
//         const newSaleRegistration = MarketModel.build(marketForm);
//         return newSaleRegistration;
//     }
// }
//
// module.exports = MarketModel;