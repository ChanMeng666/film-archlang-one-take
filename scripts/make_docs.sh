#!/usr/bin/env bash
# Regenerate docs/preview.gif (800 px wide, 10 fps, 32 colours) and docs/stills/*.png from dist/archlang-promo.mp4.
#   bash scripts/make_docs.sh [path/to/archlang-promo.mp4]
set -euo pipefail
cd "$(dirname "$0")/.."
MP4="${1:-dist/archlang-promo.mp4}"
mkdir -p docs/stills
ffmpeg -v error -y -i "$MP4" -vf "fps=10,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=32:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -loop 0 docs/preview.gif
for p in "01_code_to_plan:9.0" "02_plan:12.8" "03_walls_rise:14.6" "04_aerial_roof:23.5" "05_endcard:31.8"; do
  ffmpeg -v error -y -ss "${p##*:}" -i "$MP4" -frames:v 1 -vf scale=1280:-1:flags=lanczos "docs/stills/${p%%:*}.png"
done
ls -la docs/preview.gif docs/stills
