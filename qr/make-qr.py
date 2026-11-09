#!/usr/bin/env python3
"""Makes the flyer QR code for The Anxious Patient Experience.

Usage (from the repo folder):
    python3 -m pip install --user segno pillow
    python3 qr/make-qr.py "https://YOUR-DOMAIN/?utm_source=flyer&utm_medium=qr&utm_campaign=ape_launch"

Writes, in deliverables/qr/ (ready to attach to an email) and qr/ (kept with the code):
    ape-flyer-qr.png        1000 x 1000 px, for email, Word, Canva and most printing
    ape-flyer-qr-print.png  about 2000 px, for large prints
    ape-flyer-qr.svg        vector, for a designer or print shop
Navy on white, error correction H (still scans if part of it is covered or creased).
"""
import os
import shutil
import sys

import segno
from PIL import Image

DEFAULT = 'https://the-anxious-patient-experience.vercel.app/?utm_source=flyer&utm_medium=qr&utm_campaign=ape_launch'
url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'deliverables', 'qr')
os.makedirs(out, exist_ok=True)
NAVY, WHITE = '#284858', '#FFFFFF'

qr = segno.make(url, error='h', micro=False)
modules = qr.symbol_size(border=4)[0]

# 1000 px exactly: whole-pixel modules (sharp edges), centred on a white square
scale = 1000 // modules
tmp = os.path.join(out, '_tmp.png')
qr.save(tmp, scale=scale, border=4, dark=NAVY, light=WHITE)
img = Image.open(tmp).convert('RGB')
canvas = Image.new('RGB', (1000, 1000), WHITE)
canvas.paste(img, ((1000 - img.width) // 2, (1000 - img.height) // 2))
canvas.save(os.path.join(out, 'ape-flyer-qr.png'), dpi=(300, 300))
os.remove(tmp)

qr.save(os.path.join(out, 'ape-flyer-qr-print.png'), scale=max(1, -(-2000 // modules)), border=4, dark=NAVY, light=WHITE)
qr.save(os.path.join(out, 'ape-flyer-qr.svg'), scale=10, border=4, dark=NAVY, light=WHITE,
        title='The Anxious Patient Experience: flyer QR code')
for f in ('ape-flyer-qr.png', 'ape-flyer-qr-print.png', 'ape-flyer-qr.svg'):
    shutil.copyfile(os.path.join(out, f), os.path.join(root, 'qr', f))
print(f'QR code for {url}\nversion {qr.version}, error correction {qr.error}, 1000 px PNG, print PNG and SVG in {out}')
