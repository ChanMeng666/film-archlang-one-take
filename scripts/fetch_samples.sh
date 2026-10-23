#!/usr/bin/env bash
# Fetch ONLY the sample files the score uses, from the upstream repositories, pinned to exact commits.
# Result: samples/<library>/...   (≈ 0.6 GB; git-ignored — the libraries are CC0 / public domain, see CREDITS.md)
#   bash scripts/fetch_samples.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p samples

# fetch <dir-name> <repo-url> <commit> <sparse path>...
fetch() {
  local name="$1" url="$2" sha="$3"; shift 3
  if [ -f "samples/$name/.fetched-$sha" ]; then echo "• $name already at ${sha:0:7}"; return; fi
  echo "• $name @ ${sha:0:7}"
  rm -rf "samples/$name"; mkdir -p "samples/$name"
  git -C "samples/$name" init -q
  git -C "samples/$name" remote add origin "$url"
  git -C "samples/$name" sparse-checkout init --cone
  git -C "samples/$name" sparse-checkout set "$@"
  git -C "samples/$name" fetch -q --depth 1 --filter=blob:none origin "$sha"
  git -C "samples/$name" checkout -q FETCH_HEAD
  touch "samples/$name/.fetched-$sha"
}

# Big Rusty Drums — Karoryfer Samplecraft (CC0): the drum kit
D=Samples
fetch karoryfer.big-rusty-drums https://github.com/sfzinstruments/karoryfer.big-rusty-drums.git f07ce00df34a46b6b08375be56fe116cf15782bc \
  $D/kick_24/kick $D/snare_14/center $D/snare_14/rc $D/snare_14/sc $D/snare_14/sidestick \
  $D/hihat_14/tc $D/hihat_14/open $D/hihat_14/chik $D/hihat_14/cl $D/hihat_14/ho \
  $D/crash_17/cr $D/crash_17/mallet $D/ride_22/bl $D/ride_22/rd $D/ride_22/mallet \
  $D/tom_15/center $D/tom_15/rc $D/tom_15/sc $D/tom_18/center $D/tom_22/center
# Splendid Grand Piano — Akai (public domain)
fetch SplendidGrandPiano        https://github.com/sfzinstruments/SplendidGrandPiano.git        1c595d827b7fd7f0be3134aaed0f90b3662a09cf Samples
# Karoryfer x bigcat Cello (CC0): sustained arco
fetch karoryfer-bigcat.cello    https://github.com/sfzinstruments/karoryfer-bigcat.cello.git    6fd75fbfc1dbb3109bf26220ba1adea46188a18b Samples/sus
# Karoryfer Meatbass (CC0): upright bass, pizzicato
fetch karoryfer.meatbass        https://github.com/sfzinstruments/karoryfer.meatbass.git        ac9e859564bda286ab5ec672d00ff1aa2fef2895 Samples/pizz
# body_percussion (CC0): finger snaps
fetch body_percussion           https://github.com/sfzinstruments/body_percussion.git           4ac9d8966679c648b62fa10a188179e186b97f24 Samples/body
# VCSL — Versilian Community Sample Library (CC0): glockenspiel, vibraphone (soft mallets), claves
fetch VCSL                      https://github.com/sgossner/VCSL.git                            c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e \
  "Idiophones/Struck Idiophones/Glockenspiel" "Idiophones/Struck Idiophones/Vibraphone/Soft Mallets" "Idiophones/Struck Idiophones/Claves"

echo "done → $(pwd)/samples"
