#!/usr/bin/env python3
"""Assemble dist/archlang-promo.html — ONE self-contained file: three.js bundle, Blender glb, compiled plan SVG, logo, fonts, audio.

  python3 scripts/build.py            # bundles three.js (npm run bundle) if needed, embeds dist/soundtrack.m4a when it exists
  python3 scripts/build.py --noaudio  # same, without the audio track (used before the score exists)
"""
import base64, json, os, subprocess, sys
from common import ROOT, DIST, HTML

b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
bundle = ROOT / 'build' / 'three.bundle.js'
if not bundle.exists():
    subprocess.run(['npm', 'run', '--silent', 'bundle'], cwd=ROOT, check=True)

svg = open(ROOT / 'data' / 'laneway-house.svg').read()          # real output of `archlang compile` (see README)
wm = open(ROOT / 'data' / 'archlang-wordmark-black.svg').read()   # archlang brand kit word-mark
cut = wm.index('</g></g><g fill="#111111" transform="translate(244.228') + len('</g></g>')
head = wm[:wm.index('<g transform="translate(3.337')]
mark = head + wm[len(head):cut].replace('fill="#111111"', 'fill="#8052ff"', 1) + '</svg>'   # logo mark, plum
word = head + wm[cut:]                                                                      # word-mark letters
fn = ROOT / 'node_modules' / '@fontsource'
fonts = dict(plex400=b64(fn / 'ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2'), plex500=b64(fn / 'ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2'),
             archivo600=b64(fn / 'archivo/files/archivo-latin-600-normal.woff2'), archivo800=b64(fn / 'archivo/files/archivo-latin-800-normal.woff2'))
audio = None
ap = DIST / 'soundtrack.m4a'
if ap.exists() and '--noaudio' not in sys.argv:
    audio = b64(ap)
data = dict(svg=svg, logo=dict(mark=mark, word=word), glb=b64(ROOT / 'blender' / 'laneway_house.glb'), fonts=fonts, audio=audio)
t = open(ROOT / 'src' / 'template.html').read()
t = t.replace('/*__THREE__*/', open(bundle).read()).replace('/*__DATA__*/', json.dumps(data)).replace('/*__COMP__*/', open(ROOT / 'src' / 'comp.js').read())
open(HTML, 'w').write(t)
print('wrote', HTML, len(t) // 1024, 'KB', '(with audio)' if audio else '(no audio)')
