/** socketParser/server.js: API Server가 레디스에 pushQueue하면 소켓파서가 listenQueue로 받음
 * 소켓파서로 들어오는 레디스 큐 리슨하는 곳, 큐 들어왔을 때 실행될 로직은 logic/parser.js에 작성 **/

'use strict';

const model = require('../common/models')
const redisCtrl = require('../common/modules/redisCtrl');require('../common');
const { parseSocketData } = require('./logic/parser');

(async () => {
    await model.syncAllDB(); // model가져와서 쓰려면 웹소켓 서버에서 한 거 별개로 여기서도 해야하나? 테스트해보기
    await redisCtrl.listenQueue(`ojt:socket:parser`, parseSocketData); // routes에서 push해줌
})();