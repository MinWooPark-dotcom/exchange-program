/** 다양한 곳에서 쓰인느 환경설정 값들 작성 **/
require("dotenv").config();

const configMap = {
    postgreSql: {
        database: process.env.POSTGRE_DATABASE,
        userName: process.env.POSTGRE_USERNAME,
        password: process.env.POSTGRE_PASSWORD,
        options: {
            dialect: process.env.POSTGRE_OPTIONS_DIALECT,
            host: process.env.POSTGRE_OPTIONS_HOST,
            timezone: process.env.POSTGRE_OPTIONS_TIMEZONE,
            // pool:
            // pool: {
            //     max: parseInt(process.env.POSTGRE_OPTIONS_POOL_MAX),
            //     min: parseInt(process.env.POSTGRE_OPTIONS_POOL_MIN),
            //     idle: parseInt(process.env.POSTGRE_OPTIONS_POOL_IDLE)
            // },
            // POSTGRE
            logging: process.env.POSTGRE_OPTIONS_LOGGING == 0 ? console.log : false, // 기본적으로 Sequelize는 수행하는 모든 SQL 쿼리를 콘솔에 기록합니다. 기본 값은 console.log, 기능 끄려면 false
        },
    },
    redis: {
        base_info: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
            db: process.env.REDIS_DB
        },
    },
};

module.exports = configMap;
