#!/bin/sh
# Проставляет ?v=<хэш содержимого> в ссылки index.html на style.css и js/*.js.
# GitHub Pages кэширует файлы на 10 минут; без версии браузер берёт старый game.js к новому index.html.
# Запускать перед каждым коммитом, который меняет эти файлы.
set -e
cd "$(dirname "$0")/.."
v=$(cat style.css js/config.js js/game.js | shasum | cut -c1-8)
sed -i '' -E \
  -e "s#href=\"style\.css(\?v=[a-z0-9]+)?\"#href=\"style.css?v=$v\"#" \
  -e "s#src=\"js/config\.js(\?v=[a-z0-9]+)?\"#src=\"js/config.js?v=$v\"#" \
  -e "s#src=\"js/game\.js(\?v=[a-z0-9]+)?\"#src=\"js/game.js?v=$v\"#" \
  index.html
echo "assets v=$v"
