

function soundify(ctx, arrayBufSound) {
    const sound = ctx.decodeAudioData(arrayBufSound);
    sound.catch((error) => {
      console.error(`can't soundify: ${error}`);
    });
    return sound; 
}

import { soundBytes } from "./sounds.mjs";

var actualSounds;

/**
 *  loadSounds(ctx, into)
 *
 *  Attempts to load all the sounds from soundify into the
 *  object passed.  A reference to the object passed will
 *  be kept here for later calls to playSound().
 *
 *  Sounds are "loaded" asynchronously.
 *
 *  Returns an object whose keys are the names of the sounds
 *  and whose values are undefined until the sounds are loaded,
 *  after which they're some defined value which this module
 *  will use to play them.
 *
 */
export function loadSounds(ctx, into) {
    actualSounds = into;
    for(const [name, bytes] of Object.entries(soundBytes)) {
        actualSounds[name] = undefined;
        soundify(ctx, bytes).then((sound) => {
            actualSounds[name] = sound;
        });
    }

    return actualSounds;
}

/**
 *  playSound(ctx, sound name)
 *
 *  Plays the named sound in the context passed, if it's
 *  available.
 *
 *  Sounds must be "loaded" via a prior call to loadSounds.
 *
 *  Returns true if the sound was played, or false otherwise.
 *  Additionally, warns if the name doesn't correspond to a
 *  known sound.
 *
 */
export function playSound(ctx, name) {
    if(!(name in actualSounds)) {
        console.warn(`there's no sound named '${name}'`);
        return false;
    }

    const sound = actualSounds[name];
    if(sound) {
        // XXX do we need to create buffer source each time as well?
        // I think not.  Might actually be better to create it earlier.
        // not sure what keeps the "read" pointers in the sounds though....
        const source = ctx.createBufferSource(); // creates a sound source
        source.connect(ctx.destination);       // connect the source to the context's destination (the speakers)
        source.buffer = sound;                    // tell the source which sound to play
        source.start(); // per MDN;  but maybe we can just hit .play()?
    }
/*
    soundify(sounds[name]).then((sound) => {
        // XXX do we need to do this each time as well?
        const source = audioContext.createBufferSource(); // creates a sound source

// per https://web.dev/articles/webaudio-intro
// but seems janky.. why connect each time?
// can we just connect once?
// is this even necessary?
        source.connect(audioContext.destination);       // connect the source to the context's destination (the speakers)
        source.buffer = sound;                    // tell the source which sound to play
        //source.noteOn(0);      // per that article, but fails
        source.start(); // per MDN

    });
 */
}

