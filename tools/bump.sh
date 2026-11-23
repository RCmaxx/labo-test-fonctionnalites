#!/bin/sh
# Ajoute ?v=<version> à tous les imports JS et CSS pour forcer Safari à recharger après chaque mise à jour.
V=$(date +%Y%m%d%H%M%S)
cd "$(dirname "$0")/.."
find js -name '*.js' -exec sed -i -E "s#(from '[^']+\.js)(\?v=[0-9]+)?'#\1?v=$V'#g; s#(import\('[^']+\.js)(\?v=[0-9]+)?'#\1?v=$V'#g" {} +
sed -i -E "s#((src|href)=\"[^\"]+\.(js|css))(\?v=[0-9]+)?\"#\1?v=$V\"#g" index.html
echo $V
