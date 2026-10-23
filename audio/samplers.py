"""Real-instrument samplers for the archlang promo score. Every sound in the mix is a recorded sample from the libraries in CREDITS.md.
No synthesis except the reverb impulse response (processing, not an instrument) and plain DSP (pitch-resample, fades, ducking)."""
import os, re, glob, random, pathlib
from fractions import Fraction
import numpy as np, soundfile as sf
from scipy.signal import resample_poly

SR = 48000
ROOT = pathlib.Path(__file__).resolve().parents[1]
S = os.environ.get('ARCHLANG_PROMO_SAMPLES', str(ROOT / 'samples'))   # filled by scripts/fetch_samples.sh
_cache = {}
rnd = random.Random(20261023)               # fixed seed → the same round-robin picks every run

def load(path):
    if path in _cache: return _cache[path]
    x, sr = sf.read(path, dtype='float32', always_2d=True)
    if x.shape[1] == 1: x = np.repeat(x, 2, 1)
    x = x[:, :2]
    if sr != SR:
        f = Fraction(SR, sr).limit_denominator(1000); x = resample_poly(x, f.numerator, f.denominator, axis=0).astype(np.float32)
    _cache[path] = x; return x

def shift(x, semis):
    if abs(semis) < 1e-3: return x
    f = Fraction(2 ** (-semis / 12)).limit_denominator(400)
    return resample_poly(x, f.numerator, f.denominator, axis=0).astype(np.float32)

NOTE = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}
def midi_of(name):                 # 'A#2' 'Eb1' 'c3' 'gb2'
    m = re.match(r'([A-Ga-g])([#b]?)(-?\d)', name); n = NOTE[m.group(1).lower()] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0)
    return 12 * (int(m.group(3)) + 1) + n

def nearest(table, midi, maxd=4):
    k = min(table, key=lambda m: abs(m - midi)); return k, table[k]

class Bank:
    """table: {midi: [files]} per velocity bucket"""
    def __init__(self, layers): self.layers = layers          # list (soft→loud) of {midi: file}
    def note(self, midi, vel=.7, gain=1.0):
        i = min(len(self.layers) - 1, int(vel * len(self.layers))); tab = self.layers[i]
        root, f = nearest(tab, midi); x = shift(load(f), midi - root); return x * gain

def _bank_piano():
    L = {'PP': {}, 'Mp': {}, 'Mf': {}, 'FF': {}}
    for f in glob.glob(f'{S}/SplendidGrandPiano/Samples/*.flac'):
        m = re.match(r'(PP|Mp|Mf|MF|FF) ([A-G]#?\d)\.flac', os.path.basename(f))
        if m: L['Mf' if m.group(1) in ('Mf', 'MF') else m.group(1)][midi_of(m.group(2))] = f
    return Bank([L['PP'], L['Mp'], L['Mf'], L['FF']])
def _bank_cello():
    L = {}
    for f in glob.glob(f'{S}/karoryfer-bigcat.cello/Samples/sus/*_d.wav'):
        m = re.match(r'([A-G]b?\d)_(p|mp|mf|f)_d\.wav', os.path.basename(f))
        if m: L.setdefault(m.group(2), {})[midi_of(m.group(1))] = f
    return Bank([L['p'], L['mp'], L['mf'], L['f']])
def _bank_bass():
    L = {}
    for f in glob.glob(f'{S}/karoryfer.meatbass/Samples/pizz/*_vl*_rr1.wav'):
        m = re.match(r'([a-g]b?\d)_vl(\d+)_rr1\.wav', os.path.basename(f))
        if m: L.setdefault(int(m.group(2)), {})[midi_of(m.group(1))] = f
    ks = sorted(L); return Bank([L[k] for k in ks])
def _bank_glock():
    L = {'soft': {}, 'medium': {}, 'loud': {}}
    for f in glob.glob(f'{S}/VCSL/Idiophones/Struck Idiophones/Glockenspiel/glock_*.wav'):
        m = re.match(r'glock_(soft|medium|loud)_([A-G]#?\d)_\d+\.wav', os.path.basename(f)); L[m.group(1)][midi_of(m.group(2))] = f
    return Bank([L['soft'], L['medium'], L['loud']])
def _bank_vibes():
    L = {'v1': {}, 'v2': {}}
    for f in glob.glob(f'{S}/VCSL/Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/*.wav'):
        m = re.match(r'Vibes_soft_([A-G]#?\d)_(v\d)_rr\d_Main\.wav', os.path.basename(f)); L[m.group(2)][midi_of(m.group(1))] = f
    return Bank([L['v1'], L['v2']])
PIANO, CELLO, BASS, GLOCK, VIBES = _bank_piano(), _bank_cello(), _bank_bass(), _bank_glock(), _bank_vibes()

# ── Big Rusty Drums (Karoryfer, CC0): multi-mic one-shots, mixed here ──
D = f'{S}/karoryfer.big-rusty-drums/Samples'
def _pick(d, vel):
    fs = sorted(glob.glob(f'{d}/*.flac')); vls = sorted({int(re.search(r'vl(\d+)', os.path.basename(f)).group(1)) for f in fs}); v = vls[min(len(vls) - 1, int(vel * len(vls)))]
    c = [f for f in fs if int(re.search(r'vl(\d+)', os.path.basename(f)).group(1)) == v]; return c[rnd.randrange(len(c))]
def _mics(base, mics, vel):
    first = _pick(f'{base}/{mics[0][0]}', vel); tag = os.path.basename(first).replace('.flac', '')
    out = None
    for m, g in mics:
        f = f'{base}/{m}/{os.path.basename(first)}'
        if not os.path.exists(f): f = _pick(f'{base}/{m}', vel)
        x = load(f) * g
        if out is None: out = x.copy()
        else:
            n = max(len(out), len(x)); o = np.zeros((n, 2), np.float32); o[:len(out)] += out; o[:len(x)] += x; out = o
    return out
def kick(vel=.7):  return _mics(f'{D}/kick_24/kick', [('kick', 1.0), ('oh', .7), ('sn', .15)], vel)
def snare(vel=.7): return _mics(f'{D}/snare_14/center', [('top', 1.0), ('btm', .5), ('oh', .7)], vel)
def side(vel=.7):  return _mics(f'{D}/snare_14/sidestick', [('top', 1.0), ('btm', .4), ('oh', .6)], vel)
def hat(vel=.6):   return _mics(f'{D}/hihat_14/tc', [('cl', 1.0), ('oh', .8)], vel)
def hat_open(vel=.6): return _mics(f'{D}/hihat_14/open', [('cl', 1.0), ('oh', .8)], vel)
def chik(vel=.6):  return _mics(f'{D}/hihat_14/chik', [('cl', 1.0), ('oh', .8)], vel)
def crash(vel=.8): return _mics(f'{D}/crash_17/cr', [('cl', 1.0), ('oh', .9)], vel)
def tom(size=15, vel=.7): return _mics(f'{D}/tom_{size}/center', [('cl', 1.0), ('oh', .7)] + ([('sn', .2)] if size in (22, 18, 15) else []), vel)
def tickrc(vel=.5): return _mics(f'{D}/tom_15/rc', [('cl', 1.0), ('oh', .6)], vel)
def ticksc(vel=.5): return _mics(f'{D}/tom_15/sc', [('cl', 1.0), ('oh', .6)], vel)
def ridebell(vel=.5): return _mics(f'{D}/ride_22/bl', [('cl', 1.0), ('oh', .8)], vel)

# ── VCSL (CC0) claves / claps, body_percussion (CC0) snaps ──
def claves(vel=.6):
    fs = sorted(glob.glob(f'{S}/VCSL/Idiophones/Struck Idiophones/Claves/Claves1_Hit_v*_rr1_Mid.wav')); return load(fs[min(len(fs) - 1, int(vel * len(fs)))])
def snap(vel=.6):
    fs = sorted(glob.glob(f'{S}/body_percussion/Samples/body/snap_l_rr*.wav')); return load(fs[rnd.randrange(len(fs))]) * (0.5 + vel)
