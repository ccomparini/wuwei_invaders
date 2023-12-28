
/*

OK SO gamepads are polled anyway.  And I can't inherit from the
builtin type.  etc etc.  Maybe just duck-type the virtual
joystick to

One thing:  afaict there's no way to get it to be included in the
navigator.getGamepads() array.  Ohwell.

// https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
// This is an old fashioned standup game style joystick,
// so it only has (at most) 2 axes
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
  // hardware works, in general?  I would think not,
  // in this day and age, but ok..
  update() {
  }
}
 */

class VirtualJoystickElement extends HTMLElement {

  constructor() { super(); }

  // ok go back to this, but maybe do the stick as an svg
  // underlay?
  initGraphics_pure_html() {
    // custom elements aren't supposed to muck with
    // children, in the normal sense.  but, they -can-
    // attach a "shadow root", which (as I understand
    // it) makes them into a new, contained DOM tree,
    // and add elements to that.  i.e., the added elements
    // are scoped to this shadow DOM, and thus can't
    // cause weirdness outside this element.
    const shadowDOM = this.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      .ball {
        background-color: blue;
        color: blue;
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
        border: red 1px;
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

    // OH LOOK:
    // use this for ball, and, if possible, stick.
    // https://developer.mozilla.org/en-US/docs/Web/CSS/offset
    // https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API/Keyframe_Formats
    // OR NOT, because I can't figure out how to just set it to a particular
    // point in the animation.  instead just rotate:
    //  https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transforms/Using_CSS_transforms
    // ... YA know, the ball could be a child of the stick...

    // can we move this up?
    shadowDOM.appendChild(style);
    shadowDOM.appendChild(slot);
    shadowDOM.appendChild(stick);
    //shadowDOM.appendChild(ball);
  }

  initGraphics() {
    // svg approach:
    // .... actually this turns out to be terrible. complicated after all
    // and harder for users to style.
    const shadowDOM = this.attachShadow({ mode: "open" });

    const svnNS = "http://www.w3.org/2000/svg";

    const view = document.createElementNS(svnNS, "svg");
    view.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
    view.setAttribute('viewbox', '0 0 100% 100%');
    view.setAttribute('width', '100%');
    view.setAttribute('height', '100%');

    const ball = document.createElementNS(svnNS, "circle");
    ball.setAttribute("cx", "50%");
    ball.setAttribute("cy", "0");
    ball.setAttribute("r" , "12.5%");
    ball.setAttribute('fill', '#2962ff');
    view.appendChild(ball);

/*
<svg viewbox='0 0 400 400' xmlns='http://www.w3.org/2000/svg' height='60vmin' width='60vmin'>
  <rect x='0' y='0' width='50%' height='50%' fill='tomato' opacity='0.75' />
  <rect x='25%' y='25%' width='50%' height='50%' fill='slategrey' opacity='0.75' />
  <rect x='50%' y='50%' width='50%' height='50%' fill='olive' opacity='0.75' />
  <rect x='0' y='0' width='100%' height='100%' stroke='cadetblue' stroke-width='0.5%' fill='none' />
</svg>
 */
    shadowDOM.appendChild(view);
  }

  connectedCallback() {
    console.log("Custom element added to page.");

//this.style.backgroundColor="red"; // debug
    this.style.minWidth  = "50px";
    this.style.minHeight = "30px";
    this.style.display   = 'inline-block';
    this.initGraphics_pure_html();

    this.gamepad = new VirtualJoystickGamepad();
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

// Gamepad emulation:
// https://developer.mozilla.org/en-US/docs/Web/API/Gamepad
// https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
class VirtualJoystickGamepad {

  constructor() {
    
  }

  // I'm skipping all experimental/nonstandard attributes.
  get axes()      { return []; }
  get buttons()   { return []; }
  get connected() { return true; }
  get id()        { return `virtual-`; }
  get index()     { return false; }
  get mapping()   { return false; }
  get timestamp() { return perfomance.now(); }
  
  // end Gamepad emulation
}

