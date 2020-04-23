
var wuwei = function() {
    var nextObjId = 1;
    var gameObjects = new Map;
    var liveInvaders = new Map;
    var players  = new Map;

    const fontSize = 16; // 'cuz this looks good to me
    const fieldWidthChars  = 40;
    const fieldHeightChars = 24;

    var invadersWon = false;

    // theoretically, updateInterval is integer ms, but
    // it seems that if I give it a float it dtrt and
    // actually updates more smoothly (on chrome, anyway).
    // this might be because I chose 60/sec.  go figure/revisit?
    const updateInterval = 60/1000;

    var field; // set by play();  is the html canvas on which we play

    function createField(container) {
        container.style.position = "relative";
        container.style.width  = fieldWidthChars + 'em';
        container.style.height = fieldHeightChars + 'em';
        container.style.backgroundColor = '#eeeeee';

        field = document.createElement("canvas");
        container.appendChild(field);

        field.style.cursor = "none";
        field.style.width  = "100%";
        field.style.height = "100%";

        // ...then set the internal size to match
        field.width  = field.offsetWidth;
        field.height = field.offsetHeight;

        return field;
    }

    function cleanCtx() { // cache this?  can we?
        var ctx = field.getContext('2d');
        ctx.textAlign = "center";
        // everything in js is a fragile hack:
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
            // check if we went off the top or bottom of the field
            if(this.y + this.minY <= 0) {
                this.hitSky(dt);
            } else if(this.y + this.maxY > field.clientHeight) {
                this.hitGround(dt);
            }

            // sides, too...
            if(this.x + this.minX <= 0) {
                this.hitSide(dt);
            } else if(this.x + this.maxX > field.clientWidth) {
                this.hitSide(dt);
            }

            // _then_ move.  that gives things time to
            // bounce on walls or whatever.
            this.x += this.dx * dt;
            this.y += this.dy * dt;
        }

        hitSky(dt) {
            this.destroy();
        }

        hitGround(dt) {
            this.destroy();
        }

        hitSide(dt) {
            this.destroy();
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

        collidesWith(otherObj, dt) {
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
            if(dy > 0)
                super("↓", x, y);
            else
                super("↑", x, y);

            this.dx = dx;
            this.dy = dy;
            this.vsGroup = vsGroup;
        }

        behave(dt, frameNum) {
            super.behave(dt, frameNum);

            for(let target of this.vsGroup.values()) {
                if(this.collidesWith(target, dt)) {
                    target.destroy();
                    this.destroy();
                }
            }
        }

        draw(ctx) {
            super.draw(ctx);
            if(this.debugBounding) {
                var oldFill = ctx.fillStyle;
                ctx.fillStyle = this.color || "red";
                ctx.fillRect(this.x-2, this.y-2, 5, 5);
                ctx.fillStyle = oldFill;
            }
        }

        collidesWith(otherObj, dt) {
            // (we're defining missiles as thin, so the x checks are just
            // vs the missle x.  i.e. cheating to make it easier)
            var hit = null;
            if(otherObj.x + otherObj.minX <= this.x) {
                if(otherObj.x + otherObj.maxX >= this.x) {
                    // we're within the left/right boundaries.
                    // actualy just checking x,y appears to be sufficient,
                    // at least if you have a good framerate!  cheating.
                    // XXX fix/take into account dt
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
            if(!this.destroyQuietly) new Boom(this.x, this.y);
        }

        hitSky(dt) {
            this.destroyQuietly = true;
            super.hitSide();
        }

        hitSide(dt) {
            this.destroyQuietly = true;
            super.hitSide();
        }
    }

    const invaderXStep   = 10;
    const invaderYStep   = 16;
    const invaderXMargin = 10;
    class HiveMind extends GameObj {
        constructor(x, y) {
            super('先生们，您所有的基地都属于我们', x, y);
            this.minInvaderX = Infinity;
            this.maxInvaderX = 0;
            this.lastReportedFrame = -1;
            this.lastDescentOrderFrame = Infinity;
            this.changeXThus = invaderXStep;
            this.changeYThus = 0;

        }

        behave(dt, frameNum) {

            if(invadersWon) {
                // invaders stand and gloat:
                this.changeXThus = 0;
                this.changeYThus = 0;

                // hive mind teleports in to gloat:
                this.x = field.clientWidth  / 2;
                this.y = field.clientHeight / 2;
                
            } else if(this.changeXThus + this.maxInvaderX > field.width - invaderXMargin) {
                this.changeXThus = -this.changeXThus;
                this.changeYThus = invaderYStep;
            } else if(this.changeXThus + this.minInvaderX < invaderXMargin) {
                this.changeXThus = -this.changeXThus;
                this.changeYThus = invaderYStep;
            }

            if(frameNum > this.lastDescentOrderFrame) {
                this.changeYThus = 0;
                this.lastDescentOrderFrame = Infinity;
            }

            if(liveInvaders.size === 0)
                this.spawnMinions();

            if(!this.nextRegroupCount)
                this.nextRegroupCount = liveInvaders.size * .5;
                //this.nextRegroupCount = liveInvaders.size * .75;

            if(liveInvaders.size < this.nextRegroupCount) {
                // we've taken losses!  troops need discipline.
                // resetting the shot timers will get them more
                // in sync.
                this.nextRegroupCount = this.nextRegroupCount * .5;
                for (let inv of liveInvaders.values()) {
                    inv.nextShotMs = inv.reloadMs();
                }

//this.spawnMinions(1);
            }
        }

        spawnMinions(rows) {
            if(!rows) rows = 4;
            // spawn minions. 
            var charWidth  = field.clientWidth  / fieldWidthChars;
            var charHeight = field.clientHeight / fieldHeightChars;
            for(let iy = 1; iy < rows + 1; iy++) {
                // each row basically fills the field with minions,
                // space out one "char width", with a little space
                // on the left and slightly more on the right so they
                // can move
                for(let ix = 1; ix < fieldWidthChars - 2; ix += 2) {
                    new Invader(ix * charWidth, iy * charHeight, this);
                }
            }
            // ..and reset their orders:
            this.changeXThus = invaderXStep;
            this.changeYThus = 0;
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
            this.minReloadMs   = 1000;
            this.reloadRangeMs = 25000;
            this.nextShotMs    = this.reloadMs();
            liveInvaders.set(this.id, this);
        }

        reloadMs() {
            let rand = Math.random() * Math.random();
            return rand * this.reloadRangeMs + this.minReloadMs;
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

            this.nextShotMs -= dt;
            if(this.nextShotMs <= 0) {
                if(!invadersWon && players.size) {
                    this.nextShotMs = this.reloadMs();
                    // XXX need missile speed constant.  Also some
                    // rand to the speed could be amusing!
                    new Missile(this.x, this.y, 0, 0.2, players);
                }
            }
        }

        destroy() {
            super.destroy();
            liveInvaders.delete(this.id);
        }

        hitGround() {
            invadersWon = true;
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

        hitSide(dt) {
            this.dx = 0;
            if(this.x > field.clientWidth / 2) {
                this.x  = field.clientWidth - this.maxX - 1;
            } else {
                this.x  = -this.minX + 1;
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
        if(func) func(ev.type === "keydown");
    }

    return {

        'play': function(elements) {
            field = createField(elements.playfield);

            // hiveMind creates and commands the invaders.
            // it stays off screen on planet x until the
            // invaders win.
            var hiveMind = new HiveMind(0, -10000); 

            // we need at least one player:
            var p1 = new Player(field.clientWidth/3, field.clientHeight * .9);
            controls[65] = p1.moveLeft.bind(p1);  // 65 = 'a'
            controls[68] = p1.moveRight.bind(p1); // 68 = 'd'
            controls[87] = p1.shoot.bind(p1);     // 87 = 'w'
            controls[37] = p1.moveLeft.bind(p1);  // 37 = left arrow
            controls[39] = p1.moveRight.bind(p1); // 39 = right arrow
            controls[32] = p1.shoot.bind(p1);     // 32 = ' '

/*
            var p2 = new Player(field.clientWidth*2/3, field.clientHeight * .9);
            controls[37] = p2.moveLeft.bind(p2);  // 37 = left arrow
            controls[39] = p2.moveRight.bind(p2); // 39 = right arrow
            //controls[32] = p2.shoot.bind(p2);     // 32 = ' '
            controls[38] = p2.shoot.bind(p2);     // 38 = up arrow
 */

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
                // on my machine, anyway!
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


