# Credits and licences

This repository's own code (`src/`, `blender/*.py`, `audio/*.py`, `scripts/`) is MIT-licensed — see [LICENSE](LICENSE). Everything it builds on is listed here.

Every sound in `soundtrack.wav` is made from the recorded instrument samples listed below (no synthesised oscillators, no music from outside these libraries).
The only non-sample audio element is the convolution reverb impulse response, which is shaped noise (it is a processing tool, not a sound source).
All sample libraries are **CC0 1.0 / public domain**; they are fetched by `scripts/fetch_samples.sh` at the pinned commits below and are **not included in this repository** — only the mixed result (`soundtrack.wav`, a Release asset) is distributed.

## Audio samples

| Library | Used for | Licence | Source (commit) |
|---|---|---|---|
| **Big Rusty Drums** — Karoryfer Samplecraft | the drum kit: `kick_24`, `snare_14`, `hihat_14` (closed/open/pedal), `crash_17`, `ride_22` (bell), `tom_15/18/22` (centre, rim-click `rc` and stick-click `sc` articulations); multiple mics (close / overheads / snare-bottom) mixed in `samplers.py`; velocity layers; also the typing ticks (tom_15 rim‑click / stick‑click), "wall rise" and "collapse" hits (toms) and the reversed‑crash swells | CC0 1.0 (`LICENSE` in the repo) | https://github.com/sfzinstruments/karoryfer.big-rusty-drums (`f07ce00df34a46b6b08375be56fe116cf15782bc`) |
| **Splendid Grand Piano** (Akai Steinway, 4 velocity layers; SFZ mapping by kinwie) | chord comping (Am – F – C – G, ends on C), logo/slogan chords | Public Domain (released by Akai in 2000, per the repo README) | https://github.com/sfzinstruments/SplendidGrandPiano (`1c595d827b7fd7f0be3134aaed0f90b3662a09cf`) |
| **Karoryfer × bigcat Cello** — sustained arco (`sus/*_d.wav`, p/mp/mf/f) | string pads (root + fifth), logo swell | CC0 1.0 | https://github.com/sfzinstruments/karoryfer-bigcat.cello (`6fd75fbfc1dbb3109bf26220ba1adea46188a18b`) |
| **Karoryfer Meatbass** (upright bass) — pizzicato, velocity layers | bass line | CC0 1.0 | https://github.com/sfzinstruments/karoryfer.meatbass (`ac9e859564bda286ab5ec672d00ff1aa2fef2895`) |
| **VCSL — Versilian Community Sample Library** (S. Gossner) | glockenspiel (soft/medium/loud), vibraphone (soft mallets), claves — the "grid / room / door / window / furniture / logo" bell accents | CC0 1.0 | https://github.com/sgossner/VCSL (`c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e`) |
| **body_percussion** (sfzinstruments) | finger snap (`snap_l_rr*`) on door events | CC0 1.0 | https://github.com/sfzinstruments/body_percussion (`4ac9d8966679c648b62fa10a188179e186b97f24`) |

Evaluated but **not used** (licence not verified as commercial‑use safe, so excluded): *Terkelsen Marimba*.

### Processing applied to the samples (Python: numpy / scipy / soundfile / pyloudnorm)
Pitch‑shift by resampling (`resample_poly`) from the nearest recorded note, velocity‑layer selection, multi‑mic mixing, per‑stem gain/pan, envelope release, time reversal of a crash cymbal for the two "whoosh" swells, sidechain ducking of bass/keys/strings/bells by the kick, convolution reverb (shaped‑noise IR), loudness normalisation to −16 LUFS and a look‑ahead limiter (−1.5 dBFS ceiling). See `audio/score.py` and `audio/samplers.py`.

## Software and assets in the picture

| Item | Use | Licence |
|---|---|---|
| **three.js** r0.186 (bundled with esbuild, inlined in the html) | renderer, EffectComposer, BokehPass (DOF), GLTFLoader | MIT |
| **Blender 5.2.3** | only builds the 3D house (`blender/build_house.py` → `blender/laneway_house.glb`) | GPL (the generated geometry is the author's own) |
| **archlang** (https://github.com/ChanMeng666/archlang, commit `0d2dbc0` when the film was made) | the language; `data/laneway-house.arch` (its example), `data/laneway-house.svg` (the compiler's output for it), `data/archlang-wordmark-black.svg` (brand-kit word-mark); slogans and chips on the end card are the project's own wording | MIT (repo `LICENSE`) |
| **@fontsource/archivo** (600, 800), **@fontsource/ibm-plex-mono** (400, 500) | embedded as base64 woff2 | SIL OFL 1.1 |
| onetake method / skill (https://github.com/feitangyuan/onetake) | the working method only (one continuous take, `f(t)` composition, carry at boundaries, shutter blur, events → score); no onetake code or assets are copied into the video | PolyForm Noncommercial 1.0.0 (repo `LICENSE`) — only the method was followed |

## Honest notes
* archlang itself outputs **2D** drawings (SVG / DXF / PDF / PNG). The 3D house is an artistic extension built in Blender for this promo — it is not an archlang feature and the video never says so.
* The code lines typed in the editor are real archlang source lines from the project's example; the plan shown is the real compiler output for that example.
* The slogan, sub‑line and chips on the end card are the project's own wording (archlang README / brand assets).
