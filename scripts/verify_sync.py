#!/usr/bin/env python3
"""verify_sync.py — do the animation events (read from the html's own EVENTS via data/events.json) land on sound?
  python3 scripts/verify_sync.py [--wav dist/soundtrack.wav]
 1) schedule check: nearest mix_log (score) entry vs event time
 2) audio check: onset detection on the rendered soundtrack.wav (independent of the score), nearest onset vs event time
 3) drum check: for events whose time is on the beat grid, is there a kick/snare/hat/tom at that exact time?"""
import json, sys, numpy as np, soundfile as sf, scipy.signal as ss
from common import ROOT, DIST
WAV = sys.argv[sys.argv.index('--wav') + 1] if '--wav' in sys.argv else str(DIST / 'soundtrack.wav')
FPS = 30; fr = 1 / FPS
ev = json.load(open(ROOT / 'data' / 'events.json'))['events']; mix = json.load(open(ROOT / 'audio' / 'mix_log.json'))
ev = [e for e in ev if e['name'] not in ('intro', 'still')]
mt = np.array([m[0] for m in mix]); drum = np.array([m[0] for m in mix if m[1] in ('kick', 'drums') and m[2] in ('kick', 'snare', 'hat', 'hat_open', 'crash', 'crash_lift', 'crash_off', 'kick_lift', 'kick_roof', 'roll', 'fill')])
d1 = np.array([np.abs(mt - e['t']).min() for e in ev])
print(f'events checked: {len(ev)}')
print(f'1) score entry within 1 ms of event: {(d1 < 1e-3).sum()}/{len(ev)}  (max {d1.max()*1000:.1f} ms)')
x, sr = sf.read(WAV); x = x.mean(1) if x.ndim > 1 else x
# onset strength: half-wave rectified difference of log-energy in 2.5 ms hops, high-passed 150 Hz
b, a = ss.butter(2, 150 / (sr / 2), 'high'); y = ss.lfilter(b, a, x); hop = int(sr * .0025)
E = np.log1p(1e3 * np.sqrt(np.convolve(y[:len(y)//hop*hop].reshape(-1, hop).__pow__(2).mean(1), np.ones(4) / 4, 'same')))
fl = np.maximum(np.diff(E, prepend=E[0]), 0); fl = np.convolve(fl, np.ones(3) / 3, 'same')
pk, _ = ss.find_peaks(fl, height=fl.mean() + 1.2 * fl.std(), distance=int(.03 / .0025)); on = pk * .0025
d2 = np.array([np.abs(on - e['t']).min() for e in ev])
print(f'2) audio onsets found: {len(on)}; event→nearest audio onset: median {np.median(d2)*1000:.1f} ms, within 1 frame (33 ms): {(d2 <= fr).sum()}/{len(ev)}, within 2 ms-hops of 15 ms: {(d2 <= .015).sum()}/{len(ev)}')
bad = [(e['name'], e['t'], round(float(v) * 1000)) for e, v in zip(ev, d2) if v > fr]
print('   events without an onset within 33 ms:', bad[:20])
q = np.array([e['t'] for e in ev]); on_grid = np.abs(q / .25 - np.round(q / .25)) < 1e-6
dd = np.array([np.abs(drum - t).min() for t in q])
print(f'3) events on the 1/8-beat grid (0.25 s): {on_grid.sum()}/{len(ev)}; events with a drum hit at that exact time: {(dd<1e-3).sum()}/{len(ev)}; within 1 beat-subdivision (0.25 s): {(dd<=.25).sum()}/{len(ev)}')
mk = [(e['name'], e['t']) for e, v in zip(ev, dd) if v > .25]; print('   events > 0.25 s from any drum hit:', mk[:20])
# 4) local contrast: energy (>800 Hz) in the 40 ms after the event vs the 60 ms before it
b2, a2 = ss.butter(2, 800 / (sr / 2), 'high'); z = ss.lfilter(b2, a2, x)
def rms(t0, t1): s = z[int(max(0, t0) * sr):int(max(0, t1) * sr)]; return float(np.sqrt((s ** 2).mean() + 1e-12))
r = np.array([20 * np.log10(rms(e['t'], e['t'] + .04) / rms(e['t'] - .07, e['t'] - .01)) for e in ev])
print(f'4) attack contrast at event time (>800 Hz, after/before): ≥ +3 dB for {(r >= 3).sum()}/{len(ev)} events, ≥ +1 dB for {(r >= 1).sum()}/{len(ev)}; weakest:',
      sorted([(e['name'], e['t'], round(float(v), 1)) for e, v in zip(ev, r)], key=lambda q: q[2])[:8])
import collections
g = collections.defaultdict(list)
for e, v in zip(ev, r): g[e['name']].append(v)
print('   by type (median dB):', {k: round(float(np.median(v)), 1) for k, v in sorted(g.items())})
