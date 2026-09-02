#!/usr/bin/env python3
"""Generate the PWA PNG icon set from public/logo.svg (Tier-4 M2).

Outputs (all opaque except purpose=any set, which keeps the logo's own
rounded-square look):
  public/icons/icon-192.png          purpose=any
  public/icons/icon-512.png          purpose=any
  public/icons/icon-maskable-192.png purpose=maskable (logo at 80% on theme bg)
  public/icons/icon-maskable-512.png purpose=maskable
  public/apple-touch-icon.png        180x180 for iOS home screen

Sanity check: the Z-mark is white (#FFFFFF) on a #2D2D2D square — the script
fails loudly if a render comes out blank so a broken icon never ships.
"""
import io
import sys

import cairosvg
from PIL import Image

SRC = "public/logo.svg"
THEME_BG = (10, 10, 15, 255)      # #0a0a0f — manifest theme_color
LOGO_BG = (45, 45, 45, 255)       # #2D2D2D — the logo's own square


def render_logo(size: int) -> Image.Image:
    """Rasterize logo.svg at a square size (static frame; animation ignored)."""
    png = cairosvg.svg2png(url=SRC, output_width=size, output_height=size)
    return Image.open(io.BytesIO(png)).convert("RGBA")


def assert_rendered(img: Image.Image, name: str) -> None:
    """Fail loudly if the raster is empty (cairosvg CSS regression guard)."""
    px = img.getdata()
    bg = sum(1 for p in px if abs(p[0] - LOGO_BG[0]) < 12 and abs(p[1] - LOGO_BG[1]) < 12)
    white = sum(1 for p in px if p[0] > 220 and p[1] > 220 and p[2] > 220)
    total = img.width * img.height
    if bg < total * 0.3 or white < total * 0.01:
        sys.exit(
            f"FAIL {name}: bg={bg / total:.2f} white={white / total:.4f} — "
            "logo.svg rasterized blank; check cairosvg CSS support"
        )


def full_bleed(size: int, logo_frac: float) -> Image.Image:
    """Solid theme-color canvas with the logo centered at logo_frac of size."""
    canvas = Image.new("RGBA", (size, size), THEME_BG)
    logo = render_logo(int(size * logo_frac))
    off = (size - logo.width) // 2
    canvas.alpha_composite(logo, (off, off))
    return canvas


def main() -> None:
    # purpose=any — the logo fills the frame; transparent corners are fine
    # because "any" icons are shown as-is (rounded by nothing).
    for size in (192, 512):
        img = render_logo(size)
        assert_rendered(img, f"icon-{size}")
        img.save(f"public/icons/icon-{size}.png")
        print(f"ok public/icons/icon-{size}.png")

    # purpose=maskable — full-bleed background + content inside the 80% safe
    # zone. The logo's Z-mark peaks at ~81% of the logo half-size, so an 80%
    # composite keeps every mark pixel inside the maskable circle.
    for size in (192, 512):
        full_bleed(size, 0.80).save(f"public/icons/icon-maskable-{size}.png")
        print(f"ok public/icons/icon-maskable-{size}.png")

    # apple-touch-icon — iOS masks to its own rounded rect; opaque bg required.
    full_bleed(180, 0.88).save("public/apple-touch-icon.png")
    print("ok public/apple-touch-icon.png")


if __name__ == "__main__":
    main()
