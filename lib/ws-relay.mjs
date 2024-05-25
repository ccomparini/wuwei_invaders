
import { default as bodyParser } from 'body-parser'
import { default as cookieParser } from 'cookie-parser'
import { default as express } from 'express'
import { WebSocket, WebSocketServer } from 'ws';

export class WsRelay {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.httpServer = this._expressServer();
        this.httpServer.on('exit', function() {
            console.log(`shutting down websocket relay on ${host}:${port}`);
        })
        this.wsServer = new WebSocketServer({ noServer: true });

        // keys are conversation IDs, values are arrays
        // of sockets:
        this.conversations = { };
    }

    // sends the message to everyone in the given conversation
    broadcast(convId, msg) {
        const conv = this.conversations[convId];
        if(!conv) {
            console.warn(`no such conversation '${convId}'`);
        } else {
            for(const outSock of conv) {
                 try {
                     outSock.send(msg);
                 } catch(error) {
                     // TODO I guess close the connection and delete it?
                     // or, more realistically, fire an event
                     console.warn(
                         `error on socket to ${outSock.ixodata.clientStr}`
                     );
                 }
            }
        }
    }

    _expressServer() {
        const self = this;
        const server = express();

        const router = express.Router()

        server.get('*', function(req, res, next) {
            console.log(`STAR HIT.  STAR ME KITTEN.  URL: ${req.url}`);
            return next();
        });

        server.get('/api/*', function(req, res, next) {
            console.log(`a HIT.  URL: ${req.url}`);
            return next();
        });

        const convRoute = router.route('/connect/:game/:conversationId');

        convRoute.all((req, res, next) => {
console.log(`   SOME KIND OF ALL:\nreq: %o\nres: %o`, req, res);
            if(req.headers.connection === 'upgrade' &&
                  req.headers.upgrade === 'websocket'
            ) {
console.log(`   ALL!@!!!! game: ${req.params.game}`);
console.log(`   ALL!@!!!! conversation: ${req.params.conversationId}`);
                const self = this.wsServer;
                // XXX note fake "head" = [] here;
                // we don't have access to what the head would be, but all
                // it's used for is that if the socket parser read more
                // bytes than necessary, those bytes can be unshifted back
                // unshift the "head" data back to the socket.
                // I propose:  in nodejs proper, change socketOnData in
                // lib/_http_client.js to just unshift the data which would
                // be in bodyHead (head) and then replace bodyHead with
                // and empty TypedArrayPrototypeSlice or similar for back
                // compatibility, and in the long run just remove it.
                self.handleUpgrade(req, req.socket, [], function done(ws) {
// OMG WINNING
console.log(`   I think we can has connection`);
                    self.emit('connection', ws, req);
                    ws.send('can has connection');
                });
            } else {
                // per this:
                //   https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Upgrade
                // if the specific "upgrade" is not supported (in this case,
                // is not to a websocket), just blaze on:
                next();
            }
        });

        // n.b. we use this in order to extract the game and conversation
        // from the path.  it seems that this kind of parameters in route
        // stuff doesn't work for .ws().
        //server.get('/connect/:game/:conversationId/*', function(req, res, next) {
        //router.get('*', function(req, res, next) { // doesn't get parameters.... waat
        //convRoute.all(function(req, res, next) {
        convRoute.get(function(req, res, next) {
            console.log(`WE GOT AN HTTP CONNECT GET on a game conversation`);
            //console.log(`WE got a something on a game conversation`);
            console.log(`   game: ${req.params.game}`);
            console.log(`   conversation: ${req.params.conversationId}`);
            console.log('doing next');
            return next();
        });

        // req here seems to be a node http.IncomingMessage (I guess the
        // one requesting the upgrade).
        // ws is WebSocket:
        //    https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocket
        //server.ws('/connect/:game/:conversationId/*', function(ws, req) { // fails
        //server.ws('*', function(ws, req) { // works but obviously matches everything
        //router.ws('/connect/*', function(ws, req) { // also works!
        //router.ws('/connect/:game/:conversationId/*', function(ws, req) {
/*
        router.ws('*', function(ws, req) {
            console.log('NEW WEBSOCKET CONNECTION');
            // (without the try/catch, any error results in silent failure)
            try {
                console.log(`   ws: ${ws}`);
                console.log(`....... path is ${req.path}`);
                const conversationId = req.params.conversationId;

                console.log(`   ws game: ${req.params.game}`);
                console.log(`   ws conversation: ${req.params.conversationId} or maybe ${conversationId}`);

                // ixodata is arbitrary data attached like a tick onto
                // the websocket.  it's a pun on Ixodida, but really
                // chosen because I think it's unlikely to cause a name
                // collision (and should grep well)
                // ... quite possibly we actually want to wrap or subclass
                // the websocket (do this) TODO
                const addr = req.headers['x-remote-address']
                          || req.socket.remoteAddress;
                const port = req.headers['x-remote-port']
                          || req.socket.remotePort;
                ws.ixodata = {
                    clientAddress: addr,
                    clientPort:    port, 
                    clientStr:     `[${addr}]:${port}`,
                };

                if(!self.conversations[conversationId]) {
                    console.log(`....... new conversation`);
                    self.conversations[conversationId] = [ ];
                }
                self.broadcast(conversationId,
                    `new client: ${ws.ixodata.clientStr}`
                );
                self.conversations[conversationId].push(ws);

                console.log(`${self.conversations[conversationId].length} sockets in conversation ${conversationId}`);

// XXX how do we know when/if the socket dropped?  hmm there is a "close" in _events
// also looks like there are onclose, onerror, onopen and onmessage getters/setters
// remote might be req.headers['x-forwarded-for'] || req.socket.remoteAddress
                ws.on('message', function(msg) {
                    console.log(`GOT A WEBSOCKET MESSAGE on ${req.url}: ${msg}`);
                    //console.log(`ws: %o`, ws);
                    self.broadcast(conversationId,
                        `client ${ws.ixodata.clientAddress}:${ws.ixodata.clientPort} sez ${msg}`
                    );
                });
            } catch (error) {
                console.error("THERE WAS AN ERROR");
                console.error(error);
                const wsStr = ws || '<missing websocket>';
                conversationId ||= '<missing conversation id>';
                console.error(`error on ${wsStr} in ${conversationId}: ${error}`);
                // do we need to close stuff or anything?
            }
        });
 */

        server.use(router);

        server.enable('trust proxy'); // we run the proxy, so trust it
        server.use(cookieParser())
        server.use(bodyParser.json())
        server.use(bodyParser.urlencoded({ extended: true }))
        return server;
    }

    start() {
        this.httpServer.listen(this.port, this.host);
        console.log(`listening on ${this.host}:${this.port}`);
    }
}

