
var wuwei = function() {
    var nextObjId = 1;
    var gameObjects = new Map;
    var liveInvaders = new Map;
    var players  = [];

    class GameObj {
        constructor(ch, x, y) {
            this.id = nextObjId++;

            this.isDead = false;

            this.appearance = ch;
            this.x  = x;
            this.y  = y;
            this.dx = 0;
            this.dy = 0;

            gameObjects.set(this.id, this);
        }

        behave() {
            this.x += this.dx;
            this.y += this.dy;

            //console.log(this.appearance + " is at " + this.x + "," + this.y);

            // something has to check boundaries; add to collisions?
        }

    }

    class Missile extends GameObj {
        constructor(x, y, dx, dy) {
            super("|", x, y);
            this.dx = dx;
            this.dy = dy;
            console.log("POW");
        }
    }

    class Invader extends GameObj {
        constructor(x, y) {
            super("無", x, y);
            liveInvaders.set(this.id, this);
        }

        behave() {
            super.behave();
            if(this.ch === "無") {
                this.ch = "爲";
            } else {
                this.ch = "無";
            }
        }
    }

    class Player extends GameObj {
        constructor(x, y) {
            super("🙏", x, y);
            players.push(this);
        }

        behave() {
            if(this.isMoveRight && this.isMoveLeft) { // wtb xor
                this.dx = 0;
            } else if(this.isMoveRight) {
                this.dx = -1;
            } else if(this.isMoveLeft) {
                this.dx = 1;
            } else {
                this.dx = 0;
            }

            super.behave();

            if(this.isShooting) {
                new Missile(this.x, this.y, 0, 1);
                this.isShooting = false;
            }
        }

        // controls:
        moveLeft(start) {
            this.isMoveLeft = start;
            if(this.isMoveLeft) {
                console.log("goin left now");
            } else {
                console.log("aint goin left now");
            }
        }

        moveRight(start) {
            this.isMoveRight = start;
            if(this.isMoveRight) {
                console.log("goin right now");
            } else {
                console.log("aint goin right now");
            }
        }

        shoot(start) {
            this.isShooting = start;
        }
    }

    var controls = { };

    function dispatchKeyEvent(ev) {
        console.log("key event " + ev.type + " " + ev.keyCode);

        
        var func = controls[ev.keyCode];
        if(func) {
            func(ev.type === "keydown");
        }
    }

    return {
        fieldWidth  : 40, // chars... hmm
        fieldHeight : 40,

        updateInterval : 60/1000, // 60 frames a second, man

        'play': function(element) {
            var objElems = new Map;

            element.style.position = "relative";
            element.style.width  = this.fieldWidth + 'em';
            element.style.height = this.fieldHeight + 'em';
            element.style.backgroundColor = '#eeeeee';
var inv1 = new Invader(element.clientWidth/2, element.clientHeight * .9);

            // we need at least one player;  better though if this is on
            // some event.. hmm XXX  also this shuld not be tied to the
            // element, per se... like if there's more than one element
            var p1 = new Player(element.clientWidth/2, element.clientHeight * .1);
            controls[65] = p1.moveLeft.bind(p1);  // 65 = 'a'
            controls[68] = p1.moveRight.bind(p1); // 68 = 'd'
            controls[87] = p1.shoot.bind(p1);     // 87 = 'w'

            window.addEventListener('keyup',   dispatchKeyEvent, false);
            window.addEventListener('keydown', dispatchKeyEvent, false);

            window.setInterval(function() {
                for (let obj of gameObjects.values()) {
                    obj.behave();
                }

                // draw stuffs....  this might be over elaborate
                for (let obj of gameObjects.values()) {
                    let oel = objElems.get(obj.id);
                    if(!oel) {
                        oel = document.createElement("span");
                        oel.style.position = "absolute";

                        // XXX will need to remove excess elements
                        // when the objects die or whatever.  Or keep
                        // a pool?  might be easier to punt and have
                        // element be an attribute of the object but
                        // then we can only have one representation of
                        // the game state...
                        element.appendChild(oel);
                        objElems.set(obj.id, oel);
                    }
                    oel.style.right  = obj.x;
                    oel.style.bottom = obj.y;
                    oel.innerText = obj.appearance;
                }
            }, this.updateInterval);
        }
    };
}();


