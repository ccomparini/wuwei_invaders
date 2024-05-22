import { WsRelay } from './lib/ws-relay.mjs';

const relay = new WsRelay('127.0.0.23', 2323);
relay.start();

// What do we want here?
//
//   - Server should record players/high scores. (authentication?)
//   - Server should be able to run a game (or multiple):
//     - Logic is same as client side
//       - Issue: client side, it uses the size of characters in the
//         font for things like collisions.  This obviously may vary
//         from client to client.  
//     - Clients send controls and receive game state, let's say.
//       I think we can get away with this approach, here in this
//       day and age where you can video chat over websockets in
//       (for all intents and purposes) real time.
//   - Server has some kind of "lobby" API where clients can see
//     active games and high scores and such.  Maybe who's playing...
//
// plan:
//   - Server needs to be able to serve http for the lobby API and
//     whatever else.
//   - Server needs to be able to upgrade to a websocket connection
//     when a player creates or joins a game.
//
// API:
//  GET/PUT http://player      # shows active players or some search... 
//                             # ... OR show all players, including inactive, for high scores etc
//  GET     http://player/[id] # maybe have this, or not?
//  GET/PUT http://game        # shows active games (? for search I guess)
//  GET     http://game.[id]   # info on game, including connect url
//

/*
This is fail, running the game on the server, because it wants a lot
of browser stuff like font sizes etc.  INSTEAD, let's try a websocket relay.
// OK JUST GET SOMETHING GOING! SHIPIT!
const { createCanvas, loadImage } = require('canvas');
const playfield = createCanvas(640, 384);
playfield.style = { };  // or else we get crashage setting this
console.log(`OH HAI playfield is ${playfield}`);
wuwei.play({
    playfield:  playfield,
    displays: [
        //document.getElementById("scoreboard"),
        //document.getElementById("settings"),
    ],
    controllers: [
/*
XXX going to need remote controllers or such....
        {
            joystick: document.getElementById("joystick-p1"),
            fireButton: document.getElementById("fire-p1")
        }
 * /
    ],
});
 */

/*
const express = require('express')
const server = express()
 */

//import("file:///newhome/home/chris/projects/wuwei_invaders/ws-relay.mjs")


