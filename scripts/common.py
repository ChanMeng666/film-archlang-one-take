"""Shared paths and browser launch options for the scripts in this folder."""
import os, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]          # repository root
DIST = ROOT / 'dist'                                         # build outputs (git-ignored)
HTML = DIST / 'archlang-promo.html'
DIST.mkdir(exist_ok=True)

# Software WebGL (SwiftShader) so the render needs no GPU.
CHROME_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--no-sandbox']


async def launch(p):
    """Launch Chromium. Default: the installed Google Chrome channel. Set ARCHLANG_PROMO_CHANNEL=chromium
    to use Playwright's bundled Chromium instead (`playwright install chromium`)."""
    ch = os.environ.get('ARCHLANG_PROMO_CHANNEL', 'chrome')
    if ch in ('', 'chromium'):
        return await p.chromium.launch(args=CHROME_ARGS)
    return await p.chromium.launch(channel=ch, args=CHROME_ARGS)
