# From build/icon-512.png (scripts/render-icon.js): build/icon.png (256, for the window) and
# build/icon.ico (16-256, for the installer, the taskbar and .bulletin files).
import os
from PIL import Image

BUILD = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build')
big = Image.open(os.path.join(BUILD, 'icon-512.png')).convert('RGBA')
big.resize((256, 256), Image.LANCZOS).save(os.path.join(BUILD, 'icon.png'))
sizes = [(s, s) for s in (16, 20, 24, 32, 40, 48, 64, 128, 256)]
big.save(os.path.join(BUILD, 'icon.ico'), sizes=sizes)
print('wrote build/icon.png and build/icon.ico', [s[0] for s in sizes])
