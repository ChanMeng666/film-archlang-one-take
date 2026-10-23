#!/usr/bin/env python3
"""render.py — seek the single-file composition frame by frame (Playwright + Chromium on SwiftShader), motion blur from
sub-frame averaging inside the page (a real shutter: n seeks across the open shutter, adaptive to how far things travel), then ffmpeg.
  python3 scripts/render.py --w 1920 --h 1080 --fps 30 --workers 3 --audio dist/soundtrack.wav"""
import argparse, asyncio, base64, json, os, pathlib, shutil, subprocess, time
from playwright.async_api import async_playwright
from common import ROOT, DIST, HTML, CHROME_ARGS, launch
ap = argparse.ArgumentParser()
ap.add_argument('--html', default=str(HTML)); ap.add_argument('--out', default=str(DIST / 'archlang-promo.mp4'))
ap.add_argument('--w', type=int, default=1920); ap.add_argument('--h', type=int, default=1080); ap.add_argument('--fps', type=int, default=30)
ap.add_argument('--workers', type=int, default=3); ap.add_argument('--shutter', type=float, default=180); ap.add_argument('--nmax', type=int, default=8)
ap.add_argument('--audio', default=None); ap.add_argument('--crf', type=int, default=16); ap.add_argument('--frames', default=None, help='a:b subset (debug)'); ap.add_argument('--keep', action='store_true'); ap.add_argument('--resume', action='store_true')
a = ap.parse_args()
FR = os.path.join(os.path.dirname(a.out), '_frames_' + os.path.basename(a.out).split('.')[0])
if not a.resume: shutil.rmtree(FR, ignore_errors=True)
os.makedirs(FR, exist_ok=True)
stats = {'frames': 0, 'captures': 0, 'still': 0, 'hist': {}}
async def worker(p, k, jobs, dur):
    br = await launch(p)
    pg = await (await br.new_context(viewport={'width': a.w, 'height': a.h})).new_page()
    pg.on('pageerror', lambda e: print('PAGEERROR', str(e)[:300]))
    await pg.goto(f'{pathlib.Path(a.html).resolve().as_uri()}?render&w={a.w}&h={a.h}'); await pg.evaluate('window.__ready')
    open_s = a.shutter / 360 / a.fps
    while True:
        try: f = jobs.get_nowait()
        except asyncio.QueueEmpty: break
        path = f'{FR}/{f:05d}.png'
        if a.resume and os.path.exists(path): continue
        t = f / a.fps
        info = await pg.evaluate(f'window.__nSamples({t},{open_s},{a.nmax})') if a.shutter > 0 else {'n': 1}
        n = info['n']
        d = await (pg.evaluate(f'window.__grab({t})') if n == 1 else pg.evaluate(f'window.__shutter({t},{n},{open_s})'))
        open(path, 'wb').write(base64.b64decode(d.split(',')[1]))
        stats['frames'] += 1; stats['captures'] += n; stats['still'] += (n == 1); stats['hist'][n] = stats['hist'].get(n, 0) + 1
        if stats['frames'] % 30 == 0: print(f"  {stats['frames']} frames  {time.time()-T0:.0f}s", flush=True)
    await br.close()
async def main():
    global T0
    info = {}
    N = int(round(32.0 * a.fps)); frames = list(range(N))
    if a.frames: lo, hi = map(int, a.frames.split(':')); frames = list(range(lo, hi))
    jobs = asyncio.Queue()
    for f in frames: jobs.put_nowait(f)
    T0 = time.time()
    async with async_playwright() as p:
        await asyncio.gather(*[worker(p, k, jobs, 32.0) for k in range(a.workers)])
    secs = time.time() - T0
    print(f"{len(frames)} frames, {stats['captures']} captures ({stats['still']} single-capture frames) in {secs:.0f}s on {a.workers} workers")
    cmd = ['ffmpeg', '-v', 'error', '-y', '-framerate', str(a.fps), '-i', f'{FR}/%05d.png']
    if a.audio: cmd += ['-i', a.audio]
    cmd += ['-c:v', 'libx264', '-preset', 'medium', '-crf', str(a.crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart']
    if a.audio: cmd += ['-c:a', 'aac', '-b:a', '256k', '-shortest']
    if not a.frames: subprocess.run(cmd + [a.out], check=True)
    json.dump({'w': a.w, 'h': a.h, 'fps': a.fps, 'shutter': a.shutter, 'nmax': a.nmax, 'workers': a.workers, 'frames': len(frames), 'captures': stats['captures'], 'single_capture_frames': stats['still'],
               'samples_hist': {str(k): v for k, v in sorted(stats['hist'].items())}, 'seconds': round(secs, 1)}, open(os.path.splitext(a.out)[0] + '.render.json', 'w'), indent=1)
    if not a.keep and not a.frames: shutil.rmtree(FR, ignore_errors=True)
    print('wrote', a.out if not a.frames else f'frames only (no mp4 for a --frames subset) in {FR}')
asyncio.run(main())
