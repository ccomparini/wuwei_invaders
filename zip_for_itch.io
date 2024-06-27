#!/bin/bash

ZIPFILE=build/wuwei-invaders.zip

FILES=(
    LICENSE
    virtual-game-controller.js
    README.md
    wuwei.js
    index.html
)

cp wuwei.html index.html
zip $ZIPFILE ${FILES[@]}
