
var wuwei = function() {

    var nextObjId = 1;

    // when using objects as collections, it's awkward
    // to get the size of the collection.  but (and after
    // a long and great annoyance with Map) using objects
    // for everything makes it easier to have a consistent
    // and simple implementation for having html elements
    // access info about the state of the game.
    // So anyway, counterer is a hokey way to make it easy
    // to get a count of items in a collection-like object:
    var counterer = {
        count: {
            get: function() { return Object.keys(this).length; },
        },
    };

    var game = {
        objects: Object.create(null, counterer),
        liveInvaders: Object.create(null, counterer),
        players:  Object.create(null, counterer),
        livePlayers:  Object.create(null, counterer),
        invadersWon: false,

        level: 0, // increments each time a minions spawns

        //var field; // set by play();  is the html canvas on which we play
        settings: {
            missileSpeed: 0.2,
            playerSpeed:  0.2,
        },

        over: function() {
            fetch(`https://fbmstudios.net/wuwei/game_over`)
            for(const [key, player] of Object.entries(this.players)) {
                fetch(`https://fbmstudios.net/wuwei/scores?name=${encodeURIComponent(player.name)}&score=${encodeURIComponent(player.stats.score)}`);
            }
        },
    };

    const fontSize = "16px"; // 'cuz this looks good to me
    const fieldWidthChars  = 40;
    const fieldHeightChars = 24;

    // theoretically, updateInterval is integer ms, but
    // it seems that if I give it a float it dtrt and
    // actually updates more smoothly (on chrome, anyway).
    // this might be because I chose 60/sec.  go figure/revisit?
    const updateInterval = 60/1000;

    function initField(field) {
        field.style.cursor = "none";
        field.style.width  = fieldWidthChars + 'em';
        field.style.height = fieldHeightChars + 'em';

        // ... this sets the widths to pixel units which
        // we use for rendering things the right size:
        field.width  = field.offsetWidth;
        field.height = field.offsetHeight;

        // ... and, doing this here because if I do 8% in the css
        // it makes the width/height radii different....
        field.style['border-radius'] = `${0.08 * field.width}px`;

        return field;
    }

    function cleanCtx() { // cache this?  can we?
        var ctx = field.getContext('2d');
        ctx.textAlign = "center";
        // the default fill style will be the css foreground color,
        // so that various things can use it for their draw color:
        ctx.fillStyle = window.getComputedStyle(field).getPropertyValue("color");
        // use the default font but set the size:
        ctx.font = ctx.font.replace(/^\d+px/, fontSize);

        let fill = ctx.createLinearGradient(
            field.width*.2, 0, field.width, field.height*2
        );
        fill.addColorStop(0, "rgb(23, 23, 23)");
        fill.addColorStop(1, "rgb(4, 4, 4)");
        ctx.backgroundFill = fill;

        return ctx;
    }

    function clearScreen(ctx) {
        var oldFill = ctx.fillStyle;

        ctx.fillStyle = ctx.backgroundFill;
        ctx.fillRect(0, 0, field.width, field.height);
        ctx.fillStyle = oldFill;
    }

    class GameObjStats {
        constructor() {
            this.score  = 0;
            this.misses = 0;

            // kills keys are obj "appearance", values are counts:
            this.kills  = { }; 
        }
    }

    class GameObj {
        constructor(ch, x, y) {
            this.id = nextObjId++;

            this.name = new.target.name + " " + this.id;
            this.stats = new GameObjStats();

            this.pointValue = 0;

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
            // abs() here because apparently chrome and safari consider
            // "box left" to be the (positive) distance to go to the left
            // to find the edge, which firefox (imo, more logically)
            // considers it the left coordinate, and thus firefox uses
            // a negative number for it where the others use a positive
            // one.  So (hopefully) this makes it work for both.
            this.minX = -Math.abs(measurements.actualBoundingBoxLeft);
            this.maxX =  measurements.actualBoundingBoxRight;
            this.minY = -measurements.actualBoundingBoxAscent;
            this.maxY =  measurements.actualBoundingBoxDescent;

            game.objects[this.id] = this;
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

        credit(numPoints) {
            this.stats.score += Math.round(numPoints);
            if(this.master) {
                // master of this object gets credit, too
                this.master.credit(numPoints);
            }
        }

        creditKill(victim) {
            this.stats.score += victim.pointValue;
            if(!this.stats.kills[victim.appearance]) {
                this.stats.kills[victim.appearance] = 1;
            } else {
                this.stats.kills[victim.appearance]++;
            }

            // if this object has a master, the master gets credit too
            if(this.master) {
                this.master.creditKill(victim);
            }
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
            // base objects don't collide, for now, let's say.
            // (actually, better would be to implement precise
            // collisions here, and let callers/subclasses
            // decide if they even need to call this based on
            // other culling techniques)
            return null;
        }

        destroy() {
            delete game.objects[this.id];
        }

    }

    class Missile extends GameObj {
        constructor(x, y, dx, dy, vsGroup, master) {
            if(dy > 0)
                super("↓", x, y);
            else
                super("↑", x, y);

            this.dx = dx;
            this.dy = dy;
            this.vsGroup = vsGroup;
            this.master = master;
        }

        behave(dt, frameNum) {
            super.behave(dt, frameNum);

            for(let target of Object.values(this.vsGroup)) {
                if(this.collidesWith(target, dt)) {
                    target.destroy();
                    this.creditKill(target);
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
            // vs the missile x.  i.e. cheating to make it easier)
            var hit = null;
            if(otherObj.x + otherObj.minX <= this.x) {
                if(otherObj.x + otherObj.maxX >= this.x) {
                    // we're within the left/right boundaries.
                    // actually just checking x,y appears to be sufficient,
                    // at least if you have a good framerate!  cheating.
                    if(otherObj.y + otherObj.maxY >= this.y) {
                        if(otherObj.y + otherObj.minY <= this.y) {
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
            // hitting the sky loses points.  This effectively means
            // the player loses points for missing.
            this.credit(-3);

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
            this.acknowledgedOrders = 0;
            this.minInvaderX = Infinity;
            this.maxInvaderX = 0;
            this.lastReportedFrame = -1;
            this.changeXThus = invaderXStep;
            this.changeYThus = 0;
            this.pointValue = Infinity;
            //this.name = "Hive Mind 0";

            // size of range of possible refire delays
            // for the minions.  smaller = more shooting.
            // gets smaller as the game goes on.
            this.reloadRangeMs = 50000;
            this.name = "侵略者";

            this.spawnMinions();
        }

        commandMinions(dt, frameNum) {

            // change direction and move down if an invader has/will
            // hit a side of the field, or if there are no players left
            // to thwart the invaders:
            let changeDirection = 
                (game.livePlayers.count == 0) ||
                (this.changeXThus + this.maxInvaderX > field.width - invaderXMargin) ||
                (this.changeXThus + this.minInvaderX < invaderXMargin);

            if(changeDirection) {
                this.changeXThus = -this.changeXThus;
                this.changeYThus = invaderYStep;
            } else {
                this.changeYThus = 0;
            }

            if(game.liveInvaders.count === 0) {
                // all minions destroyed!  make a new set
                // with a lower average reload time (to make it harder)
                this.reloadRangeMs *= 0.75;
                this.spawnMinions();

                // all surviving players get points:
                for(player of game.livePlayers) {
                    player.credit(2500  * game.level);
                }
            }

            if(!this.nextRegroupCount)
                this.nextRegroupCount = game.liveInvaders.count * .5;

            if(game.liveInvaders.count < this.nextRegroupCount) {
                // we've taken losses!  troops need discipline.
                // resetting the shot timers will get them more
                // in sync.
                this.nextRegroupCount = this.nextRegroupCount * .5;
                for (let inv of Object.values(game.liveInvaders)) {
                    inv.nextShotMs = inv.reloadMs();
                }
            }
        }

        behave(dt, frameNum) {
            if(game.invadersWon) {
                // invaders stand and gloat:
                this.changeXThus = 0;
                this.changeYThus = 0;

                // hive mind teleports in, to gloat:
                this.x = field.clientWidth  / 2;
                this.y = field.clientHeight / 2;

            } else if(this.acknowledgedOrders >= game.liveInvaders.count) {
                this.commandMinions(dt, frameNum);
                this.acknowledgedOrders = 0;
            }
        }

        spawnMinions(rows) {
            if(!rows) rows = 4;

            // spawn minions. 
            var charWidth  = field.clientWidth  / fieldWidthChars;
            var charHeight = field.clientHeight / fieldHeightChars;
            for(let iy = 1; iy < rows + 1; iy++) {
                // each row basically fills the field with minions,
                // spaced out one "char width", with a little space
                // on the left and slightly more on the right so they
                // can move
                for(let ix = 1; ix < fieldWidthChars - 2; ix += 2) {
                    new Invader(ix * charWidth, iy * charHeight, this);
                }
            }
            // ..and reset their orders:
            this.changeXThus = invaderXStep;
            this.changeYThus = 0;

            game.level++;
        }

        learnAboutMinion(minion, frameNum) {
            if(frameNum > this.lastReportedFrame) {
                this.maxInvaderX = 0;
                this.minInvaderX = Infinity;
                this.lastReportedFrame = frameNum;
            }

            if(minion.x > this.maxInvaderX)
                this.maxInvaderX = minion.x;

            if(minion.x < this.minInvaderX)
                this.minInvaderX = minion.x;

            this.acknowledgedOrders++;
        }
    }

    class Invader extends GameObj {
        constructor(x, y, master) {
            super("無", x, y);
            this.master = master;
            this.nextMoveMs = 0;
            this.minReloadMs   = 1000;
            this.reloadRangeMs = master.reloadRangeMs;
            //this.reloadRangeMs = 25000;
            this.nextShotMs    = this.reloadMs();
            this.pointValue    = 100;
            game.liveInvaders[this.id] = this;
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

                    // if we advanced, we get points according to
                    // how close we are to the bottom.
                    if(this.master.changeYThus) {
                        this.credit(4 * this.y/invaderYStep);
                    }
                }

                this.nextMoveMs = 500;
            }

            super.behave(dt, frameNum); // mostly politeness

            this.nextShotMs -= dt;
            if(this.nextShotMs <= 0) {
                if(!game.invadersWon && game.livePlayers.count) {
                    this.nextShotMs = this.reloadMs();
                    // Also some rand to the speed could be amusing
                    new Missile(
                        this.x, this.y,
                        0, game.settings.missileSpeed,
                        game.livePlayers, this
                    );
                }
            }
        }

        destroy() {
            super.destroy();
            delete game.liveInvaders[this.id];
        }

        hitGround() {
            if(!game.invadersWon) {
                game.over();

                game.invadersWon = true;
            }
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
        constructor(controller, x, y) {
            super("🙏", x, y);
            game.players[this.id] = this;
            game.livePlayers[this.id] = this;

            this.fireButton = controller.fireButton;
            this.joystick   = controller.joystick;
            this.name = "Player " + game.players.count;
            this.pointValue = 5000;
        }

        draw(ctx) {
            if(!this.destroyed)
                super.draw(ctx);
        }

        behave(dt, frameNum) {
            if(this.destroyed)
                return;

            if(this.joystick) {
                this.dx = this.joystick.axes[0] * game.settings.playerSpeed;
            }

            if(this.fireButton.transitionedDown) {
                this.isShooting = true;
            }

            if(this.isShooting) {
                new Missile(
                    this.x, this.y, 0,
                    -game.settings.missileSpeed,
                    game.liveInvaders, this
                );
                this.isShooting = false;
            }

            super.behave(dt, frameNum);
        }

        destroy() {
            //fetch(`https://fbmstudios.net/wuwei/dead?name=${encodeURIComponent(player.name)}`);
            super.destroy();
            delete game.livePlayers[this.id];
        }

        hitSide(dt) {
            this.dx = 0;
            if(this.x > field.clientWidth / 2) {
                this.x  = field.clientWidth - this.maxX - 1;
            } else {
                this.x  = -this.minX + 1;
            }
        }
    }

    var showers = [ ];

    // expands elements with "data-expand", creating one copy of the
    // element for each item in the group specified, and with data-scope
    // set to the corresponding item in the group.
    function expandElements(protoElement, scope) {
        if(!protoElement) return;

        let dataset = protoElement.dataset || { };
        let expand = dataset.expand;

        scope = rescope(protoElement, scope);

        if(expand) {
            // We've got a "data-expand=x", which means we want to
            // make a new element for each thing in collection x
            let parsedFrom = parseDisplayDef(protoElement, expand, scope);

            // at this point, we are going to expand this thing, and we
            // don't want its clones inheriting "expand" (which could
            // lead to infinite expansion), so kill the data-expand:
            delete protoElement.dataset.expand;

            // for each thing in the containingObject[variable],
            // we need to make a copy of the prototype html element
            // to represent that thing.  (let's say containing objects
            // have to be maps because js isn't consistent about
            // collections :P)
            let objs = parsedFrom.containingObject[parsedFrom.variable];
            for (const key in objs) {
                
                let newElem = protoElement.cloneNode(true);

                // change the id of the clone, or else it inherits
                // the id and we get duplicate ids:
                newElem.id = newElem.id + "-" + key;

                // tell the new element what scope it's in:
                newElem.dataset.scope = expand + "." + key;

                protoElement.parentElement.insertBefore(newElem, protoElement);
            }

            // finally, hide the element which we expanded (since it's
            // the prototype and doesn't make sense to keep showing)
            protoElement.style.display = 'none';
        }

        let kids = protoElement.children;
        if(!kids) return;
        for (let kid = kids[0]; !!kid ; kid = kid.nextSibling) {
            expandElements(kid, scope);
        }
    }

    // Note:  elem is basically jammed back into the result
    // (and not really used here) because doing so is convenient
    // for callers.
    function parseDisplayDef(elem, variable, scope) {
        variable.replace(/[^A-Za-z_.]/g, "");
        let parts = variable.split(".");

        let obj = scope;

        for(let pi = 0; pi < parts.length - 1; pi++) {
            if(!obj) {
                console.log("no such variable '" + parts[pi] + "' in '" + variable + "'");
                break;
            }
            obj = obj[parts[pi]];
        }

        if(!obj) {
            obj = new Map;
            console.log("could not parse display def for " + variable);
        }

        return {
            element: elem,
            containingObject: obj,
            variable: parts[parts.length - 1],
        };
    }

    function rescope(elem, existingScope) {
        if(elem.dataset && elem.dataset.scope) {
            let ns = parseDisplayDef(elem, elem.dataset.scope, existingScope);
            return ns.containingObject[ns.variable];
        } else {
            return existingScope;
        }
    }

    function bindDisplay(display, scope) {
        if(!display) return;
        if(!display.dataset) return;

        scope = rescope(display, scope);
 
        // ok let's say display elements have:
        //  - (optionally) the element which sets the thing
        //    in which case, in here, we set onChange or whatever
        //    so like <blah data-controls="debug">. if set, this
        //    would normally also be what it shows.
        //  - (optionally) the element on which to display the thing
        //    so like <blah data-shows="player.score">
        let shows = display.dataset.shows || display.dataset.controls;
        let ctrl  = display.dataset.controls;
        if(shows) {
            showers.push(parseDisplayDef(display, shows, scope));
            delete display.dataset.shows; // so we don't bind it again
        }

        if(ctrl) {
            let def = parseDisplayDef(display, ctrl, scope);
            showers.push(def);
            let el = def.element;
            el.contenteditable = true; // doesn't seem to work; have to set in html?
            el.addEventListener('change', function(ev) { updateControl(def) });
            el.addEventListener('input',  function(ev) { updateControl(def) });
            delete display.dataset.controls;
        }

        // controllers can be compound. i.e. we may
        // pass in an outer element with inner elements
        // displaying various things.  So recurse sub
        // elements.
        let kids = display.children;
        for (let ci = 0; ci < kids.length; ci++) {
            bindDisplay(kids[ci], scope);
        }
    }

    function updateControl(def) {
        let el = def.element;
        if(el.innerText === undefined) {
            def.containingObject[def.variable] = el.value;
        } else {
            def.containingObject[def.variable] = el.innerText;
        }
    }

    function updateDisplays() {
        for (let di = showers.length - 1; di >= 0; di--) {
            let shower = showers[di];
            let val = shower.containingObject[shower.variable];
            if (typeof val === "function") {
                val = val();
            }
            if(document.activeElement !== shower.element) {
                shower.element.textContent = val;
                shower.element.value = val; // for inputs
                if(val !== undefined) {
                    shower.element.style.width = val.length + "ch";
                }
            }
        }
    }

    function serverSocket() {
        const url = 'ws://' + location.hostname + ':29234/';
        //const url = 'ws://' + location.hostname + ':80';
	// 'wuwei' sub protocol fails on chrome (Sec-WebSocket-Protocol)
        //const socket = new WebSocket(url, 'wuwei');
        const socket = new WebSocket(url);

//socket.send("greetings, earthling");

        socket.onerror = function (ev) {
            console.error('Error on socket to ' + url + ': ' + ev);
        };

        socket.onmessage = function (ev) {
            console.log('Message from ' + url + ': ' + ev.data);
        };

        socket.onclose = function(ev) {
            console.log('closed ' + url + ': ' + ev);
        };

        socket.onopen = function (ev) {
            socket.send('Hello Server!');
        };

        return socket;
    }

    return {

        'play': function(setup) {
            //const server = serverSocket();

            fetch('https://fbmstudios.net/wuwei/state/play');

            field = initField(setup.playfield);

            // hiveMind creates and commands the invaders.
            // it stays off screen on planet x until the
            // invaders win.
            // the strange part is that planet x has an x
            // coordinate of 0 (but a large negative y coordinate).
            // ironic, isn't it.
            game.hiveMind = new HiveMind(0, -10000); 

            // we need at least one player:
            const playerYPos = field.clientHeight * .9;
            const p1 = new Player(
                setup.controllers[0], field.clientWidth/3, playerYPos
                //field.clientWidth/3, playerYPos
            );


            window.addEventListener("beforeunload", () => {
                fetch('https://fbmstudios.net/wuwei/state/done');
            });

            // See also:
            //    https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements
            //
            setup.displays.forEach(function(el) { expandElements(el, game); });
            setup.displays.forEach(function(el) { bindDisplay(el, game); });
            let lastUpdate = Date.now();
            let frameNum = 0;
            var ctx = cleanCtx();
            window.setInterval(function() {
                updateDisplays();

                var now = Date.now();
                var deltaT = now - lastUpdate;
                for (let obj of Object.values(game.objects)) {
                    obj.behave(deltaT, frameNum);
                }

                // draw the game elements.  looks like we don't
                // have to bother double buffering.  runs good
                // on my machine, anyway!
                clearScreen(ctx);
                for (let obj of Object.values(game.objects)) {
                    obj.draw(ctx);
                }

                lastUpdate = now;
                frameNum++;
            }, updateInterval);
        }
    };
}();


