#!/bin/bash

cp wuwei.html index.html

FILES=(
    LICENSE
    virtual-game-controller.js
    README.md
    wuwei.js
    index.html
)

zip wuwei-invaders.zip ${FILES[@]}
