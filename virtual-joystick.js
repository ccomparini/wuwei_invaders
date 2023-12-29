/*
    Old fashioned one-axis arcade style joystick.

    Usage:
       <script src="virtual-joystick.js"></script>

       <virtual-joystick id="joystick-p1"> </virtual-joystick>
 */


class VirtualJoystickElement extends HTMLElement {

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

    this.innerStyle = document.createElement("style");
    this.updateStyle();
    shadowDOM.appendChild(this.innerStyle);

    const slot = document.createElement("span");
    const slot_back = document.createElement("span");
    const slot_front = document.createElement("span");
    slot.setAttribute("class", "slot");
    slot.style.display = "inline-block";
    slot.style.position = "relative";
    slot_front.setAttribute("class", "slot_front");
    slot_front.style.display = "inline-block";
    slot_front.style.position = "relative";
    slot_back.setAttribute("class", "slot_back");
    slot_back.style.display = "inline-block";
    slot_back.style.position = "relative";
    slot.appendChild(slot_back);
    slot.appendChild(slot_front);

    const stick = document.createElement("span");
    stick.setAttribute("class", "stick");
    stick.style.display = "inline-block";
    stick.style.position = "relative";

    const ball = document.createElement("span");
    ball.setAttribute("class", "ball");
    ball.style.display = "inline-block";
    ball.style.position = "absolute";
    stick.appendChild(ball);

    shadowDOM.appendChild(slot);
    shadowDOM.appendChild(stick);
  }

  updateStyle() {
    const existingStyle = window.getComputedStyle(this);

    this.innerStyle.textContent = `
      .ball {
        background-color: red;
        background-color: ${existingStyle.color};
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
        background-color: #505050;
        border-radius: 0 0 80% 80%;
        color: #505050;
        transform-origin: 50% 100%;
        rotate: 23deg;
        z-index: 3;
      }
      .slot {
        color: black;
        width: 100%;
        height: 20%;
        top: 100%;
      }
      .slot_front {
        background-color: #ffffff;
        border: #a0a0a0 3px;
        height: 50%;
        bottom: -10%;
        width: 100%;
        z-index: 4;
      }
      .slot_back {
        background-color: #8f8f8f;
        border-radius: 50vb 50vb 0 0;
        border: #808080 3px;
        height: 40%;
        top: 0%;
        width: 100%;
        z-index: 2;
      }
    `;
  }

  connectedCallback() {
    console.log("Custom element added to page.");

    this.style.minWidth  = "50px";
    this.style.minHeight = "30px";
    this.style.display   = 'inline-block';
    this.initGraphics();

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
    //console.log(`Joystick ${this} moved to new page.  whoa dude.`);
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

