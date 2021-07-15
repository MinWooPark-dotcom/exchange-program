/** 발생할 에러에 대한 코드명을 작성 **/
'use strict';

// 지금은 사실 OjtError를 만들 필요는 없음. 여러 에러 클래스 만들게 아니니까
class OjtError extends Error {
    constructor() {
        super();
    }
}
exports.OjtError = OjtError;

/**signUp**/
// signUp, 이미 등록한 이메일이 있을 때
class UserEmailAlreadyRegisteredError extends OjtError {
    constructor() {
        super();
        this.code = 'ALREADY_REGISTERED_EMAIL';
    }
};
exports.UserEmailAlreadyRegisteredError = UserEmailAlreadyRegisteredError

 // signUp, 이미 등록한 닉네임이 있을 때
class UserNicknameAlreadyRegisteredError extends OjtError {
    constructor() {
        super();
        this.code = 'ALREADY_REGISTERED_NICKNAME';
    }
};
exports.UserNicknameAlreadyRegisteredError = UserNicknameAlreadyRegisteredError

/**signIn**/
// signIn, 로그인 시 없는 계정으로 로그인
class NotFindUserError extends OjtError {
    constructor() {
        super();
        this.code = 'NOT_OTJ_MARKET_USER';
    }
};
exports.NotFindUserError = NotFindUserError

// signIn, 로그인 시 잘못된 패스워드 입력
class InvalidPasswordError extends OjtError {
    constructor() {
        super();
        this.code = 'NOT_CORRESPOND_PW';
    }
};
exports.InvalidPasswordError = InvalidPasswordError;

/**logOut**/
class TokenError extends OjtError {
    constructor() {
        super();
        this.code = 'NONE_USER_TOKEN';
    }
}

exports.SessionError = TokenError

// parmeter error handling  일단 기존 틀 가져왔는데 descStr, ...args는 어떤 역할을 하지? 분석해보기, Params 에러 클래스는 왜 withoutLogging 클래스를 상속 받지 않을까?
class OjtErrorWithParams extends OjtError {
    constructor() {
        super();
    }
}

class ParameterError extends OjtErrorWithParams {
    constructor() {
        super();
        this.code = 'INVALID_PARAMETER';
    }
};

exports.ParameterError = ParameterError

// 회원가입 시 랜덤으로 아이템 10개 지급하는데 이 떄 에러인 경우
class GenerateItemsError extends OjtError {
    constructor() {
        super();
        this.code = 'FAILED_TO_CREATE_ITEMS'
    }
}
exports.GenerateItemsError = GenerateItemsError

/** Item **/
class DoNotHaveItemError extends OjtError {
    constructor() {
        super();
        this.code = 'DO_NOT_HAVE_ITEM'
    }
}

exports.DoNotHaveItemError = DoNotHaveItemError