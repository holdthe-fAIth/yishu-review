#!/usr/bin/env python
# Generate the "数理复习" app icon: PWA icons + Android legacy launcher icons.
# Usage: python scripts/generate-icons.py
from __future__ import annotations

import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
PUBLIC_DIR = os.path.join(ROOT, "public", "icons")
ANDROID_RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
os.makedirs(PUBLIC_DIR, exist_ok=True)

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
]
FONT_PATH = next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)

# 粉（数学）→ 蓝（物理）
C1 = (255, 143, 179)  # #FF8FB3
C2 = (0, 174, 236)  # #00AEEC
GLYPHS = "\u6570\u7406"  # 数理
GAP_RATIO = 0.03


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


def circle_mask(size: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    return mask


def draw_glyphs(draw: ImageDraw.ImageDraw, size: int, ratio: float) -> None:
    if not FONT_PATH:
        # 极端兜底：没有中文字体时画两个白点，避免生成空图标
        r = size * ratio * 0.3
        for cx in (size * 0.35, size * 0.65):
            draw.ellipse([cx - r, size / 2 - r, cx + r, size / 2 + r], fill="white")
        return

    font = ImageFont.truetype(FONT_PATH, int(size * ratio))
    bboxes = [draw.textbbox((0, 0), char, font=font) for char in GLYPHS]
    widths = [bbox[2] - bbox[0] for bbox in bboxes]
    gap = int(size * GAP_RATIO)
    total = sum(widths) + gap
    x = (size - total) / 2
    for char, bbox, width in zip(GLYPHS, bboxes, widths):
        draw.text(
            (x - bbox[0], (size - (bbox[3] - bbox[1])) / 2 - bbox[1]),
            char,
            font=font,
            fill=(255, 255, 255, 255),
        )
        x += width + gap


def make_icon(size: int, glyph_ratio: float, maskable: bool, circular: bool = False) -> Image.Image:
    # 4x supersampling for cleaner text edges
    scale = 4
    big = size * scale
    image = diagonal_gradient(big).convert("RGBA")
    draw_glyphs(ImageDraw.Draw(image), big, glyph_ratio)
    image = image.resize((size, size), Image.LANCZOS)

    if maskable:
        # maskable icons must bleed to the edges; glyph stays in the safe zone
        return image

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = circle_mask(size) if circular else rounded_mask(size, int(size * 0.23))
    out.paste(image, (0, 0), mask)
    return out


def make_foreground(size: int, glyph_ratio: float) -> Image.Image:
    """Transparent foreground for a future adaptive icon (currently unused)."""
    scale = 4
    big = size * scale
    image = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw_glyphs(ImageDraw.Draw(image), big, glyph_ratio)
    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    public_targets = [
        ("icon-192.png", 192, 0.42, False, False),
        ("icon-512.png", 512, 0.42, False, False),
        ("maskable-512.png", 512, 0.34, True, False),
        ("apple-touch-icon-180x180.png", 180, 0.42, False, False),
    ]
    for name, size, glyph_ratio, maskable, circular in public_targets:
        path = os.path.join(PUBLIC_DIR, name)
        make_icon(size, glyph_ratio, maskable, circular).save(path, "PNG", optimize=True)
        print("  OK " + path)

    android_sizes = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    for density, size in android_sizes.items():
        out_dir = os.path.join(ANDROID_RES, "mipmap-" + density)
        os.makedirs(out_dir, exist_ok=True)
        make_icon(size, 0.42, False, False).save(
            os.path.join(out_dir, "ic_launcher.png"), "PNG", optimize=True
        )
        make_icon(size, 0.42, False, True).save(
            os.path.join(out_dir, "ic_launcher_round.png"), "PNG", optimize=True
        )
        make_foreground(int(round(size * 2.25)), 0.34).save(
            os.path.join(out_dir, "ic_launcher_foreground.png"), "PNG", optimize=True
        )
        print("  OK mipmap-" + density)

    print("icons generated")


if __name__ == "__main__":
    main()
