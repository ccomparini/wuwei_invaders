#!/bin/bash

ZIPFILE=build/wuwei-invaders.zip

FILES=(
    LICENSE
    virtual-game-controller.js
    README.md
    wuwei.js
    index.html
)

zip $ZIPFILE ${FILES[@]}
