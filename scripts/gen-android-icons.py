#!/usr/bin/env python3
"""Generate branded Android launcher icons + splash screens from public/logo.svg
(T5 follow-up: replace the stock Capacitor template art with Venom Arena brand).

Outputs (exact dimensions read from the existing template files):
  android/.../mipmap-*/ic_launcher.png           legacy square (logo render)
  android/.../mipmap-*/ic_launcher_round.png     circular crop
  android/.../mipmap-*/ic_launcher_foreground.png transparent + mark (safe zone)
  android/.../drawable*/splash.png               theme bg + white mark

Also flips values/ic_launcher_background.xml from template #FFFFFF to the
logo square color #2D2D2D so the adaptive background matches the brand.
Sanity: fails loudly if any render comes out blank (cairosvg CSS guard).
"""
import glob
import io
import os
import re
import sys

import cairosvg
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
RES = "android/app/src/main/res"
SRC = "public/logo.svg"

DARK_BG = (10, 10, 15, 255)     # #0a0a0f — splash background
SQUARE_BG = (45, 45, 45, 255)   # #2D2D2D — logo square / adaptive background
WHITE = (255, 255, 255, 255)

# Cache one high-res logo render + a white-mark sprite for reuse
_logo_hi = cairosvg.svg2png(url=SRC, output_width=600, output_height=600)
LOGO_HI = Image.open(io.BytesIO(_logo_hi)).convert("RGBA")

# White Z-mark sprite: keep near-white pixels, everything else transparent
mask = LOGO_HI.copy()
px = mask.load()
for y in range(mask.height):
    for x in range(mask.width):
        r, g, b, a = px[x, y]
        if r > 180 and g > 180 and b > 180:
            px[x, y] = WHITE
        else:
            px[x, y] = (0, 0, 0, 0)
# Crop to the mark's bounding box for clean centering
MARK = mask.crop(mask.getbbox())

# Z-only sprite for adaptive foregrounds: the outline square's corners sit at
# ~1.16x the logo half-size from center — too wide for the maskable safe
# circle at any bold scale. The bare Z peaks at ~0.81x half-size, so it can
# fill the safe zone without ever getting clipped by device masks.
_z_only = mask.copy()
# Mask out the rounded-square border: it lives along the logo's outer frame
_bw = int(600 * 0.10)  # border + rounded-corner arcs reach ~9% inward; Z starts ~19%
w, h = _z_only.size
zpx = _z_only.load()
for y in range(h):
    for x in range(w):
        if x < _bw or x >= w - _bw or y < _bw or y >= h - _bw:
            zpx[x, y] = (0, 0, 0, 0)
MARK_Z = _z_only.crop(_z_only.getbbox())


def assert_nonempty(img, name, min_opaque=0.005):
    alpha = img.getchannel("A")
    opaque = sum(1 for v in alpha.getdata() if v > 40)
    if opaque < img.width * img.height * min_opaque:
        sys.exit(f"FAIL {name}: render looks blank")


def logo_render(size):
    """Full logo (dark rounded square + mark) — legacy launcher look."""
    return LOGO_HI.resize((size, size), Image.LANCZOS)


def round_icon(size):
    """Circular brand icon: dark disc + mark at ~70%."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((0, 0, size - 1, size - 1), fill=SQUARE_BG)
    mark = MARK.resize((int(size * 0.52), int(MARK.height / MARK.width * size * 0.52)), Image.LANCZOS)
    img.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    return img


def foreground(size):
    """Adaptive foreground: transparent, bare Z inside the 66% safe circle.
    Z peak radius is ~0.81 of the logo half-size, so scale 0.72 puts the peak
    at ~0.29 of the image — inside the 0.33 safe circle at any bold scale."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mark = MARK_Z.resize((int(size * 0.72), int(MARK_Z.height / MARK_Z.width * size * 0.72)), Image.LANCZOS)
    img.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    return img


def splash(w, h):
    """Splash: theme background + white mark at ~30% of the short side."""
    img = Image.new("RGBA", (w, h), DARK_BG)
    short = min(w, h)
    mw = int(short * 0.30)
    mark = MARK.resize((mw, int(MARK.height / MARK.width * mw)), Image.LANCZOS)
    img.alpha_composite(mark, ((w - mark.width) // 2, (h - mark.height) // 2))
    return img


def main():
    changed = 0
    # Launchers: derive sizes from the files already on disk
    for f in sorted(glob.glob(f"{RES}/mipmap-*/ic_launcher.png")):
        size = Image.open(f).size[0]
        logo_render(size).convert("RGBA").save(f)
        round_icon(size).save(f.replace("ic_launcher.png", "ic_launcher_round.png"))
        assert_nonempty(logo_render(size), f)
        changed += 1
    for f in sorted(glob.glob(f"{RES}/mipmap-*/ic_launcher_foreground.png")):
        size = Image.open(f).size[0]
        fg = foreground(size)
        assert_nonempty(fg, f)
        fg.save(f)
        changed += 1
    for f in sorted(glob.glob(f"{RES}/drawable*/splash.png")):
        w, h = Image.open(f).size
        sp = splash(w, h)
        assert_nonempty(sp, f)
        sp.save(f)
        changed += 1

    # Adaptive background color: template white -> brand square color
    color_file = f"{RES}/values/ic_launcher_background.xml"
    xml = open(color_file).read()
    xml_new = re.sub(r">#([0-9A-Fa-f]{6})<", ">#2D2D2D<", xml)
    if xml_new != xml:
        open(color_file, "w").write(xml_new)
        print("ok values/ic_launcher_background.xml -> #2D2D2D")

    print(f"ok {changed} launcher/splash PNGs regenerated with brand art")


if __name__ == "__main__":
    main()
