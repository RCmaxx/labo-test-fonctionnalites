#!/bin/sh
# Force Safari à recharger après chaque mise à jour : une seule version, posée dans index.html.
# Les modules s'importent sans ?v ; l'importmap renvoie chaque js/*.js vers sa version courante.
V=$(date +%Y%m%d%H%M%S)
cd "$(dirname "$0")/.."
MAP=$(for f in js/*.js; do printf '"./%s": "./%s?v=%s",' "$f" "$f" "$V"; done | sed 's/,$//')
sed -i -E "s#<script type=\"importmap\">.*</script>#<script type=\"importmap\">{\"imports\": {$MAP}}</script>#" index.html
sed -i -E "s#((src|href)=\"[^\"]+\.(js|css))(\?v=[0-9]+)?\"#\1?v=$V\"#g" index.html
echo $V
