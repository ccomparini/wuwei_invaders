/*
    Old fashioned one-axis arcade style joystick.

    Usage:
       <script src="virtual-joystick.js"></script>

       <virtual-joystick id="joystick-p1"> </virtual-joystick>

    Styling: XXX fill in
 */


class VirtualJoystickElement extends HTMLElement {

  #subClasses = [ ];   // this really needed?

  constructor() { super(); }

  initGraphics() {
    // custom elements aren't supposed to muck with
    // children, in the normal sense.  but, they -can-
    // attach a "shadow root", which (as I understand
    // it) makes them into a new, contained DOM tree,
    // and add elements to that.  i.e., the added elements
    // are scoped to this shadow DOM, and thus can't
    // cause weirdness outside this element.
    const shadowDOM = this.attachShadow({ mode: "open" });

    this.setDefaultStyle(shadowDOM);

    const slot       = this.createComponentElement("slot");
    const slot_back  = this.createComponentElement("slot-back");
    const slot_front = this.createComponentElement("slot-front");
    slot.appendChild(slot_back);
    slot.appendChild(slot_front);

    const stick = this.createComponentElement("stick");
    const ball  = this.createComponentElement("ball");
/*
    ball.addEventListener("drag", (ev) => {
// doesn't happen?
      console.log(`CAN HAS DRAG: ${ev}`);
    });
 */
    stick.appendChild(ball);

    shadowDOM.appendChild(slot);
    shadowDOM.appendChild(stick);
    this.updateStyle();

    this.stick = stick;
  }

  setDefaultStyle(el) {
    this.innerStyle = document.createElement("style");
    el.appendChild(this.innerStyle);
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
        /*rotate: 23deg; */
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

    // The idea here is this:
    //   Style for sub props can be set using custom properties,
    //  like this:
    //  --[sub class]-[real css property] = [real css value]
    // For example, to set a green border on the ball for the virtual
    // joystick with id #joystick-1, you could do:
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

    this.style.minWidth  = "50px";
    this.style.minHeight = "30px";
    this.style.display   = 'inline-block';
    this.initGraphics();

/*
    this.addEventListener("mouseenter", (ev) => {
      console.log("CAN HAS MOUSE ENTERED");
      this.style.setProperty('background-color', 'orange');
    });
 */

    var self = this;
    let touchHandler = function(ev) {

      console.log("CAN HAS TOUCH");
      if(ev.targetTouches) {
        if(ev.targetTouches.length >= 1) {
          let bounds = self.getBoundingClientRect();
          let touchX = ev.targetTouches.item(0).clientX;
          if(touchX < bounds.x) touchX = bounds.x;
          if(touchX > bounds.right) touchX = bounds.right;
          // let's say we limit the joystick's swing to +- 45deg
          // .. relative to the center.. hmm should be configurable.
          let relativeX = touchX - (bounds.x + bounds.width/2);
          self.stick.style.setProperty('rotate', `${45 * relativeX/bounds.width}deg`);
          ev.preventDefault(); 
        }
      }
    };

    this.addEventListener("touchstart", touchHandler);
    this.addEventListener("touchmove",  touchHandler);
    this.addEventListener("touchend",   touchHandler);

    this.gamepad = new VirtualJoystickGamepad(this);
/*
    this.dispatchEvent(
      // https://developer.mozilla.org/en-US/docs/Web/API/GamepadEvent/GamepadEvent
ok this fails radically:
Uncaught TypeError: Failed to construct 'GamepadEvent': Failed to read the 'gamepad' property from 'GamepadEventInit': Failed to convert value to 'Gamepad'.
    at VirtualJoystickElement.connectedCallback (virtual-joystick.js:92:7)
connectedCallback @ virtual-joystick.js:92
      new GamepadEvent("gamepadconnected", {
        gamepad: this.gamepad
      })
    );
 */
  }

  disconnectedCallback() {
    //console.log(`Joystick ${this} removed from page.`);

/*
presumably this would fail, as well:
    new GamepadEvent("gamepaddisconnected", {
      gamepad: this.gamepad
    })
 */
  }

  adoptedCallback() {
    console.log(`Joystick ${this} moved to new page.  whoa dude.`);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log(`Joystick attribute ${name} has changed from '${oldValue}' to '${newValue}'`);
  }
}

window.customElements.define("virtual-joystick", VirtualJoystickElement);

/*

OK SO gamepads are polled anyway.  And I can't inherit from the
builtin type.  etc etc.  Maybe just duck-type the virtual
joystick to whatever the gamepad thing is.

One thing:  afaict there's no way to get it to be included in the
navigator.getGamepads() array.  Ohwell.

// https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
// It looks like I can't "new" a Gamepad object.  Not too
// surprising.  Let's see if we can emulate one:
//class VirtualGamepad extends Gamepad {
class VirtualGamepad {
  //constructor() { super(); }
  // https://developer.mozilla.org/en-US/docs/Web/API/Gamepad
  get axes() { return []; }


  .buttons Read only
An array of gamepadButton objects representing the buttons present on the device.


  // OK weirdly, unlike every other input device,
  // gamepads don't generate events.  You need to
  // poll them.  Maybe that's how actual gamepad
  // hardware works nowadays, in general?  except
  // I would think the underlying usb or bluetooth
  // or whatever must be event-driven.  Anwyayaaa.a.
  update() {
  }
}
 */
// Gamepad emulation:
// https://developer.mozilla.org/en-US/docs/Web/API/Gamepad
// https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
class VirtualJoystickGamepad {

  constructor(el) {
    this.htmlElement = el;
  }

  // For now, for simplicity, I'm skipping all experimental/nonstandard
  // attributes.
  get axes()      { return []; }
  get buttons()   { return []; }
  get connected() { return true; }
  get id()        { return `virtual-${htmlElement.id}`; }
  get index()     { return false; }
  get mapping()   { return false; }
  get timestamp() { return perfomance.now(); }
  // end Gamepad emulation
}

