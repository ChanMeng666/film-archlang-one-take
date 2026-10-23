#!/usr/bin/env bash
# Encode the AAC track, embed it in the single-file html, and collect everything for the GitHub Release in release_assets/.
# Run after: audio/score.py (dist/soundtrack.wav) and scripts/render.py (dist/archlang-promo.mp4).
#   bash scripts/make_release_assets.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ffmpeg -v error -y -i dist/soundtrack.wav -c:a aac -b:a 192k dist/soundtrack.m4a
python3 scripts/build.py                     # html now embeds dist/soundtrack.m4a
mkdir -p release_assets
cp dist/archlang-promo.html dist/archlang-promo.mp4 dist/soundtrack.wav dist/soundtrack.m4a release_assets/
(cd release_assets && sha256sum archlang-promo.html archlang-promo.mp4 soundtrack.wav soundtrack.m4a > SHA256SUMS.txt && cat SHA256SUMS.txt && ls -la)
