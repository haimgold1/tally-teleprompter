#!/usr/bin/env python3
"""Draws the app icons and iOS splash screens into public/. Run: npm run assets"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / "public"
BG_TOP = (28, 22, 64)
BG_BOTTOM = (7, 7, 15)
BLUE = (77, 125, 255)
VIOLET = (138, 92, 255)
ORCHID = (192, 107, 255)
INK = (242, 243, 251)
SS = 4  # supersampling factor

# iOS splash screens are matched by exact device size, in portrait pixels.
SPLASH_SIZES = [
    (750, 1334), (1242, 2208), (1125, 2436), (828, 1792), (1242, 2688), (1170, 2532),
    (1284, 2778), (1179, 2556), (1290, 2796), (1206, 2622), (1320, 2868), (1260, 2736),
]


def gradient(w, h):
    img = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(h - 1, 1)
        img.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)))
    return img.resize((w, h)).convert("RGBA")


def draw_mark(canvas, cx, cy, unit):
    """Tally light above left-aligned prompter lines, with one gradient reading line."""
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    r = unit * 0.34
    tally_y = cy - unit * 1.42
    ImageDraw.Draw(glow).ellipse(
        [cx - r * 1.5, tally_y - r * 1.5, cx + r * 1.5, tally_y + r * 1.5], fill=(*VIOLET, 190)
    )
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(unit * 0.42)))

    d = ImageDraw.Draw(canvas)
    d.ellipse([cx - r, tally_y - r, cx + r, tally_y + r], fill=VIOLET)

    half = unit * 1.62
    bar = unit * 0.27
    lines = [
        (cy - unit * 0.42, 1.0, None),
        (cy + unit * 0.3, 0.8, (*INK, 235)),
        (cy + unit * 1.02, 0.56, (*INK, 150)),
    ]
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for y, width, color in lines:
        left = cx - half
        right = left + half * 2 * width
        box = [left, y - bar / 2, right, y + bar / 2]
        if color is not None:
            ld.rounded_rectangle(box, radius=bar / 2, fill=color)
            continue
        # The reading line carries the blue-to-orchid signal gradient.
        mask = Image.new("L", canvas.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle(box, radius=bar / 2, fill=255)
        ramp = Image.new("RGBA", canvas.size)
        px = ramp.load()
        span = max(right - left, 1)
        for x in range(int(left), int(right) + 1):
            t = (x - left) / span
            c = tuple(round(a + (b - a) * t) for a, b in zip(BLUE, ORCHID)) + (255,)
            for yy in range(int(box[1]), int(box[3]) + 1):
                px[x, yy] = c
        layer.paste(ramp, (0, 0), mask)
    canvas.alpha_composite(layer)


def render(w, h, unit):
    big = gradient(w * SS, h * SS)
    draw_mark(big, w * SS / 2, h * SS / 2 + unit * SS * 0.18, unit * SS)
    return big.resize((w, h), Image.LANCZOS).convert("RGB")


def main():
    icons = ROOT / "icons"
    splash = ROOT / "splash"
    icons.mkdir(parents=True, exist_ok=True)
    splash.mkdir(parents=True, exist_ok=True)

    render(192, 192, 192 * 0.2).save(icons / "icon-192.png", optimize=True)
    render(512, 512, 512 * 0.2).save(icons / "icon-512.png", optimize=True)
    render(180, 180, 180 * 0.2).save(icons / "apple-touch-icon.png", optimize=True)
    # Maskable icons must keep the artwork inside the central 80% safe zone.
    render(512, 512, 512 * 0.15).save(icons / "maskable-512.png", optimize=True)

    for w, h in SPLASH_SIZES:
        render(w, h, w * 0.07).save(splash / f"{w}x{h}.png", optimize=True)


if __name__ == "__main__":
    main()
