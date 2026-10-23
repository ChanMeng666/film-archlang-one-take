#!/usr/bin/env python3
"""dump_events.py — read the animation event list (EVENTS, K) out of the built html and write data/events.json.
The score (audio/score.py) and the sync check (verify_sync.py) both read this file, so picture and sound share one timetable."""
import asyncio, json
from playwright.async_api import async_playwright
from common import ROOT, HTML, launch
async def main():
    async with async_playwright() as p:
        br = await launch(p)
        pg = await (await br.new_context(viewport={'width': 640, 'height': 360})).new_page()
        await pg.goto(f'{HTML.as_uri()}?render&w=640&h=360'); await pg.evaluate('window.__ready')
        ev = await pg.evaluate('window.__events()'); meta = await pg.evaluate('window.__meta'); K = await pg.evaluate('window.__K')
        out = ROOT / 'data' / 'events.json'
        json.dump({'meta': meta, 'events': ev, 'K': K}, open(out, 'w'), indent=1); print(len(ev), 'events', meta, '→', out)
        await br.close()
asyncio.run(main())
