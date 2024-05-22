
import { default as bodyParser } from 'body-parser'
import { default as cookieParser } from 'cookie-parser'
import { default as express } from 'express'
import expressWs from 'express-ws'

console.log("YAY exporting WsRelay");

// XXX though this verrsion works at all, I can't figure out how to
// get it to get initial connections.
// PERHAPS we need this one:
//   https://www.npmjs.com/package/websocket-express
// .. which sounds much saner

export class WsRelay {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.httpServer = this._expressServer();
        this.httpServer.on('exit', function() {
            console.log(`shutting down websocket relay on ${host}:${port}`);
        })
    }

    _expressServer() {
        const server = express();
        expressWs(server)

/*
        const router = express.Router()
        router.ws('/', (ws, req) => {
            ws.on('WEBSOCKET message', msg => {
                console.log(msg)
            })
        })
 */
//server.use(bodyParser.raw()); 
server.get('/*', function(req, res, next){
  //console.log('WE GOT AN HTTP GET: %o %o', req, res);
  //console.log(`WE GOT AN HTTP GET:\n${req.body}`);
  console.log(`WE GOT AN HTTP GET:\n%o`, req.body);
  //res.end();
  return next();
});

        server.ws('*', function(ws, req) {
          ws.on('message', function(msg) {
            console.log(`GOT A WEBSOCKET MESSAGE on ${req.url}: ${msg}`);
            //console.log(`ws: %o`, ws);
            //console.log(`req: %o`, req);
          });
          console.log('web socket thingo wat? ', req.testing); // I don't get this
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

