
var wuwei = function() {
    var nextObjId = 1;
    var gameObjects = new Map;
    var liveInvaders = new Map;
    var players  = new Map;
    var invadersWon = false;
    var field; // set by play();  is the html canvas on which we play

    var settings = {
    };

    const fontSize = "16px"; // 'cuz this looks good to me
    const fieldWidthChars  = 40;
    const fieldHeightChars = 24;

    // theoretically, updateInterval is integer ms, but
    // it seems that if I give it a float it dtrt and
    // actually updates more smoothly (on chrome, anyway).
    // this might be because I chose 60/sec.  go figure/revisit?
    const updateInterval = 60/1000;

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
        ctx.font = ctx.font.replace(/^\d+px/, fontSize);
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
                if(!invadersWon && players.size) {  // XXX re-add
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
            this.score = 0;
            players.set(this.id, this);

            this.name = "Player " + players.size;
        }

        draw(ctx) {
            if(!this.destroyed)
                super.draw(ctx);
        }

        behave(dt, frameNum) {
            if(this.destroyed)
                return;

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

    var showers = [ ];
    var setters = [ ];

    // syntax is data-expand="x:y" for expand x into y.
    function expandElements(protoElement) {

        // we're modifying the tree we're traversing (that's the whole
        // goal here).  going depth first makes that less painful, so:
        let kids = protoElement.children;
        if(!kids) return;
        for (let kid = kids[0]; !!kid ; kid = kid.nextSibling) {
            expandElements(kid);
        }
            
        let expand = protoElement.dataset.expand;
        if(expand) {
            // We've got a "data-expand=x", which means we want
            // to make a new element for each thing in the collection
            // specified in x

            let [ from, into ] = expand.split(":", 2);
            let parsedFrom = parseDisplayDef(protoElement, from);

            // for each thing in the containingObject[variable],
            // we need to make an html element to represent that
            // thing.  (let's say containing objects have to be
            // maps because js isn't consistent about collections :P)
            let objs = parsedFrom.containingObject;
            for (let [key, obj] of objs) {
                let newElem = protoElement.cloneNode(true);
                // need to change the id of the clone, or else it
                // inherits the id and we get duplicate ids
                newElem.id = newElem.id + "-" + key;

                // also don't expand the new element:
                delete newElem.dataset.expand;

// XXX this means you can only bind a display within an expand, which is weak/problematic.  Maybe just translate the names here and then bindDisplay in another pass as it was before.
// XXX rename to from/to I think in bindDisplay
                bindDisplay(newElem, { name: into, to: obj });

                protoElement.parentElement.insertBefore(newElem, protoElement);
                expanded = true;
            }

            // finally, hide the element which we expanded (since it's
            // the prototype and doesn't make sense to keep around,
            // unless expansion didn't work (expanded === false),
            // in which case I think it's better to see it so you can
            // notice/try to see what went wrong:
            protoElement.style.display = 'none';
        }
    }

    // Note:  elem is basically jammed back into the result,
    // and not really used, because doing so is convenient
    // for callers.
    function parseDisplayDef(elem, variable, subst) {
        variable.replace(/[^A-Za-z_.]/g, "");
        let parts = variable.split(".");

        // XXX check:
        //   parts needs to be at least 2 elements
        //   parts needs to refer to something sensible
        // XXX oh duh just eval everything up to the last variable
        // (though maybe that won't show which part of the variable
        // is unavailable)
        // XXX actually, do this without evals.  Make it so that
        // html can only access things within a "game" structure.
        // XXX kill subst
        let obj; // = eval(parts[0]);
        if(subst && subst.name === parts[0]) {
            obj = subst.to;
        } else {
            try {
                obj = eval(parts[0]);
            }
            catch(error) {
                console.log("eval of '" + parts[0] + "' failed: " + error);
            }
        }

        for(let pi = 1; pi < parts.length - 1; pi++) {
            if(!obj) {
                console.log("no such variable '" + parts[pi] + "' in '" + variable + "'");
                break;
            }
            obj = obj[parts[pi]];
        }

        if(!obj) {
            obj = { };
            console.log("could not parse display def for " + variable);
        }

        return {
            element: elem,
            // XXX rename containingObject
            containingObject: obj,
            variable: parts[parts.length - 1],
        };
    }

    function bindDisplay(display, subst) {
        // ok let's say display elements have:
        //  - (optionally) the element which sets the thing
        //    in which case, in here, we set onChange or whatever
        //    so like <blah data-controls="debug"> hmmm
        //  - (optionally) the element on which to display the thing
        //    so like <blah data-shows="player.score">
        let shows = display.dataset.shows;
        if(shows)
            showers.push(parseDisplayDef(display, shows, subst));

        let ctrl = display.dataset.controls;
        if(ctrl) {
            showers.push(parseDisplayDef(display, ctrl, subst));
            setters.push(parseDisplayDef(display, ctrl, subst));
        }

        // controllers can be compound. i.e. we may
        // pass in an outer element with inner elements
        // displaying various things.  So recurse sub
        // elements.
        let kids = display.children;
        for (let ci = 0; ci < kids.length; ci++) {
            bindDisplay(kids[ci], subst);
        }
    }

    function updateDisplays() {
        for (let di = showers.length - 1; di >= 0; di--) {
            let shower = showers[di];
            // XXX formatting/efficiency
            //   - rename containingObject; variable -> var or member
            shower.element.textContent = shower.containingObject[shower.variable];
        }
    }

    return {

        'play': function(setup) {
            field = createField(setup.playfield);

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

            // ok so controls:
            //  - need a way to show the user the key
            //  - obvi bind them;  bindings should be exclusive though.
            // more general case of settings:  let's say we make a set
            // of settings available to the html layer and they can bind
            // them to controls via .. some call.  maybe it can be in one
            // bangarino, like they call one method with a big
            // control -> setting list or something?  could be passed in
            // here, actually.  Let's do that.  in settings.
            //  what kind of controls do we need?
            //  in order of importance, descending:
            //  - scores... hmm is this a control?  I guess the way to
            //    do this is have ... I guess it could just set the content.
            //    actually, it might have to set the content.  think of it.
            //    you might add a player.  ok so how about it duplicates
            //    a score display.  ok you know, yes let's do that.
            //  - debug checkbox - this is input
            //  - difficulty
            //
            // See also:
            //    https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements
            //
            setup.displays.forEach(expandElements);
            setup.displays.forEach(bindDisplay);
            let lastUpdate = Date.now();
            let frameNum = 0;
            window.setInterval(function() {
                updateDisplays();

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


