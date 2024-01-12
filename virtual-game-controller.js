/*
    Old fashioned one-axis arcade style joystick.

    Usage:
       
       <script src="virtual-joystick.js"></script>

     one axis joysticks:
       <virtual-joystick id="joystick-p1"> </virtual-joystick>
       <virtual-joystick id="joystick-p2"> </virtual-joystick>S

     two axis:
       <virtual-joystick id="joystick" data-axis-count=2> </virtual-joystick>

    Styling: XXX fill in

    data-XXX fill in
 */


class VirtualGameController extends HTMLElement {

  // errf these are css sub classes
  #subClasses = [ ];   // shortcut to classes of subelements XXX rename
  #keyControls = { }; // key event.code() -> handler function

  constructor() {
    super();
    this.initFromDataConfig();
  }

  initFromDataConfig() {
  }

  initGraphics() {
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

    this.setDefaultStyle(shadowDOM);
    this.updateStyle();

  }

  setDefaultStyle(el) {
    this.innerStyle = document.createElement("style");
    el.appendChild(this.innerStyle);
// XXX how to make this sane when dealing with subclasses?
// I guess each sub can have its own... ok yeah should be good
    this.innerStyle.textContent = `
      .ball {
        background: radial-gradient(#000000, #ae0f0f);
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

  createComponentElement(elClass) {
    const el = document.createElement("span");
    el.setAttribute("class", elClass);
    el.style.display = "inline-block";
    el.style.position = "relative";

    this.#subClasses.push(elClass);

    return el;
  }

  updateStyle() {
    const existingStyle = window.getComputedStyle(this);

    // https://www.w3.org/TR/CSS2/cascade.html#cascading-order

    // The idea here is style for sub props can be set using
    //  custom properties, like this:
    //  --[sub class]-[real css property] = [real css value]
    // For example, to set a green border on the ball for the virtual
    // joystick with id #joystick-1, you could do:
// XXX this is fail:
    // #joystick-1 {
    //   --ball-border: green 10px;
    // }
    // this is terribly brute force, but seems to be the best we can do?
    var subStyle = "\n\n";
    for(let subClass of this.#subClasses) {
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
    this.innerStyle.textContent += subStyle;
  }

  connectedCallback() {
    // called when added to page
    this.initFromDataConfig();

    this.initGraphics();

    var self = this;

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
        }
      }
    };

    this.addEventListener("touchstart", touchHandler);
    this.addEventListener("touchmove",  touchHandler);
    this.addEventListener("touchend",   touchHandler);

    function keyhandler(ev) {
        var func = self.#keyControls[ev.code];
        if(func) func(ev.type === "keydown");
    }
    window.addEventListener('keyup',   keyhandler, false);
    window.addEventListener('keydown', keyhandler, false);
  }

  disconnectedCallback() {
    // XXX kill event listeners here
    //  https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener
  }

  adoptedCallback() {
    console.log(`Joystick ${this} moved to new page.  whoa dude.`);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log(`Joystick attribute ${name} has changed from '${oldValue}' to '${newValue}'`);
  }
  // end HTMLElement handlers

  addKeyControl(keyname, axis, value) {
    const self = this;
    this.#keyControls[keyname] = function(keyDown) {
      if(keyDown) {
        self.setAxis(axis, value);
      } else if(axes[axis] == value) {
        self.setAxis(axis, 0);
      }
    }
  }
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
    //   data-max-swing XXX
    //   data-y-range-pct
    //   data-key-left
    //   data-key-right
    if(typeof this.dataset.axisCount !== 'undefined') {
      this.initAxes(this.dataset.axisCount);
    }
    if(typeof this.dataset.maxSwing !== 'undefined') {
//  XXX change to data-x-range-degrees
      this.#maxSwing = this.dataset.maxSwing;
    }
    if(typeof this.dataset.yRangePct !== 'undefined') {
      this.#yRangePct = this.dataset.yRangePct;
    }
    // key controls!  
    if(typeof this.dataset.keyLeft !== 'undefined') {
        this.addKeyControl(this.dataset.keyLeft, 0, -1.0);
    }
    if(typeof this.dataset.keyRight !== 'undefined') {
        this.addKeyControl(this.dataset.keyRight, 0, 1.0);
    }
  }

  initGraphics() {
    super.initGraphics();

    const slot       = this.createComponentElement("slot");
    const slot_back  = this.createComponentElement("slot-back");
    const slot_front = this.createComponentElement("slot-front");
    slot.appendChild(slot_back);
    slot.appendChild(slot_front);

    this.#stick = this.createComponentElement("stick");
    this.#ball  = this.createComponentElement("ball");
    this.#stick.appendChild(this.#ball);

    this.shadowRoot.appendChild(slot);
    this.shadowRoot.appendChild(this.#stick);

    this.updateStyle();
  }

  constructor(axisCount) {
    super();
    this.initAxes(axisCount);
  }
}
window.customElements.define("virtual-joystick", VirtualJoystickElement);

// errrr so how is a game button different from a regular one?
// I guess the key things are default styling and game pad
// button emulation (in the api).
// Oh, and you can poll the state.  and stuff.
class VirtualGameButtonElement extends VirtualGameController {
  #button; // sub element for the button itself (the part which moves)

  constructor(axisCount) {
    super();
  }

  initGraphics() {
    super.initGraphics();
    const frame  = this.createComponentElement("frame");
    this.#button = this.createComponentElement("button");
  }
}
window.customElements.define("virtual-game-button", VirtualGameButtonElement);


