/** app.js: 미들웨어 작성 **/
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const {errorHandler} = require('./handler/packetHandler');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
// const itemsRouter = require('./routes/items'); // 인벤토리는 처음 로그인 시 웹소켓으로 정보 주고 변할 때 마다 웹소켓 서버가 알아서 보내기 떄문에 api 필요없음
const marketRouter = require('./routes/market');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/market', marketRouter);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
// app.use(function(err, req, res, next) {
//   // set locals, only providing error in development
//   res.locals.message = err.message;
//   res.locals.error = req.app.get('env') === 'development' ? err : {};
//
//   // render the error page
//   res.status(err.status || 500);
//   res.render('error');
// });

/** api 각 요청에서 에러가 발생한다면 catch문에 걸리고 catch문에서는 next(e)로 다음 미들웨어의 인자로 넣어줌.
 * catch문에서 next()하면 errorHandler함수 실행 **/

// error handler
app.use(errorHandler);

module.exports = app;
