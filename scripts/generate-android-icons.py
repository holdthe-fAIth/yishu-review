#!/usr/bin/env python
# Generate Android launcher icons + splash screens for the Capacitor APK.
# Usage: python scripts/generate-android-icons.py
from __future__ import annotations

import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC_ICON = os.path.join(ROOT, "public", "icons", "icon-512.png")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

LAUNCHER_SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
BG = (246, 247, 248)


def main() -> None:
    if not os.path.isdir(RES):
        print("android/ 不存在，先运行 npx cap add android")
        return

    source = Image.open(SRC_ICON).convert("RGBA")

    # 1) Legacy launcher icons (mipmap-*/ic_launcher.png / ic_launcher_round.png)
    for density, size in LAUNCHER_SIZES.items():
        folder = os.path.join(RES, f"mipmap-{density}")
        os.makedirs(folder, exist_ok=True)
        icon = source.resize((size, size), Image.LANCZOS)
        icon.save(os.path.join(folder, "ic_launcher.png"), "PNG", optimize=True)

        round_icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
        round_icon.paste(icon, (0, 0), mask)
        round_icon.save(os.path.join(folder, "ic_launcher_round.png"), "PNG", optimize=True)

    # 2) 删除 adaptive-icon XML，回落到上面的圆角 PNG（现代桌面也好看且省事）
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        path = os.path.join(RES, "mipmap-anydpi-v26", name)
        if os.path.exists(path):
            os.remove(path)

    # 3) Splash：同尺寸、浅色底 + 居中图标
    splash_files = []
    for dirpath, _dirnames, filenames in os.walk(RES):
        for filename in filenames:
            if filename == "splash.png":
                splash_files.append(os.path.join(dirpath, filename))

    for path in splash_files:
        try:
            size = Image.open(path).size
            canvas = Image.new("RGBA", size, BG + (255,))
            icon_size = int(min(size) * 0.26)
            icon_size = max(64, icon_size)
            icon = source.resize((icon_size, icon_size), Image.LANCZOS)
            canvas.paste(
                icon,
                ((size[0] - icon_size) // 2, (size[1] - icon_size) // 2),
                icon,
            )
            canvas.convert("RGB").save(path, "PNG", optimize=True)
        except Exception as error:  # noqa: BLE001
            print("splash 跳过", path, error)

    print(f"Android 图标已生成：{len(LAUNCHER_SIZES)} 组 launcher + {len(splash_files)} 张 splash")


if __name__ == "__main__":
    main()
