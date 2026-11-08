#!/usr/bin/env python
# Generate PWA icons: 192 / 512 / maskable-512 / apple-touch-icon-180.
# Usage: python scripts/generate-icons.py
from __future__ import annotations

import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "public", "icons")
os.makedirs(OUT_DIR, exist_ok=True)

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
]
FONT_PATH = next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)

C1 = (255, 157, 185)  # #FF9DB9
C2 = (251, 114, 153)  # #FB7299
GLYPH = "\u6570"  # Chinese char: shu


def diagonal_gradient(size: int) -> Image.Image:
    base = Image.new("RGB", (size, size))
    pixels = base.load()
    denom = max(1, 2 * (size - 1))
    for y in range(size):
        for x in range(size):
            t = (x + y) / denom
            pixels[x, y] = (
                round(C1[0] * (1 - t) + C2[0] * t),
                round(C1[1] * (1 - t) + C2[1] * t),
                round(C1[2] * (1 - t) + C2[2] * t),
            )
    return base


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=radius, fill=255
    )
    return mask


def make_icon(size: int, glyph_ratio: float, maskable: bool) -> Image.Image:
    # 4x supersampling for cleaner text edges
    scale = 4
    big = size * scale
    image = diagonal_gradient(big).convert("RGBA")

    if FONT_PATH:
        draw = ImageDraw.Draw(image)
        font = ImageFont.truetype(FONT_PATH, int(big * glyph_ratio))
        left, top, right, bottom = draw.textbbox((0, 0), GLYPH, font=font)
        draw.text(
            ((big - (right - left)) / 2 - left, (big - (bottom - top)) / 2 - top),
            GLYPH,
            font=font,
            fill=(255, 255, 255, 255),
        )
    else:
        draw = ImageDraw.Draw(image)
        r = big * glyph_ratio / 2
        draw.ellipse([big / 2 - r, big / 2 - r, big / 2 + r, big / 2 + r], fill="white")

    image = image.resize((size, size), Image.LANCZOS)

    if maskable:
        # maskable icons must bleed to the edges; glyph stays in the safe zone
        return image

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(image, (0, 0), rounded_mask(size, int(size * 0.23)))
    return out


def main() -> None:
    targets = [
        ("icon-192.png", 192, 0.62, False),
        ("icon-512.png", 512, 0.62, False),
        ("maskable-512.png", 512, 0.44, True),
        ("apple-touch-icon-180x180.png", 180, 0.62, False),
    ]
    for name, size, glyph_ratio, maskable in targets:
        path = os.path.join(OUT_DIR, name)
        make_icon(size, glyph_ratio, maskable).save(path, "PNG", optimize=True)
        print("  OK " + path)
    print("icons generated")


if __name__ == "__main__":
    main()
