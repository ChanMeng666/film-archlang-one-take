#!/usr/bin/env python3
"""still.py t1,t2,... [--w 1280 --h 720] [--out DIR]  → DIR/s_<t>.png  (default DIR = dist/stills; one browser, SwiftShader)
Grabs un-blurred stills straight from the html (pure function of time), handy for checking a camera or a layout."""
import asyncio, sys, base64, time, os
from playwright.async_api import async_playwright
from common import ROOT, HTML, launch
ts = [float(x) for x in sys.argv[1].split(',')]
W = int(sys.argv[sys.argv.index('--w') + 1]) if '--w' in sys.argv else 1280
H = int(sys.argv[sys.argv.index('--h') + 1]) if '--h' in sys.argv else 720
out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else str(ROOT / 'dist' / 'stills'); os.makedirs(out, exist_ok=True)
async def main():
    async with async_playwright() as p:
        br = await launch(p)
        pg = await (await br.new_context(viewport={'width': W, 'height': H})).new_page()
        pg.on('console', lambda m: print('console:', m.text[:300]) if m.type == 'error' else None); pg.on('pageerror', lambda e: print('PAGEERROR', str(e)[:500]))
        await pg.goto(f'{HTML.as_uri()}?render&w={W}&h={H}'); await pg.evaluate('window.__ready')
        for t in ts:
            t0 = time.time(); d = await pg.evaluate(f'window.__grab({t})'); open(f'{out}/s_{t:05.2f}.png', 'wb').write(base64.b64decode(d.split(',')[1])); print(t, f'{time.time()-t0:.2f}s')
        await br.close()
asyncio.run(main())
