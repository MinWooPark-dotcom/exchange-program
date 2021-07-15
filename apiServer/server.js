#!/usr/bin/env node
// server.js: www파일(http 모듈에 express 모듈 연결하고 포트 지정) 내용 가져옴. app.js에서 Model.sync를 sequelize.sync로 한 번에 했던 부분을 여기서 처리해 줌.
// www 파일 기능 + Model.sync, sync가 되면 www파일 기능 수행
const model = require("../common/models");
const env = process.env.NODE_ENV || "development";

model.syncAllDB().then(async() => {
    /**
     * Module dependencies.
     */
    const app = require('./app');
    // const config = require('./common/modules/config');
    // const debug = require('debug')(`ets_${config.exchange}:server`);
    const http = require('http');

    /**
     * Get port from environment and store in Express.
     */
    const port = normalizePort(process.env.PORT || '3000');
    app.set('port', port);

    /**
     * Create HTTP server.
     */
    const server = http.createServer(app);

    /**
     * Listen on provided port, on all network interfaces.
     */
    server.listen(port);
    server.on('error', onError);
    server.on('listening', onListening);

    /**
     * Normalize a port into a number, string, or false.
     */

    function normalizePort(val) {
        const port = parseInt(val, 10);

        if (isNaN(port)) {
            // named pipe
            return val;
        }

        if (port >= 0) {
            // port number
            return port;
        }

        return false;
    }

    /**
     * Event listener for HTTP server "error" event.
     */

    function onError(error) {
        if (error.syscall !== 'listen') {
            throw error;
        }

        const bind = typeof port === 'string'
            ? 'Pipe ' + port
            : 'Port ' + port;

        // handle specific listen errors with friendly messages
        switch (error.code) {
            case 'EACCES':
                console.error(bind + ' requires elevated privileges');
                process.exit(1);
                break;
            case 'EADDRINUSE':
                console.error(bind + ' is already in use');
                process.exit(1);
                break;
            default:
                throw error;
        }
    }

    /**
     * Event listener for HTTP server "listening" event.
     */

    function onListening() {
        const addr = server.address();
        const bind = typeof addr === 'string'
            ? 'pipe ' + addr
            : 'port ' + addr.port;
        // debug('Listening on ' + bind);
    }
});

