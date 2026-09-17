#!/usr/bin/env bash
# Builds the zip to upload to the Chrome Web Store, into dist/.
#
# The packaged copy differs from the repo in one way: src/dev-reload.js is left
# out, and its manifest entry with it, so nothing on the page can ask the
# extension to restart itself.
set -euo pipefail

cd "$(dirname "$0")/.."
root=$(pwd)
out="$root/dist"
stage="$out/photo-deduper"
name="photo-deduper-$(jq -r .version manifest.json).zip"

rm -rf "$stage" "$out/$name"
mkdir -p "$stage"

python3 tools/rasterize.py >/dev/null

mkdir -p "$stage/icons"
cp icons/*.png "$stage/icons/"  # the SVG is the source, not something the browser loads
mkdir -p "$stage/src"
cp -R src/lib src/ui "$stage/src/"
cp src/background.js src/content.js "$stage/src/"

jq '.content_scripts[0].js |= map(select(. != "src/dev-reload.js"))' manifest.json > "$stage/manifest.json"

# Anything referenced by the manifest must exist in the staged copy, or Chrome
# rejects the upload with a message that does not say which file is missing.
missing=$(cd "$stage" && jq -r '
  [ .content_scripts[0].js[], .background.service_worker,
    (.icons | values[]), (.action.default_icon // {} | values[]) ] | .[]' manifest.json |
  while read -r f; do [ -f "$stage/$f" ] || echo "$f"; done)
if [ -n "$missing" ]; then
  echo "missing from the package:" >&2
  echo "$missing" >&2
  exit 1
fi

(cd "$stage" && zip -qr "$out/$name" .)
echo "$out/$name"
unzip -l "$out/$name" | tail -1
