
import { default as bodyParser } from 'body-parser'
import { default as cookieParser } from 'cookie-parser'
import { default as express } from 'express'
import { WebSocket, WebSocketServer } from 'ws';

// represents someone/something in a conversation
class RelayClient {
    constructor(ws, req) {
        this.addr = req.headers['x-remote-address']
                 || req.socket.remoteAddress;
        this.port = req.headers['x-remote-port']
                 || req.socket.remotePort;
        this.ws = ws;

console.log(`   client for game: ${req.params.game}`);
        this.name = req.params.name || `anonymous-${req.params.game}-player`;
console.log(`OK  THIS N00B is ${this}`);
    }

    toString() {
        return `${this.name}@[${this.addr}]:${this.port}`;
    }

    get clientStr() { 
        return `[${this.addr}]:${this.port}`;
    }

    send(msg) {
        return this.ws.send(msg);
    }
}

class Conversation {
    clients = [ ];

    // keeping a separate WebSocketServer per conversation
    // makes it easier to track/handle which connections
    // matter for a given conversation:
    wsServer = new WebSocketServer({ noServer: true });

    constructor(convId) {
        this.Id = convId;
    }

    toString() {
        return `Conversation-${this.Id}`;
    }

    accept(req, ...otherArgs) {
console.log(`accepting request on ${req.path} to join ${this}`);
console.log(`${otherArgs.length} other args:`);
for (const arg of otherArgs) {
console.log(`    %o`, arg);
}
console.log(`AND THAT'S ALL`);

        const wsServer = this.wsServer;
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
        const self = this;
        const origReq = req;
        wsServer.handleUpgrade(req, req.socket, [], function done(ws) {
            const client = new RelayClient(ws, origReq);
console.log(`    upgrade done on ${req.path}; ${client} will join ${self}`);
            ws.on('error', (error) => {
                console.warn(`Error on ${client}: ${error}`);
            });
            ws.on('message', (msg) => {
console.log(`message from ${client}: ${msg}`);
                self.broadcast(msg);
            });

            self.clients.push(client);
            self.broadcast(`new client: ${client}`);

            wsServer.emit('connection', ws, req);
        });
    }

    broadcast(msg) {
        for(const out of this.clients) {
             try {
                 out.send(msg);
             } catch(error) {
                 // TODO I guess close the connection and delete it?
                 // or, more realistically, fire an event
                 console.warn(
                     `error sending to client ${out}: ${error}`
                 );
             }
        }
    }
}

export class WsRelay {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.httpServer = this._expressServer();
        this.httpServer.on('exit', function() {
            console.log(`shutting down websocket relay on ${host}:${port}`);
        })

        // keys are conversation IDs, values are Conversations:
        this.conversations = { };
    }

    // sends the message to everyone in the given conversation
    broadcast(convId, msg) {
        const conv = this.conversations[convId];
        if(!conv) {
            console.warn(`no such conversation '${convId}'`);
        } else {
            conv.send(msg);
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

        router.route('/connect/:game/:conversationId')
            .all((req, res, next) => {
const addr = req.headers['x-remote-address'] || req.socket.remoteAddress;
//console.log(`   palpable hit from ${addr}:\nreq: %o`, req);
console.log(`   palpable hit from ${addr}`);
console.log(`   game: ${req.params.game}`);
console.log(`   conversation: ${req.params.conversationId}`);
                if(req.headers.connection === 'upgrade' &&
                      req.headers.upgrade === 'websocket'
                ) {
                    // someone wants to join a conversation.
                    // if the conversation doesn't exist, we'll make one
                    // (for now - possibly in future force people to use the
                    // API to set up a conversation)
                    const convId = req.params.conversationId;
                    if(!self.conversations[convId]) {
                        console.log(`....... new conversation ${convId}`);
                        self.conversations[convId] = new Conversation(convId);
                    }
                    self.conversations[convId].accept(req);
                } else {
                    // per this:
                    //   https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Upgrade
                    // if the specific "upgrade" is not supported (in this case,
                    // is not to a websocket), just blaze on:
                    next();
                }
            });
// TODO add put and get handlers

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

