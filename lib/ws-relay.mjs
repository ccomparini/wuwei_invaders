
import { default as bodyParser } from 'body-parser'
import { default as cookieParser } from 'cookie-parser'
import { default as express } from 'express'
import expressWs from 'express-ws'

export class WsRelay {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.httpServer = this._expressServer();
        this.httpServer.on('exit', function() {
            console.log(`shutting down websocket relay on ${host}:${port}`);
        })
        // keys are conversation IDs, values are arrays
        // of sockets:
        this.conversations = { };
    }

    _expressServer() {
        const self = this;
        const server = express();
        expressWs(server)

        server.get('/*', function(req, res, next){
            console.log(`WE GOT AN HTTP GET:\n%o`, req.body);
            //res.end();
            return next();
        });

        // sends the message to everyone in the given conversation
        function broadcast(convId, msg) {
            const conv = self.conversations[convId];
            if(!conv) {
                console.warn(`no such conversation '${convId}'`);
            } else {
                for(const outSock of conv) {
                     try {
                         outSock.send(msg);
                     } catch(error) {
                         // TODO I guess close the connection and delete it?
                         // or, more realistically, send an event
                         console.warn(
                             `error on socket to ${outSock.ixodata.clientStr}`
                         );
                     }
                }
            }
        }

        // req here seems to be a node http.IncomingMessage (I guess the
        // one requesting the upgrade).
        // ws is WebSocket
        server.ws('*', function(ws, req) {
            console.log(`NEW WEBSOCKET CONNECTION, I think: ${ws}`);
            console.log(`....... and stuff?`);
            console.log(`....... path is ${req.path}`);
// XXX use ':' in the path and get it with req.params instead of crudely splitting:
// https://expressjs.com/en/guide/routing.html#route-parameters
            const pathSteps = req.path.split('/');
            console.log(".......split path");
            const conversationId = pathSteps[pathSteps.length - 1];
            console.log(`.......ID is ${conversationId}`);
// end use path

            // (without the try/catch, any error results in silent failure)
            try {
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
                broadcast(conversationId,
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
                    broadcast(conversationId,
                        `client ${ws.ixodata.clientAddress}:${ws.ixodata.clientPort} sez ${msg}`
                    );
                });
            } catch (error) {
                console.error(`error on ${ws} in ${conversationId}: ${error}`);
                // do we need to close stuff or anything?
            }
        });

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

