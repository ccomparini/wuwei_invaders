

// Initializing audio context here makes it angry - it says
// we need user input before initializing audio context,
// presumably because advertizers ruin everything:
//const audioContext = new AudioContext();
let audioContext;

/*
function binarify(b64_src) {
    return Uint8Array.from(atob(b64_src), c => c.charCodeAt(0)).buffer;
}

function soundify(b64_src) {
    if(!audioContext) audioContext = new AudioContext();

    const sound = audioContext.decodeAudioData(binarify(b64_src));
    sound.catch((error) => {
      console.error(`can't soundify: ${error}`);
    });
    return sound; 
}
 */

function soundify(arrayBufSound) {
    if(!audioContext) audioContext = new AudioContext();
    const sound = audioContext.decodeAudioData(arrayBufSound);
    sound.catch((error) => {
      console.error(`can't soundify: ${error}`);
    });
    return sound; 
}

import { sounds as _sounds } from "./sounds.mjs";

export const sounds = _sounds(audioContext);

export function playSound(name) {
    soundify(sounds[name]).then((sound) => {
// per https://web.dev/articles/webaudio-intro
// but seems janky.. why connect each time?
        const source = audioContext.createBufferSource(); // creates a sound source
        source.buffer = sound;                    // tell the source which sound to play
        source.connect(audioContext.destination);       // connect the source to the context's destination (the speakers)
        //source.noteOn(0);      // per that article, but fails
        source.start(); // per MDN

    });
}

