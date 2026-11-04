#!/usr/bin/env python3
"""Makes the flyer QR code (print PNG + SVG) for The Anxious Patient Experience.

Usage (from the repo folder):
    python3 -m pip install --user segno
    python3 qr/make-qr.py "https://YOUR-DOMAIN/?utm_source=flyer&utm_medium=qr&utm_campaign=ape_launch"

Writes qr/ape-flyer-qr.png (print-ready, about 2100 px) and qr/ape-flyer-qr.svg.
Navy on white, error correction H (still scans if part of it is covered or creased).
"""
import os
import sys
import segno

DEFAULT = 'https://the-anxious-patient-experience.vercel.app/?utm_source=flyer&utm_medium=qr&utm_campaign=ape_launch'
url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
here = os.path.dirname(os.path.abspath(__file__))
qr = segno.make(url, error='h', micro=False)
size = qr.symbol_size(border=4)[0]
scale = max(1, -(-2000 // size))  # at least 2000 px wide
qr.save(os.path.join(here, 'ape-flyer-qr.png'), scale=scale, border=4, dark='#284858', light='#FFFFFF')
qr.save(os.path.join(here, 'ape-flyer-qr.svg'), scale=10, border=4, dark='#284858', light='#FFFFFF', title='The Anxious Patient Experience: flyer QR code')
print(f'QR code for {url}\nversion {qr.version}, error correction {qr.error}, {size * scale} px PNG, plus SVG, in {here}')
