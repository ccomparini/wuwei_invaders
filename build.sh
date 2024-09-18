#!/bin/bash

mkdir build

echo "Making build/index.html..."
./util/embedify wuwei.html > build/index.html

