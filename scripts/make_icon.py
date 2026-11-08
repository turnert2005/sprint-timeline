"""Generate images/icon.png, the 128px Marketplace icon.

Rendered at 8x and downscaled with Lanczos so edges stay crisp.
Motif: a timeline of four bars stepping down and right, development then three steps after it,
with a red line for today. Flat dark background, the same as Tall Text's.
"""
from pathlib import Path

from PIL import Image, ImageDraw

S = 8  # supersample factor
W = 128 * S

BG = (31, 41, 51)
DEV = (0, 120, 212)
UAT = (202, 80, 16)
RELEASE = (16, 124, 16)
CLOSEOUT = (135, 100, 184)
TODAY = (232, 72, 76)
AXIS = (96, 116, 134)

img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, 0, W - 1, W - 1], radius=24 * S, fill=BG)

# The axis line under the day labels.
d.rounded_rectangle([18 * S, 26 * S, 110 * S, 28 * S], radius=1 * S, fill=AXIS)

# Development, then each step after it, one lane each.
bars = [
    (18, 38, 66, DEV),
    (70, 56, 88, UAT),
    (92, 74, 101, RELEASE),
    (104, 92, 112, CLOSEOUT),
]
for x0, y0, x1, color in bars:
    d.rounded_rectangle([x0 * S, y0 * S, x1 * S, (y0 + 11) * S], radius=3 * S, fill=color)

# Today: a red line with a dot on the axis.
d.rounded_rectangle([79 * S, 22 * S, 82 * S, 110 * S], radius=1.5 * S, fill=TODAY)
d.ellipse([75.5 * S, 21.5 * S, 85.5 * S, 31.5 * S], fill=TODAY)

img = img.resize((128, 128), Image.LANCZOS)
out = Path(__file__).resolve().parents[1] / "images" / "icon.png"
out.parent.mkdir(exist_ok=True)
img.save(out)
print(f"wrote {out}", img.size)
