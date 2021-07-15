// 해당 파일의 목적: 순환참조를 막기 위해 여기서 먼저 모든 모델들을 가져오고 이 파일로 부터 모델을 가져다 쓰는 방식을 사용하기 위함.
// 해당 파일에서 할 일 : 1. 시퀄라이즈 연결 2. 각 모델을 불러오는 관리자 모델 생성 3.
"use strict";

// Sequelize는 생성자, config에서 데이터베이스 설정 불러와서 new Seqeulize로 postgre 연결 객체 생성
const { Sequelize } = require("sequelize");
const env = process.env.NODE_ENV || "development";
// 데이터베이스 설정
const config = require("../modules/config");

// postgres 연결 객체, 옵션에는 host, dialect pool, logging등이 들어감. 공식문서 참고
const sequelize = new Sequelize(
    config["postgreSql"].database,
    config["postgreSql"].userName,
    config["postgreSql"].password,
    config["postgreSql"]["options"]
);

let instance = null;

class ModelManager {
    constructor() {
        this.sequelize = sequelize; // routes에서 sequelize.transaction()할 때 사용, 연결 끊을 때 사용하기 위함
    }
    // DB 싱크할 때 각 모델 파일 한 번에 가져오기 위함.
    getModelFileList() {
        return [
            'user.js', 'market.js', 'item.js'
        ];
    }
    async syncAllDB() {
        try {
            const fileNameList = this.getModelFileList();
            const db = {};
            const modelOptions = {alter: true};
            for (const fileName of fileNameList) {
                const model = require(`./${fileName}`);
                model.initModel(sequelize); // 각 모델에서 init 하는 메서드 만들어 둔 거 실행
                await model.sync(modelOptions); // 시퀄라이즈 모델 동기화
                db[model.name] = model; // 각 모델 파일에서 init메서드 두 번째 인자 옵션의 modelName
            }
            for (const modelName in db) { // 위에서 만든 db 배열 for .. of문으로 각 모델이름 가져옴.
                if (db[modelName].relationModel && typeof db[modelName].relationModel == 'function') {  // 각 모델의 relationModel 정적 메서드 안에 hasMany, belongsTo 등 관계 설정 로직 있음. ? 그냥 typeof 문만 있으면 되지 않나? typeof문이 있는게 전자가 있다는 증거이니까
                    db[modelName].relationModel();
                }
            }
            // 여기까지가 init, associate 임. 이걸 묶어서 sync함수를 만들고 모든 DB를 한 번에 함. 이걸 모듈화한 이유는 기존 프로젝트에서는 각 서버가 여러 개이고 각자 서버에서 싱크를 해야하니까
        } catch(e) {
            console.log('e', e)
            throw e;
        }
    }
    // DB 싱크 끊을 때 사용
    disconnectDB() {
        this.sequelize.close().catch(err => {console.log(err)});
    }

    // 게더함수
    get User () {
        return require('./user');
    }

    get Market () {
        return require('./market');
    }

    get Item () {
        return require('./item');
    }

    static getInstance() {
        if(instance == null) {
            instance = new ModelManager();
        }
        return instance;
    }
}

module.exports = ModelManager.getInstance();