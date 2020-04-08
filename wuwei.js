
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

        behave(dt) {
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
            //super("無", x, y);
            super("x", x, y);
            this.nextMoveMs = 0;
            liveInvaders.set(this.id, this);
        }

        behave(dt) {
            super.behave(dt);
            this.nextMoveMs -= dt;
            if(this.nextMoveMs <= 0) {
                if(this.appearance === "無") {
                    this.appearance = "爲";
//this.appearance = "o";
                } else {
                    this.appearance = "無";
//this.appearance = "x";
                }
                this.nextMoveMs = 500;
            }
        }
    }

    class Player extends GameObj {
        constructor(x, y) {
            super("🙏", x, y);
            players.push(this);
        }

        behave(dt) {
            if(this.isMoveRight && this.isMoveLeft) { // wtb xor
                this.dx = 0;
            } else if(this.isMoveRight) {
                this.dx = 1;
            } else if(this.isMoveLeft) {
                this.dx = -1;
            } else {
                this.dx = 0;
            }

            super.behave(dt);

            //console.log(this.x);

            if(this.isShooting) {
                new Missile(this.x, this.y, 0, -1);
                this.isShooting = false;
            }
        }

        // controls:
        moveLeft(start) {
            this.isMoveLeft = start;
        }

        moveRight(start) {
            this.isMoveRight = start;
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
        fieldWidth  : 40, // chars (or ems)... runs good!
        fieldHeight : 24,

        updateInterval : 60/1000, // 60 frames a second, man

        'play': function(container) {
            container.style.position = "relative";
            container.style.width  = this.fieldWidth + 'em';
            container.style.height = this.fieldHeight + 'em';
            container.style.backgroundColor = '#eeeeee';

            var field = document.createElement("canvas");
            container.appendChild(field);
            field.style.width ='100%';
            field.style.height='100%';
            // ...then set the internal size to match
            field.width  = field.offsetWidth;
            field.height = field.offsetHeight;

            var fontSize = parseFloat(window.getComputedStyle(container, null).getPropertyValue('font-size'));

            var charWidth  = container.clientWidth  / this.fieldWidth;
            var charHeight = container.clientHeight / this.fieldHeight;

            for(let iy = 1; iy < 5; iy++) {
                for(let ix = 0; ix < this.fieldWidth; ix += 2) {
                    var inv1 = new Invader(ix * charWidth, iy * charHeight);
                }
            }

            // we need at least one player;  better though if this is on
            // some event.. hmm XXX  also this shuld not be tied to the
            // element, per se... like if there's more than one element
            var p1 = new Player(container.clientWidth/2, container.clientHeight * .9);
            controls[65] = p1.moveLeft.bind(p1);  // 65 = 'a'
            controls[37] = p1.moveLeft.bind(p1);  // 37 = left arrow
            controls[68] = p1.moveRight.bind(p1); // 68 = 'd'
            controls[39] = p1.moveRight.bind(p1); // 39 = right arrow
            controls[87] = p1.shoot.bind(p1);     // 87 = 'w'

            window.addEventListener('keyup',   dispatchKeyEvent, false);
            window.addEventListener('keydown', dispatchKeyEvent, false);

            var lastUpdate = Date.now();
            window.setInterval(function() {
                var now = Date.now();
                var deltaT = now - lastUpdate;
                for (let obj of gameObjects.values()) {
                    obj.behave(deltaT);
                }

                // draw the game elements.  looks like we don't
                // have to bother double buffering.  runs good
                // as-is, on my machine, anyway!
                var ctx = field.getContext('2d');
                ctx.clearRect(0, 0, field.width, field.height);
                ctx.font = ctx.font.replace(/^\d+px/, fontSize + "px");
                for (let obj of gameObjects.values()) {
                    ctx.fillText(obj.appearance, obj.x, obj.y);
                }

                lastUpdate = now;
            }, this.updateInterval);
        }
    };
}();


