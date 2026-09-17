#!/usr/bin/env python3
"""Rasterises icons/icon.svg into icons/icon{16,32,48,128}.png.

icon.svg is the source of truth; the PNGs are build output that happens to be
committed, because the Chrome Web Store wants PNGs and the manifest points at
them. Edit the SVG and run this.

No rasteriser is installed here (no rsvg-convert, no ImageMagick, no Pillow),
so it uses headless Chrome - the same renderer that will draw the icon in the
toolbar, which is the one whose opinion counts.

  python3 tools/rasterize.py
"""
import os, shutil, subprocess, sys, tempfile, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZES = (16, 32, 48, 128)
CHROMES = (
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    shutil.which('google-chrome') or '',
    shutil.which('chromium') or '',
)

PAGE = """<!doctype html><meta charset="utf-8">
<style>html,body{{margin:0;padding:0;background:transparent;overflow:hidden}}img{{display:block}}</style>
<img src="{src}" width="{n}" height="{n}">
"""


def chrome():
    for c in CHROMES:
        if c and os.path.exists(c):
            return c
    sys.exit('no Chrome or Chromium found; install one or rasterise icons/icon.svg by hand')


def main():
    svg = os.path.join(ROOT, 'icons', 'icon.svg')
    if not os.path.exists(svg):
        sys.exit(f'missing {svg}')
    src = 'file://' + urllib.parse.quote(svg)
    exe = chrome()
    with tempfile.TemporaryDirectory() as tmp:
        for n in SIZES:
            page = os.path.join(tmp, f'{n}.html')
            open(page, 'w').write(PAGE.format(src=src, n=n))
            out = os.path.join(ROOT, 'icons', f'icon{n}.png')
            subprocess.run([
                exe, '--headless', '--disable-gpu', '--hide-scrollbars',
                '--no-first-run', '--no-default-browser-check',
                '--force-device-scale-factor=1', '--virtual-time-budget=1500',
                '--default-background-color=00000000',
                f'--screenshot={out}', f'--window-size={n},{n}',
                page,
            ], check=True, capture_output=True, timeout=60)
            # A screenshot of a page that failed to load is a valid, empty PNG,
            # so the size is checked rather than trusted.
            if os.path.getsize(out) < 120:
                sys.exit(f'{out} came out empty - did icon.svg fail to parse?')
            print(out)


if __name__ == '__main__':
    main()
