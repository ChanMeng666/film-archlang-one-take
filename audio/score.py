#!/usr/bin/env python3
"""archlang promo — the score. Reads data/events.json (dumped from the page's __events()) and mixes real-instrument samples
(see CREDITS.md) on the 120 BPM grid into dist/soundtrack.wav. Fixed seed → byte-identical output.
   python3 audio/score.py [--stems]"""
import json, os, sys, pathlib, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
import samplers as S
import pyloudnorm as pyln

REPO = pathlib.Path(__file__).resolve().parents[1]; OUTDIR = REPO / 'dist'; OUTDIR.mkdir(exist_ok=True)
SR = S.SR; BPM = 120; BEAT = 60 / BPM; DUR = 32.0
EV = json.load(open(str(REPO / 'data' / 'events.json')))['events']
N = int((DUR + 3) * SR)
rng = np.random.default_rng(20261023)
TR = {k: np.zeros((N, 2), np.float32) for k in ('kick', 'drums', 'bass', 'keys', 'strings', 'bells', 'sfx')}
LOG = []

def db(x): return 10 ** (x / 20)
def put(trk, x, t, gain=0.0, pan=0.0, hold=None, rel=.25, name=''):
    """place sample x (normalised to peak 1) at time t seconds. hold = seconds before a release fade-out."""
    x = x / max(float(np.abs(x).max()), 1e-6)
    if hold is not None:
        n = int(hold * SR); r = int(rel * SR); x = x[:n + r].copy()
        if len(x) > n: x[n:n + r] *= np.linspace(1, 0, min(r, len(x) - n))[:, None]
    th = (pan + 1) * np.pi / 4; x = x * np.array([np.cos(th), np.sin(th)], np.float32) * np.sqrt(2) * db(gain)
    i = int(round(t * SR)); e = min(N, i + len(x))
    if i < 0 or i >= N: return
    TR[trk][i:e] += x[:e - i]
    LOG.append((t, trk, name))

# ── harmony: Am F C G, one chord per 2 s bar; bar 15–16 land on C ──
PROG = ['Am', 'F', 'C', 'G']
CH = {'Am': [45, 52, 57, 60, 64], 'F': [41, 48, 53, 57, 60], 'C': [48, 55, 60, 64, 67], 'G': [43, 50, 55, 59, 62]}
ROOT = {'Am': 33, 'F': 29, 'C': 36, 'G': 31}
def chord_at(t):
    bar = int(t // 2) + 1
    if bar >= 15: return 'C'
    return PROG[(bar - 1) % 4]
def bars(a, b): return [(k, 2.0 * (k - 1)) for k in range(a, b + 1)]
def tones(ch, octave=0): return [m + 12 * octave for m in CH[ch]]

# ── drums ──
def hits(trk, fn, times, vels, gain, pan=0.0, name=''):
    for t, v in zip(times, vels): put(trk, fn(v), t, gain + (v - .6) * 6, pan, name=name)
def groove(t0, bars_n, section):
    for b in range(bars_n):
        s = t0 + 2.0 * b
        for beat in (0, 2): put('kick', S.kick(.9 if beat == 0 else .75), s + beat * BEAT, -4, 0, name='kick')
        if section == 'B': put('kick', S.kick(.6), s + 3.5 * BEAT, -9, 0, name='kick')
        for beat in (1, 3): put('drums', S.snare(.8), s + beat * BEAT, -6, 0.05, name='snare')
        for h in range(8):
            if section == 'B' and h == 7: put('drums', S.hat_open(.55), s + h * .25 * 2 * .5 + 0, -16, .25, name='hat_open'); continue
            put('drums', S.hat(.35 + .25 * (h % 2 == 0)), s + h * BEAT / 2, -15 - (0 if h % 2 == 0 else 3), .25, name='hat')
def roll(t0, t1, step, v0, v1, fn, gain):
    n = int(round((t1 - t0) / step)); 
    for i in range(n): put('drums', fn(v0 + (v1 - v0) * i / max(n - 1, 1)), t0 + i * step, gain + 6 * (i / n), 0.0, name='roll')
def rev(x, sec):
    n = int(sec * SR); y = x[:n * 2][::-1][-n:].copy(); y *= np.linspace(0, 1, len(y))[:, None] ** 2; return y

# bars 3-6: groove A (4–12 s); fill; bar 7 breath; roll → lift at 14; groove B 14–22; fill; bar 12 breath; build 24–28
groove(4.0, 4, 'A')
for i, (tt, f) in enumerate([(11.5, lambda: S.tom(15, .7)), (11.625, lambda: S.tom(15, .8)), (11.75, lambda: S.tom(18, .85)), (11.875, lambda: S.tom(22, .9))]): put('drums', f(), tt, -7, [-.3, -.1, .1, .3][i], name='fill')
roll(13.0, 14.0, .125, .3, .8, S.snare, -11)
groove(14.0, 4, 'B')
for i, (tt, f) in enumerate([(21.5, lambda: S.tom(15, .7)), (21.625, lambda: S.tom(15, .8)), (21.75, lambda: S.tom(18, .85)), (21.875, lambda: S.tom(22, .9))]): put('drums', f(), tt, -7, [-.3, -.1, .1, .3][i], name='fill')
for beat in range(8): put('kick', S.kick(.5 + .045 * beat), 24.0 + beat * BEAT * 1.0, -5, 0, name='kick')       # 24–28: four on the floor, growing
for b in (25, 27): pass
for t in (24.0 + 1.0, 24.0 + 3.0): put('drums', S.snare(.7), t, -7, 0, name='snare')
for h in range(16): put('drums', S.hat(.4 + .02 * h), 24.0 + h * .25, -17 + .3 * h, .25, name='hat')
roll(26.0, 28.0, .125, .3, .9, S.snare, -13)
put('sfx', rev(S.crash(.9), 1.9), 28.0 - 1.9, -8, 0, name='rev_crash')
# 28 logo
put('drums', S.crash(1.0), 28.0, -4, 0, name='crash'); put('kick', S.kick(1.0), 28.0, -2, 0, name='kick')
put('kick', S.kick(.7), 29.0, -7, 0, name='kick'); put('kick', S.kick(.6), 30.0, -9, 0, name='kick')
for tt in (28.5, 29.5): put('drums', S.snare(.55), tt, -10, .05, name='snare')
for h in range(8): put('drums', S.hat(.3), 28.0 + h * BEAT / 2, -19, .25, name='hat')

# ── bass (upright, pizzicato) ──
for (a, b) in ((3, 6), (8, 11), (13, 15)):
    for k, s in bars(a, b):
        ch = chord_at(s); r = ROOT[ch]
        for beat, note in ((0, r), (1.5, r + 12), (2, r), (3.5, r + 7)): put('bass', S.BASS.note(note, .8), s + beat * BEAT, -6 if beat == 0 else -9, 0, hold=0.4, rel=.2, name='bass')
put('bass', S.BASS.note(31, .9), 14.0, -3, 0, hold=1.2, name='bass_lift'); put('bass', S.BASS.note(36, .9), 28.0, -3, 0, hold=1.5, name='bass_logo')
put('bass', S.BASS.note(31, .7), 23.0, -5, 0, hold=1.0, name='bass_roof')

# ── piano ──
def arp(s, ch, vel, gain, steps=8, pat=(0, 2, 4, 2, 3, 2, 4, 2), oct_=0):
    tt = tones(ch, oct_)
    for i in range(steps):
        put('keys', S.PIANO.note(tt[pat[i % len(pat)]], vel + (.1 if i % 4 == 0 else 0)), s + i * BEAT / 2, gain + (2 if i % 4 == 0 else 0), (-.2 + .4 * (i / steps)), hold=.5, rel=.5, name='piano')
put('keys', S.PIANO.note(45, .35), 0.0, -6, -.2, hold=3, rel=1.5, name='piano'); put('keys', S.PIANO.note(52, .3), 0.0, -9, -.1, hold=3, rel=1.5, name='piano')
for k, s in bars(1, 2):
    ch = chord_at(s)
    for i, idx in enumerate((2, 3, 4, 3)): 
        if k == 1 and i < 2: continue
        put('keys', S.PIANO.note(tones(ch)[idx] + 12, .3), s + i * BEAT, -10, .1 * i - .1, hold=.9, rel=1.0, name='piano')
for k, s in bars(3, 6): arp(s, chord_at(s), .45, -11)
tt = tones('C'); [put('keys', S.PIANO.note(m, .3), 12.0, -9, 0, hold=1.9, rel=1.0, name='piano') for m in tt]
for k, s in bars(8, 11): arp(s, chord_at(s), .6, -9, oct_=0)
for i, (m) in enumerate([67, 64, 60, 64]): put('keys', S.PIANO.note(m + 12, .3), 22.0 + i * .5, -12, .2 - .1 * i, hold=.8, rel=1.2, name='piano')
for i in range(4): put('keys', S.PIANO.note(chord_at(22.5) == 'G' and 55 + [0, 4, 7, 12][i] or 60, .25), 23.0 + i * .5, -13, 0, hold=.8, rel=1.2, name='piano')
for k, s in bars(13, 14): arp(s, chord_at(s), .5 + .08 * (k - 13), -9, oct_=0)
for m in [43, 50, 55, 59, 62]: put('keys', S.PIANO.note(m, .95), 14.0, -4, 0, hold=1.8, rel=1.5, name='piano_lift')
for m in [36, 48, 55, 60, 64, 67, 72]: put('keys', S.PIANO.note(m, .95), 28.0, -3.5, 0, hold=3.0, rel=2.5, name='piano_logo')
for i, s in enumerate((29.0, 29.25, 29.5)): put('keys', S.PIANO.note([76, 79, 84][i], .75), s, -7, [-.25, 0, .25][i], hold=.7, rel=1.5, name='piano_slogan')
for i, m in enumerate([60, 64, 67, 72, 67, 64, 60, 55]): put('keys', S.PIANO.note(m, .3 - .01 * i), 30.0 + i * .5, -13 - .6 * i, -.3 + .08 * i, hold=.8, rel=1.5, name='piano_tail')

# ── cello pads ──
for k, s in bars(2, 15):
    ch = chord_at(s)
    if k in (2, 7, 12, 13, 14, 15) or (3 <= k <= 6) or (8 <= k <= 11):
        v = .3 if k in (2, 7, 12) else (.45 if k < 12 else .65)
        put('strings', S.CELLO.note(CH[ch][0] + (12 if ch in ('F', 'G') and False else 0), v), s, -9 + (3 if k >= 13 else 0), -.2, hold=1.85, rel=.5, name='cello')
        put('strings', S.CELLO.note(CH[ch][1] + 12, v), s, -13, .2, hold=1.85, rel=.5, name='cello5')
put('strings', S.CELLO.note(36, .9), 28.0, -4, 0, hold=3.5, rel=1.5, name='cello_logo'); put('strings', S.CELLO.note(48, .8), 28.0, -8, .2, hold=3.5, rel=1.5, name='cello_logo')
put('strings', S.CELLO.note(48, .5), 30.0, -9, 0, hold=1.6, rel=.4, name='cello_tail')

# ── sfx and bells from the picture's own event table ──
def ch_t(t, i=0, octave=1): c = tones(chord_at(t), octave); return c[i % len(c)]
rr = np.random.default_rng(7)
for e in EV:
    n, t = e['name'], e['t']
    if n == 'type':
        ln = e['len'] * BEAT; k = max(3, int(e['chars'] * .3)); st = t - ln
        for i in range(k):
            tk = st + ln * (i / max(k - 1, 1)); last = i == k - 1
            f = S.tickrc if i % 2 == 0 else S.ticksc
            put('sfx', f(.3 + .4 * rr.random()), tk, (-13 if last else -19) - 2 * rr.random(), float(rr.uniform(-.3, .3)), hold=.15, rel=.05, name='type')
    elif n == 'grid':
        for i, m in enumerate((84, 88, 91)): put('bells', S.GLOCK.note(m, .5), t + i * .07, -17, -.2 + .2 * i, hold=1.5, rel=1.5, name='grid')
    elif n == 'north': put('bells', S.GLOCK.note(91, .5), t, -18, .3, hold=1.2, rel=1.5, name='north')
    elif n == 'wall':
        put('sfx', S.claves(.7), t, -9, float(np.interp(t, [4, 6.5], [-.4, .4])), hold=.5, rel=.2, name='wall')
        put('bells', S.VIBES.note(ch_t(t, 2, 1) + 12, .5), t, -20, 0, hold=1, rel=1, name='wall_vib')
    elif n == 'room':
        i = ['r_live', 'r_bath', 'r_bed'].index(e['id']); put('bells', S.GLOCK.note(79 + [0, 4, 7][i] - (0), .55), t, -14, [-.3, 0, .3][i], hold=1.6, rel=1.5, name='room')
    elif n == 'door':
        i = ['d_front', 'd_garden', 'd_bed', 'd_bath'].index(e['id']); put('sfx', S.snap(.7), t, -9, [-.4, -.1, .15, .4][i], hold=.4, rel=.2, name='door')
        put('bells', S.GLOCK.note([81, 84, 88, 93][i], .5), t, -16, [-.4, -.1, .15, .4][i], hold=1.2, rel=1.4, name='door_gl')
    elif n == 'window':
        i = ['win_west', 'win_garden1', 'win_garden2', 'win_east'].index(e['id']); put('sfx', S.ridebell(.4), t, -20, [-.4, -.1, .15, .4][i], hold=.6, rel=.4, name='window')
        put('bells', S.VIBES.note([76, 72, 69, 76][i], .6), t, -13, [-.4, -.1, .15, .4][i], hold=1.2, rel=1.2, name='window_vib')
    elif n == 'furn2d':
        i = [f[0] for f in json.load(open(str(REPO / 'data' / 'events.json')))['K']['furn']].index(e['id'])
        m = [65, 69, 72, 77, 72, 69, 72, 76, 77, 81, 84, 81][i]; put('bells', S.VIBES.note(m, .6 + .02 * i), t, -11, -.5 + i * .09, hold=1.2, rel=1.2, name='furn2d')
    elif n == 'title': put('sfx', S.claves(.5), t, -12, 0, hold=.4, rel=.2, name='title')
    elif n == 'result':
        for i, m in enumerate((96, 91)): put('bells', S.GLOCK.note(m, .6), t + i * .09, -12, .0, hold=2.0, rel=1.5, name='result')
    elif n == 'dims':
        put('sfx', rev(S.crash(.8), 1.5), 14.0 - 1.5, -11, 0, name='rev_dims')
        for i in range(8): put('bells', S.GLOCK.note([84, 88, 91, 96][i % 4] + (0 if i < 4 else 0), .4), t + .05 + i * .16, -18 + i * .5, -.4 + i * .11, hold=.8, rel=1, name='dims_sparkle')
    elif n == 'rise':
        i = ['w_lane', 'w_east', 'w_garden', 'w_west', 'w_hall', 'w_bath'].index(e['id']); put('sfx', S.tom(22, .6 + .05 * i), t, -9, [-.5, .5, 0, -.3, .1, .3][i], hold=.8, rel=.4, name='rise')
    elif n == 'lift':
        put('drums', S.crash(1.0), t, -4, 0, name='crash_lift'); put('kick', S.kick(1.0), t, -1, 0, name='kick_lift')
    elif n == 'furn3d':
        i = [f[0] for f in json.load(open(str(REPO / 'data' / 'events.json')))['K']['furn3d']].index(e['id'])
        put('bells', S.VIBES.note(ch_t(t, i, 2), .5), t, -17, -.6 + i * .11, hold=.8, rel=.8, name='furn3d')
        if i % 3 == 0: put('sfx', S.claves(.4), t, -15, -.6 + i * .11, hold=.3, rel=.1, name='furn3d_cl')
    elif n == 'door_open': put('sfx', S.chik(.6), t, -9, -.2 if e['id'] == 'd_front' else .3, hold=.5, rel=.2, name='door_open')
    elif n == 'slide': put('sfx', S.hat_open(.5), t, -12, .0, hold=.9, rel=.4, name='slide')
    elif n == 'whoosh_up':
        put('sfx', rev(S.crash(.8), 1.6), 21.8 - 1.6, -9, 0, name='whoosh_up'); put('bells', S.GLOCK.note(96, .6), 21.8, -14, 0, hold=1.5, rel=1.5, name='whoosh_up_gl')
    elif n == 'roof_start': put('bells', S.VIBES.note(60, .4), t, -18, 0, hold=2.0, rel=1.0, name='roof_start')
    elif n == 'roof_land':
        put('sfx', S.tom(22, .95), t, -3, 0, hold=1.2, rel=.5, name='roof_land'); put('sfx', S.claves(.9), t, -8, 0, hold=.4, rel=.2, name='roof_land_cl'); put('kick', S.kick(.9), t, -6, 0, name='kick_roof')
    elif n == 'roof_off': put('drums', S.crash(.8), t, -7, 0, name='crash_off')
    elif n == 'collapse':
        i = e['id']; put('sfx', S.tom([15, 18, 22, 15, 18, 22][i], .8), t, -6, [-.4, .4, 0, -.2, .2, 0][i], hold=.7, rel=.4, name='collapse')
    elif n == 'letters':
        for i, m in enumerate((72, 76, 79, 84)): put('bells', S.VIBES.note(m, .65), t + i * .075, -12, -.3 + .2 * i, hold=1.2, rel=1.5, name='letters')
    elif n == 'logo': put('bells', S.GLOCK.note(96, .8), t, -12, 0, hold=3, rel=2, name='logo_gl')
    elif n == 'sub': put('bells', S.GLOCK.note(91, .5), t, -17, 0, hold=1.5, rel=1.5, name='sub')
    elif n == 'chips':
        for i, m in enumerate((84, 88, 91, 96)): put('bells', S.GLOCK.note(m, .4), t + i * .12, -20, -.3 + .2 * i, hold=.6, rel=1.0, name='chips')

# ── room: plate-style reverb tail from the shaped-noise impulse response (processing only) ──
def make_ir(rt=1.7, pre=.02, seed=3):
    r = np.random.default_rng(seed); n = int(rt * 1.4 * SR); t = np.arange(n) / SR
    ir = r.standard_normal((n, 2)).astype(np.float32) * np.exp(-6.9 * t / rt)[:, None]
    lp = butter(2, 5500, 'low', fs=SR, output='sos'); ir = sosfilt(lp, ir, axis=0)
    ir[:int(pre * SR)] = 0; ir *= (1 - np.exp(-t * 90))[:, None]; return (ir / np.sqrt((ir ** 2).sum())).astype(np.float32)
IR = make_ir()
def reverb(x): return np.stack([fftconvolve(x[:, c], IR[:, c])[:N] for c in range(2)], 1).astype(np.float32)

# sidechain: music ducks under the kick
def env_follow(x, att=.004, rel=.2):
    a = np.abs(x).max(1); out = np.zeros_like(a); ca, cr = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR)); e = 0.0
    # block-wise envelope (fast enough in numpy via 1-pole on decimated signal)
    d = 48; ad = a[:len(a) // d * d].reshape(-1, d).max(1); od = np.zeros_like(ad); ca, cr = np.exp(-1 / (att * SR / d)), np.exp(-1 / (rel * SR / d))
    for i, v in enumerate(ad): e = v + (e - v) * (ca if v < e else cr) if False else (v if v > e else e * cr); od[i] = e
    return np.interp(np.arange(len(a)), np.arange(len(od)) * d + d / 2, od)
ke = env_follow(TR['kick']); ke = np.clip(ke / max(ke.max(), 1e-6), 0, 1)
duck = (1 - .42 * ke ** .7)[:, None].astype(np.float32)

SEND = {'keys': .30, 'strings': .35, 'bells': .45, 'drums': .10, 'sfx': .18, 'bass': .0, 'kick': .03}
LVL = {'kick': 6, 'drums': 5, 'bass': 2, 'keys': -3, 'strings': -4, 'bells': 5, 'sfx': 3}
mix = np.zeros((N, 2), np.float32); wet = np.zeros((N, 2), np.float32)
for k, x in TR.items():
    y = x * db(LVL[k]) * (duck if k in ('keys', 'strings', 'bass', 'bells') else 1)
    mix += y; 
    if SEND[k] > 0: wet += y * SEND[k]
mix += reverb(wet)
# master: high-pass, loudness −16 LUFS, look-ahead limiter at −1.5 dBFS
sos = butter(2, 28, 'high', fs=SR, output='sos'); mix = sosfilt(sos, mix, axis=0).astype(np.float32)
mix = mix[:int(DUR * SR)]
fade = np.ones(len(mix), np.float32); f0 = int(31.0 * SR); fade[f0:] = np.linspace(1, 0, len(mix) - f0) ** 1.5; mix *= fade[:, None]
meter = pyln.Meter(SR); lu = meter.integrated_loudness(mix); mix = pyln.normalize.loudness(mix, lu, -16.0).astype(np.float32)
def limiter(x, ceil=db(-1.5), look=int(.005 * SR), rel=.08):
    pk = np.abs(x).max(1); need = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=look * 2 + 1, mode='nearest')
    r = np.exp(-1 / (rel * SR)); out = np.empty_like(g); c = 1.0
    for i in range(len(g)):                      # instant attack (already looked ahead), smooth release
        c = g[i] if g[i] < c else g[i] + (c - g[i]) * r; out[i] = c
    k = int(.003 * SR); out = np.convolve(out, np.ones(k) / k, mode='same')
    return x * out[:, None]
mix = limiter(mix)
sf.write(str(OUTDIR / 'soundtrack.wav'), mix, SR, subtype='PCM_24')
print('peak dBFS', 20 * np.log10(np.abs(mix).max()), 'LUFS', meter.integrated_loudness(mix))
json.dump([(round(t, 4), k, n) for t, k, n in sorted(LOG)], open(str(REPO / 'audio' / 'mix_log.json'), 'w'))
if '--stems' in sys.argv:   # optional: per-stem wavs for inspection
  for k in ('kick', 'drums', 'bass', 'keys', 'strings', 'bells', 'sfx'): sf.write(str(OUTDIR / f'stem_{k}.wav'), (TR[k][:int(DUR * SR)] * db(-10)).astype(np.float32), SR)
