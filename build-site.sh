#!/usr/bin/env sh
set -eu

mkdir -p dist
cp index.html alexandre.png audio.png carta.png logo-papec.png material-palestra.pdf dist/
rm -rf dist/cursoiaafavordoseutempoeproposito
cp -r cursoiaafavordoseutempoeproposito dist/
