"use strict"
/** 각 모델에서 하는 일: 시퀄라이즈 init, realtion, 모델의 메서드 정의, 메서드 정의할 때 에러 클래스 가져와서 에러 처리 **/

const {DataTypes, Model} = require("sequelize"); // DataTypes은 컬럼 속성 정의할 때, Model은 UserModel 만들 때 상솏받을 용
const { redisCtrl } = require('../index') // 레디스 관련
const crypto = require("crypto");
const { CONVERT_INTEGER_VALUE } = require('../enum')
const model = require('./Internal');
const {
    NotFindUserError,
    InvalidPasswordError,
    UserEmailAlreadyRegisteredError,
    UserNicknameAlreadyRegisteredError,
} = require('../modules/error');

const userAttributes = {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {isEmail: true},
    },
    password: {type: DataTypes.STRING, allowNull: false},
    nickname: {type: DataTypes.STRING, allowNull: false, unique: true},
    salt: {type: DataTypes.STRING},
    balance: {type: DataTypes.FLOAT, defaultValue: 100000 * CONVERT_INTEGER_VALUE}, // 부동소수점 해결하기 위해 미리 CONVERT_INTEGER_VALUE(1000)을 곱해서 저장
    status: {type: DataTypes.STRING, allowNull: false, defaultValue: 'ALIVE'},
}

class UserModel extends Model {
    static relationModel() {
        UserModel.hasMany(model.Item, {foreignKey: "userId", sourceKey: "id"});
        UserModel.hasMany(model.Market, {foreignKey: "userId", sourceKey: "id"});
    }

    static initModel(sequelize) {
        // init(attributes: object, options: object), attributes는 각 테이블의 열, 옵션은 seqeulize(새 모델에 연결할 sequelize 인스턴스를 정의합니다. 아무것도 제공되지 않으면 오류가 발생합니다), modelName 모델명 설정, 기본값은 클래스 이름과 동일함.
        UserModel.init(userAttributes, {sequelize, modelName: "User"});
    }

    convertInfoForm() {
        return {
            id: this.id,
            email: this.email,
            nickname: this.nickname,
            // balance: this.balance // 웹소켓으로 주니까 안줘도 됨.
        };
    }

    static async signInByToken(token) {
        const userInfo = await redisCtrl.getUserSession(token);
        if(!userInfo) throw new Error('AuthTokenExpiredError');
        const userModel = new model['User'](userInfo);
        return userModel;
    }

    static generateSalt() {
        // crypto.randomBytes(size[, callback]), size <number> The number of bytes to generate. The size must not be larger than 2**31 - 1, 리턴값 Buffer
        return crypto.randomBytes(16).toString("base64");
    }

    static encryptPassword(plainText, salt) {
        // crypto.createHash(algorithm[, options])
        return crypto
            .createHash("RSA-SHA256")
            .update(plainText) // 유저 비밀번호
            .update(salt) // 솔트
            .digest("hex"); // hash.digest([encoding]), digest에는 어떤 인코딩 방식으로 암호화된 문자열을 표시할지 정함. hex는 16진법
    }

    // 로그인 시 패스워드 유효성 검사
    validatePassword(enteredPassword) {
        return UserModel.encryptPassword(enteredPassword, this.salt) === this.password;
    }

    // 가입 시 이메일 중복 검사
    static async validateEmail(email) {
        const userModel = await UserModel.findOne({where: {email: email}});
        if (userModel) throw new UserEmailAlreadyRegisteredError();
    }

    // 가입 시 닉네임 중복 검사
    static async validateUserNickName(nickname) {
        const userModel = await UserModel.findOne({where: {nickname}});
        if (userModel) throw new UserNicknameAlreadyRegisteredError();
    }

    // signup - 모델 인스턴스 생성, signup으로 post 보내기 전에 email, nickname 중복 확인을 하기에 앞에 통과했다는 가정하에 makeNew에서는 따로 검사하지 않음. 그리고 어차피 email컬럼이 unique이기 떄문에 에러가 나긴 함.
    static async makeNew(userData) {
        const salt = UserModel.generateSalt();
        let userForm = {
            email: userData.email,
            password: UserModel.encryptPassword(userData.password, salt),
            nickname: userData.nickname,
            salt: salt,
        };
        const user = UserModel.build(userForm);
        return user;
    }

    // Email, Password로 로그인
    static async signInByEmailAndPassword(email, password) {
        const user = await UserModel.findOne({where: {email: email}});
        // 잘못된 아이디 입력 에러 처리
        if (!user) throw new NotFindUserError();
        // 잘못된 비밀번호 입력 에러 처리
        if (!user.validatePassword(password)) {
            throw new InvalidPasswordError();
        } else {
            return user;
        }
    }
}

module.exports = UserModel;