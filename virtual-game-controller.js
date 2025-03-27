/*
    Old fashioned arcade style joystick.

    Usage:
       <head>
         <script src="virtual-joystick.js"></script>
       </head>

     one axis joysticks:
       <virtual-joystick id="joystick-p1"> </virtual-joystick>
       <virtual-joystick id="joystick-p2"> </virtual-joystick>S

     two axis:
       <virtual-joystick id="joystick" data-axis-count=2> </virtual-joystick>

    Note:
       Put the script tag for this in the <head> of your html so it
       runs before you use the tags.

    Styling: XXX fill in

    data-XXX fill in
 */


class VirtualGameController extends HTMLElement {

  #subStyles = [ ];  // shortcut to classes of subelements
  #innerStyle = "";   // <style> element for the shadow DOM

  #keyHandler;        // key event handler, if installed
  #keyControls = { }; // key event.code() -> handler function

  constructor() {
    super();
    this.initFromDataConfig();
  }

  initFromDataConfig() {
  }

  appendCSS(css) {
    this.#innerStyle.textContent += css;
  }

  defaultStyle() {
    return '';
  }

  initGraphics() {
    // this makes it so you don't get a 0px x 0px (and thus
    // invisible) element by default.  it's very confusing
    // when you do.
    this.style.minWidth  = "50px";
    this.style.minHeight = "30px";
    this.style.display   = 'inline-block';

    // custom elements aren't supposed to muck with
    // children, in the normal sense.  but, they -can-
    // attach a "shadow root", which (as I understand
    // it) makes them into a new, contained DOM tree,
    // and add elements to that.  i.e., the added elements
    // are scoped to this shadow DOM, and thus can't
    // cause weirdness outside this element.
    const shadowDOM = this.attachShadow({ mode: "open" });
    this.#innerStyle = document.createElement("style");
    shadowDOM.appendChild(this.#innerStyle);

    this.appendCSS(this.defaultStyle());
    this.applySubStyles();
  }

  createComponentElement(elClass, parentEl) {
    const el = document.createElement("span");
    el.setAttribute("class", elClass);
    el.style.display = "inline-block";
    el.style.position = "relative";

    this.#subStyles.push(elClass);

    if(parentEl) {
      parentEl.appendChild(el);
    } else {
      this.shadowRoot.appendChild(el);
    }

    return el;
  }

  applySubStyles() {
    const existingStyle = window.getComputedStyle(this);

    // https://www.w3.org/TR/CSS2/cascade.html#cascading-order

    // The idea here is style for sub props can be set using
    //  custom properties, like this:
    //  --[sub class]-[real css property] = [real css value]
    // For example, to give the joystick a green ball on a
    // red stick set in a purple and red slot, you could do
    // something like:
    //    #joystick-1 {
    //      --ball: radial-gradient(#000000, #00ff2f); 
    //      --stick: radial-gradient(#ff0000, #440000); 
    //      --slot-back: purple;
    //      --slot-front: red;
    //    }
    // this is terribly brute force, but seems to be the best we can do?
    var subStyle = "\n\n";
    for(let subClass of this.#subStyles) {
      subStyle += `.${subClass} {`;
      // we can't use "of", below - we need all get possible css properties
      for(let realProp in this.style) {
        if(!isNaN(realProp)) {
          // skip numeric ones because they aren't css properties.
          // some of the non-numerics are also -not- css properties,
          // but I'm guessing/hoping that even if something refers to
          // one of them, though it'll go in the stylesheet, 
          continue;
        }

        // convert camelCase to what's presumably the css version
        // of the same thing:
        realProp = realProp.replace(/[A-Z]/, "-$&").toLowerCase();

        let propVal = existingStyle.getPropertyValue(
            `--${subClass}-${realProp}`
        );
        if(propVal) {
          subStyle += `\n    ${realProp}: ${propVal};`;
        }
      }
      // and for the final evil trick, if there's (eg) just "--ball",
      // that's a "background", because that's how we fill these elements:
      let propVal = existingStyle.getPropertyValue(`--${subClass}`);
      if(propVal) {
          subStyle += `\n    background: ${propVal};`;
      }
      subStyle += "\n}\n";
    }
    this.#innerStyle.textContent += subStyle;
  }

  addKeyControl(keyname, func) {
    const self = this;
    this.#keyControls[keyname] = func;
  }

  connectedCallback() {
    // called when added to page
    this.initFromDataConfig();

    this.initGraphics();

    var self = this;
    this.#keyHandler = function(ev) {
        var func = self.#keyControls[ev.code];
        if(func) func(ev.type === "keydown");
    }
    window.addEventListener('keyup',   this.#keyHandler, false);
    window.addEventListener('keydown', this.#keyHandler, false);
  }

  disconnectedCallback() {
    window.removeEventListener('keyup',   this.#keyHandler, false);
    window.removeEventListener('keydown', this.#keyHandler, false);
  }

  adoptedCallback() {
    console.log(`Joystick ${this} moved to new page.  whoa dude.`);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log(`Joystick attribute ${name} has changed from '${oldValue}' to '${newValue}'`);
  }
  // end HTMLElement handlers

}

class VirtualJoystickElement extends VirtualGameController {
  #stick;              // shortcut to "stick" element
  #ball;               // shortcut to "ball" element
  #axes = [ 0 ];
  #maxSwing  = 23.44;  // degrees, +- of center on x axis
  #yRangePct = 100;     // % of container +- start position

  get xPos() {
    return this.#axes[0];
  }

  get yPos() {
    return this.#axes[1];
  }

  setClientPos(clientX, clientY) {
    let bounds = this.getBoundingClientRect();
    if(clientX < bounds.x) clientX = bounds.x;
    if(clientX > bounds.right) clientX = bounds.right;

    if(clientY < bounds.y)      clientY = bounds.y;
    if(clientY > bounds.bottom) clientY = bounds.bottom;

    let relativeX = clientX - (bounds.x + bounds.width/2);
    let relativeY = clientY - (bounds.y + bounds.height/2);

    // 2* because we present range [-1.0 1.0] and not [-0.5 0.5]
    this.setAxis(0, 2 * relativeX/bounds.width);
    this.setAxis(1, 2 * relativeY/bounds.height);
  }

  // This is intended to work the same as Gamepad.axes
  //  https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/axes
  get axes() {
    return this.#axes;
  }

  setAxis(axis, val) {
    if(axis < this.#axes.length) {
      this.#axes[axis] = val;
      switch(axis) {
        case 0:
          this.#stick.style.setProperty('rotate', `${this.#maxSwing * val}deg`);
          break;
        case 1:
          this.#stick.style.setProperty('translateY', `${this.#yRangePct * val}%`);
          this.#stick.style.setProperty('transform', `translateY(${this.#yRangePct * val}%)`);
          break;
      };
    }
  }

  clearAxes() {
    for(let ax = 0; ax < this.axes.length; ax++) {
      this.setAxis(ax, 0.0);
    }
  }

  initAxes(axisCount) {
    if(!axisCount) {
      axisCount = 1;
    } else if(axisCount > 2) {
      console.warn(
        "Currently, VirtualGameController may have no more that 2 axes."
      );
      axisCount = 2;
    } else if(axisCount <= 0) {
      console.warn(
        "Negative axis counts not supported in VirtualGameController."
      );
      axisCount = 1;
    }

    this.#axes = Array(axisCount).fill(0);
  }

  // initialize from html-level data-xxx attributes
  initFromDataConfig() {
    super.initFromDataConfig();

    // configuration:
    //   data-axis-count
    //   data-x-range-deg
    //   data-y-range-pct
    //   data-key-left
    //   data-key-right
    if(typeof this.dataset.axisCount !== 'undefined') {
      this.initAxes(this.dataset.axisCount);
    }
    if(typeof this.dataset.xRangeDeg !== 'undefined') {
      this.#maxSwing = this.dataset.xRangeDeg;
    }
    if(typeof this.dataset.yRangePct !== 'undefined') {
      this.#yRangePct = this.dataset.yRangePct;
    }
    // key controls!  
    if(typeof this.dataset.keyLeft !== 'undefined') {
        this.addAxisKeyControl(this.dataset.keyLeft, 0, -1.0);
    }
    if(typeof this.dataset.keyRight !== 'undefined') {
        this.addAxisKeyControl(this.dataset.keyRight, 0, 1.0);
    }
  }

  defaultStyle() {
    return `
      .ball {
        background: radial-gradient(at 20% 20%, #cc4444, #770000);
        width: 500%;
        aspect-ratio: 1 / 1;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        top: 0;
        left: 50%;
        z-index: 5;
      }
      .stick {
        width: 8%;
        height: 100%;
        background: radial-gradient(#000000, #777777); 
        border-radius: 0 0 80% 80%;
        color: #505050;
        transform-origin: 50% 100%;
        z-index: 3;
      }
      .slot {
        color: black;
        width: 100%;
        height: 20%;
        top: 100%;
      }
      .slot-front {
        background: linear-gradient(#000000, #777777);
        border: #a0a0a0 3px;
        height: 50%;
        bottom: -10%;
        width: 100%;
        z-index: 4;
      }
      .slot-back {
        background: linear-gradient(#777777, #000000);
        border-radius: 50vb 50vb 0 0;
        border: #808080 3px;
        height: 40%;
        top: 0%;
        width: 100%;
        z-index: 2;
      }
    `;
  }

  initGraphics() {
    super.initGraphics();

    const slot       = this.createComponentElement("slot");
    const slot_back  = this.createComponentElement("slot-back", slot);
    const slot_front = this.createComponentElement("slot-front", slot);

    this.#stick = this.createComponentElement("stick");
    this.#ball  = this.createComponentElement("ball", this.#stick);

    this.applySubStyles();
  }

  addAxisKeyControl(keyname, axis, value) {
    const self = this;
    this.addKeyControl(keyname, function(keyDown) {
      if(keyDown) {
        self.setAxis(axis, value);
      } else if(self.#axes[axis] == value) {
        self.setAxis(axis, 0);
      }
    });
  }

  constructor(axisCount) {
    super();
    this.initAxes(axisCount);
  }

  connectedCallback() {
    super.connectedCallback();

    let self = this;
    let mousehandler = function(ev) {
      self.setClientPos(ev.clientX, ev.clientY);
    }

    this.addEventListener("mousemove",  mousehandler);
    this.addEventListener("mouseenter", mousehandler);
    this.addEventListener("mouseleave", mousehandler);

    let touchHandler = function(ev) {
      if(ev.targetTouches) {
        if(ev.targetTouches.length >= 1) {
          let pos = ev.targetTouches.item(0);
          self.setClientPos(pos.clientX, pos.clientY);
          ev.preventDefault(); 
        } else {
          self.clearAxes();
        }
      } else {
        self.clearAxes();
      }
    };

    this.addEventListener("touchstart", touchHandler);
    this.addEventListener("touchmove",  touchHandler);

    this.addEventListener("touchend", function(ev) {
      self.clearAxes();
    });

  }
}
window.customElements.define("virtual-joystick", VirtualJoystickElement);

// errrr so how is a game button different from a regular one?
// I guess the key things are default styling and game pad
// button emulation (in the api).
// Oh, and you can poll the state.  and stuff.
class VirtualGameButtonElement extends VirtualGameController {
  #button; // sub element for the button itself (the part which moves)
  #pressFrac = 0.0;

  #transitionedDown = false;

  transitionCount = 0; // debugging

  // these next 3 emulate GamepadButton functionality
  // https://developer.mozilla.org/en-US/docs/Web/API/GamepadButton
  get value() {
    return this.#pressFrac;
  }

  get pressed() {
    // let's say that if the press frac > .5 it's actually prcessed
    return this.value > 0.5;
  }

  get touched() {
    return this.value > 0;
  }

  // Game controls are generally polled, but one thing we do care
  // about is if a button changed state.  This returns true if it
  // has changed to being in the pressed ("down") state since the
  // last time something checked:
  get transitionedDown() {
    if(this.#transitionedDown) {
      this.#transitionedDown = false;
      return true;
    }

    return false;
  }

  set value(frac) {
    let oldPressed = this.pressed;
    this.#pressFrac = frac;
    if(!oldPressed && this.pressed) {
      this.#transitionedDown = true;
      this.transitionCount++;
    }
    // depress the button part per the fraction, to 25% of
    // the size of the thing:
    this.#button.style.transform = `translate(0, ${25*frac}%)`;
  }

  initFromDataConfig() {
    super.initFromDataConfig();
    const self = this;

    // data-keys is a comma separated string telling which
    // key(s) to bind to, if any:
    let keysStr = this.dataset.keys;
    if(typeof keysStr === 'undefined') {
        // old version was data-key; support that as well:
        keysStr = this.dataset.key;
    }

    if(typeof keysStr !== 'undefined') {
      const separator = /,\s*/;
      const keys = keysStr.split(separator);

      for(const key of keys) {
        this.addKeyControl(key, function(keyDown) {
          if(keyDown) {
            self.value = 1.0;
          } else {
            self.value = 0.0;
          }
        });
      }
    } 
  }

  constructor(axisCount) {
    super();
  }

  connectedCallback() {
    super.connectedCallback();

    let self = this;
    this.addEventListener("mousedown", function(ev) {
      self.value = 1.0;
    });
    this.addEventListener("mouseup", function(ev) {
      self.value = 0.0;
    });

    let touchHandler = function(ev) {
      if(ev.targetTouches) {
        if(ev.targetTouches.length >= 1) {
          //let touch = ev.targetTouches.item(0);
          //self.value = touch.force;
          self.value = 1.0;
        }
      }
      ev.preventDefault(); 
    };
    this.addEventListener("touchstart", touchHandler);
    this.addEventListener("touchmove",  touchHandler);
    this.addEventListener("touchend", function(ev) {
      self.value = 0;
      ev.preventDefault(); 
    });
    this.addEventListener("touchcancel", function(ev) {
      self.value = 0;
    });
  }

  defaultStyle() {
    return `
      .frame {
        background: radial-gradient(at 0 0, #cc4444, #770000);
        clip-path: ellipse(50% 50%);
        width: 70%;
        height: 70%;
      }
      .button {
        background: linear-gradient(to right, #880020, #440000);
        border-radius: 50%;
        width: 95%;
        height: 70%;
      }
    `;
  }

  initGraphics() {
    super.initGraphics();
    const frame  = this.createComponentElement("frame");
    this.#button = this.createComponentElement("button", frame);
  }
}
window.customElements.define("virtual-game-button", VirtualGameButtonElement);


