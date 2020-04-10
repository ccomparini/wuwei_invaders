
var wuwei = function() {
    var nextObjId = 1;
    var gameObjects = new Map;
    var liveInvaders = new Map;
    var players  = new Map;
    var fontSize = 16;
    var fieldWidth  = 40; // XXX probably convert to pixels
    var fieldHeight = 24;
    // theoretically, updateInterval is integer ms, but
    // it seems that if I give it a float it dtrt and
    // actually updates more smoothly (on chrome, anyway).
    // go figure/revisit:
    var updateInterval = 60/1000;


    var field; // set by play();  is the canvas on which we play
    function cleanCtx() { // cache this?  can we?
        var ctx = field.getContext('2d');
        ctx.textAlign = "center";
        ctx.font = ctx.font.replace(/^\d+px/, fontSize + "px");
        return ctx;
    }

    class GameObj {
        constructor(ch, x, y) {
            this.id = nextObjId++;

            this.isAlive = true;

            this.appearance = ch;
            this.x  = x;
            this.y  = y;
            this.dx = 0;
            this.dy = 0;

            //this.debugBounding = true;

            // we need a render context to get the bounding box:
            // since all the invaders are the same we probably don't
            // have to measure each but whatevs.  Also, invaders have
            // more than one appearance, but whatevs.  maybe move this
            // to a setAppearance method?  whatevs.
            var ctx = cleanCtx();
            var measurements = ctx.measureText(this.appearance);
            this.minX = -measurements.actualBoundingBoxLeft;
            this.maxX =  measurements.actualBoundingBoxRight;
            this.minY = -measurements.actualBoundingBoxAscent;
            this.maxY =  measurements.actualBoundingBoxDescent;

            gameObjects.set(this.id, this);
        }

        behave(dt, frameNum) {
            this.x += this.dx * dt;
            this.y += this.dy * dt;

            // check if we went off the top or bottom of the field
            // XXX
        }

        draw(ctx) {
            ctx.fillText(this.appearance, this.x, this.y);

            if(this.debugBounding) {
                var oldFill = ctx.fillStyle;
                ctx.fillStyle = 'green';
                ctx.strokeRect(
                    this.x + this.minX, this.y + this.minY,
                    this.maxX - this.minX, this.maxY - this.minY
                );
                ctx.fillStyle = oldFill;
            }
        }

        collidesWith(otherObj) { // XXX add dt
            // base objects don't collide, for now, let's say
            // XXX actually better would be to implement precise
            // collisions here, and let callers/subclasses
            // decide if they even need to call this based on
            // other culling techniques
            return null;
        }

        destroy() {
            gameObjects.delete(this.id);
        }

    }

    class Missile extends GameObj {
        constructor(x, y, dx, dy, vsGroup) {
            super("↑", x, y);
            this.dx = dx;
            this.dy = dy;
            this.vsGroup = vsGroup;
        }

        behave(dt, frameNum) {
            super.behave(dt, frameNum);

            for(let target of this.vsGroup.values()) {
                if(this.collidesWith(target)) {
                    target.destroy();
                    this.destroy();
                }
            }
        }

        draw(ctx) {
            super.draw(ctx);

            // drawing the rect here was debug but I kinda like it:
            var oldFill = ctx.fillStyle;
            ctx.fillStyle = this.color || "red";
            //ctx.fillRect(this.x, this.y, 1, 1);
            ctx.fillRect(this.x-2, this.y-2, 5, 5);
            ctx.fillStyle = oldFill;
        }

        collidesWith(otherObj) { // XXX add dt so that we can check
            // (we're defining missiles as thin, so the x checks are just
            // vs the missle x.  i.e. cheating to make it easier)
            var hit = null;
            if(otherObj.x + otherObj.minX <= this.x) {
                if(otherObj.x + otherObj.maxX >= this.x) {
                    // we're within the left/right boundaries.
                    // check y:
                    // XXX take into account the length.  Or, maybe just
                    // the x,y is the pointy part?  anyway:
                    if(otherObj.y + otherObj.maxY >= this.y) {
                        if(otherObj.y + otherObj.minY <= this.y) {
                            console.log("A palpable hit!");
                            hit = otherObj;
                        }
                    }
                }
            }
            return hit;
        }

        destroy() {
            super.destroy();
            new Boom(this.x, this.y);
        }
    }

    class HiveMind extends GameObj {
        constructor(x, y) {
            super('', x, y);
            this.minInvaderX = Infinity;
            this.maxInvaderX = 0;
            this.lastReportedFrame = -1;
            this.lastDescentOrderFrame = Infinity;
            this.changeXThus = 10;
            this.changeYThus = 0;

        }

        behave(dt, frameNum) {
            // FIXME random constants etc
            if(this.changeXThus + this.maxInvaderX > field.width - 10) {
                this.changeXThus = -this.changeXThus;
                this.changeYThus = 16;
            } else if(this.changeXThus + this.minInvaderX < 10) {
                this.changeXThus = -this.changeXThus;
                this.changeYThus = 16;
            }

            if(frameNum > this.lastDescentOrderFrame) {
                this.changeYThus = 0;
                this.lastDescentOrderFrame = Infinity;
            }

            if(liveInvaders.size === 0) {
                // spawn minions.  XXX make this a method or something.
/*
                var charWidth  = field.clientWidth  / this.fieldWidth;
                var charHeight = field.clientHeight / this.fieldHeight;
*/
                var charWidth  = field.clientWidth  / 40; // FIXME
                var charHeight = field.clientHeight / 24; // FIXME
                for(let iy = 1; iy < 5; iy++) {
                    //for(let ix = 1; ix < fieldWidth; ix += 2) {
                    for(let ix = 1; ix < 38; ix += 2) {  // FIXME
                        var inv1 = new Invader(ix * charWidth, iy * charHeight, this);
                    }
                }
            }
        }

        learnAboutMinion(minion, frameNum) {
            if(frameNum > this.lastReportedFrame) {
                this.maxInvaderX = 0;
                this.minInvaderX = Infinity;
                this.lastReportedFrame = frameNum;
            }

            if(this.changeYThus) {
                this.lastDescentOrderFrame = frameNum;
            }

            if(minion.x > this.maxInvaderX)
                this.maxInvaderX = minion.x;

            if(minion.x < this.minInvaderX)
                this.minInvaderX = minion.x;
        }
    }

    class Invader extends GameObj {
        constructor(x, y, master) {
            super("無", x, y);
            this.master = master;
            this.nextMoveMs = 0;
            liveInvaders.set(this.id, this);
        }

        behave(dt, frameNum) {
            this.nextMoveMs -= dt;
            if(this.nextMoveMs <= 0) {
                if(this.appearance === "無") {
                    this.appearance = "爲";
                } else {
                    this.appearance = "無";
                    this.x += this.master.changeXThus;
                    this.y += this.master.changeYThus;
                    this.master.learnAboutMinion(this, frameNum);
                }

                this.nextMoveMs = 500;
            }

            super.behave(dt, frameNum); // mostly politeness

            // XXX more arbitrary constants.  also maybe hive mind
            // should set agressiveness. anywayzzz:
            // XXX also need to scale to time!  oh have a "next shoot"
            // attr.  should be fun.
            if(Math.random() < 0.0003) {
                // XXX need missile speed constant.  Also some
                // rand to the speed could be amusing!
                new Missile(this.x, this.y, 0, 0.2, players);
            }
        }

        destroy() {
            super.destroy();
            liveInvaders.delete(this.id);
        }
    }

    class Boom extends GameObj {
        constructor(x, y) {
            super("⬝", x, y);
            this.nextMoveMs = 0;
        }

        behave(dt, frameNum) {
            this.nextMoveMs -= dt;
            if(this.nextMoveMs <= 0) {
                this.nextMoveMs = 100;
                if(this.appearance === "⬝") {
                    this.appearance = "⭑";
                } else if(this.appearance === "⭑") {
                    this.appearance = "⭓";
                } else if(this.appearance === "⭓") {
                    this.appearance = "⬤";
                } else if(this.appearance === "⬤") {
                    this.appearance = "⤫";
                } else if(this.appearance === "⤫") {
                    this.appearance = "⟳";
                } else if(this.appearance === "⟳") {
                    this.appearance = "⥁";
                } else if(this.appearance === "⥁") {
                    this.appearance = "⍟";
                } else if(this.appearance === "⍟") {
                    this.destroy();
                } else {
                    this.appearance = "⬝";
                }
            }
        }
    }

    class Player extends GameObj {
        constructor(x, y) {
            super("🙏", x, y);
            players.set(this.id, this);
        }

        behave(dt, frameNum) {
            if(this.isMoveRight && this.isMoveLeft) { // wtb xor
                this.dx = 0;
            } else if(this.isMoveRight) {
                this.dx = 0.2;
            } else if(this.isMoveLeft) {
                this.dx = -0.2;
            } else {
                this.dx = 0;
            }

            super.behave(dt, frameNum);

            if(this.isShooting) {
                new Missile(this.x, this.y, 0, -0.2, liveInvaders);
                this.isShooting = false;
            }
        }

        destroy() {
            super.destroy();
            players.delete(this.id);
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
        if(func) func(ev.type === "keydown");
    }

    return {

        'play': function(container) {
            container.style.position = "relative";
            container.style.width  = fieldWidth + 'em';
            container.style.height = fieldHeight + 'em';
            container.style.backgroundColor = '#eeeeee';

// XXX make this a function or something
            field = document.createElement("canvas");
            container.appendChild(field);
            field.style.width ='100%';
            field.style.height='100%';
            // ...then set the internal size to match
            field.width  = field.offsetWidth;
            field.height = field.offsetHeight;
// end XXX make this a function or something

            var hiveMind = new HiveMind(0, -1000); 

            // we need at least one player;  better though if this is on
            // some event..
            var p1 = new Player(field.clientWidth/2, field.clientHeight * .9);
            controls[65] = p1.moveLeft.bind(p1);  // 65 = 'a'
            controls[37] = p1.moveLeft.bind(p1);  // 37 = left arrow
            controls[68] = p1.moveRight.bind(p1); // 68 = 'd'
            controls[39] = p1.moveRight.bind(p1); // 39 = right arrow
            controls[87] = p1.shoot.bind(p1);     // 87 = 'w'
            controls[32] = p1.shoot.bind(p1);     // 32 = ' '

            window.addEventListener('keyup',   dispatchKeyEvent, false);
            window.addEventListener('keydown', dispatchKeyEvent, false);

            let lastUpdate = Date.now();
            let frameNum = 0;
            window.setInterval(function() {
                //var colliders = new Map;

                var now = Date.now();
                var deltaT = now - lastUpdate;
                for (let obj of gameObjects.values()) {
                    obj.behave(deltaT, frameNum);
                }

                // draw the game elements.  looks like we don't
                // have to bother double buffering.  runs good
                // as-is, on my machine, anyway!
                var ctx = cleanCtx();
                ctx.clearRect(0, 0, field.width, field.height);
                for (let obj of gameObjects.values()) {
                    obj.draw(ctx);
                }

                lastUpdate = now;
                frameNum++;
            }, updateInterval);
        }
    };
}();


