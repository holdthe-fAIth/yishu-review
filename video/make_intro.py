#!/usr/bin/env python
"""生成「一数复习」App 介绍视频（1920x1080 / 30fps / 中文旁白 + 字幕 + 背景音乐）。

用法：
    python video/make_intro.py tts      # 只生成旁白（检查语速/时长）
    python video/make_intro.py stills   # 每个镜头渲染一张静帧，检查排版
    python video/make_intro.py render   # 渲染完整视频（需先 tts）
    python video/make_intro.py all      # tts + render
"""
from __future__ import annotations

import json
import math
import os
import random
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEO_DIR = os.path.join(ROOT, "video")
AUDIO_DIR = os.path.join(VIDEO_DIR, "audio")
ASSETS = os.path.join(ROOT, "screenshots")
PUBLIC = os.path.join(ROOT, "public")
FFMPEG = os.path.join(
    os.path.dirname(ROOT),
    "_videotools",
    "node_modules",
    "@ffmpeg-installer",
    "win32-x64",
    "ffmpeg.exe",
)
if not os.path.exists(FFMPEG):  # 兼容工具装在别处的情况
    FFMPEG = r"D:\deepseek\cursor\_videotools\node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe"
NODE_MODULES = os.path.join(os.path.dirname(ROOT), "_videotools", "node_modules")

W, H, FPS = 1920, 1080, 30
FONT_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_REG = r"C:\Windows\Fonts\msyh.ttc"
FONT_MONO = r"C:\Windows\Fonts\consola.ttf"

PINK = (251, 114, 153)
PINK_LIGHT = (255, 168, 194)
BLUE = (0, 174, 236)
GREEN = (42, 200, 100)
WHITE = (240, 242, 245)
GRAY = (150, 155, 165)
DIM = (100, 105, 115)
BG_TOP = (18, 19, 24)
BG_BOTTOM = (10, 10, 13)

os.makedirs(AUDIO_DIR, exist_ok=True)

# ============================ 剧本 ============================

SCENES = [
    {
        "key": "hook",
        "chapter": "问题",
        "speech": "收藏了几百个 B站 视频，却总是不知道自己看到哪了？",
        "subtitle": "收藏了几百个 B站 视频，却总不知道自己看到哪了？",
        "min_dur": 4.6,
    },
    {
        "key": "intro",
        "chapter": "产品",
        "speech": "一数复习，是一个只为「一数」高中数学准备的复习进度本。",
        "subtitle": "一数复习 · 一数高中数学的复习进度本",
        "min_dur": 5.6,
    },
    {
        "key": "content",
        "chapter": "内容",
        "speech": "一百九十四个知识点，七个合集、三百二十条视频，已经按知识体系全部整理好。",
        "subtitle": "194 个知识点 · 7 个合集 · 320 条视频",
        "min_dur": 7.0,
    },
    {
        "key": "loop",
        "chapter": "玩法",
        "speech": "点一个知识点，直接跳进 B站对应的那一集；看完切回来，一键打勾，进度立刻点亮。",
        "subtitle": "点知识点 → 跳 B站 分P    ｜    切回来 → 一键打勾",
        "min_dur": 8.0,
    },
    {
        "key": "start",
        "chapter": "创作 · 开始",
        "speech": "这个应用是怎么开始的？先定方案，再写代码，从零到能用，只花了几个阶段。",
        "subtitle": "创作历程 · 开始：先方案，后代码",
        "min_dur": 6.6,
    },
    {
        "key": "dev",
        "chapter": "创作 · 发展",
        "speech": "后来它长出了学习日历、视频发布时间和内容更新；主页数据重新抓取，B站 深链接问题也修好了。",
        "subtitle": "发展：学习日历 / 发布时间 / 内容更新 / 数据重抓",
        "min_dur": 8.2,
    },
    {
        "key": "result",
        "chapter": "结果",
        "speech": "现在，它已经上线 GitHub Pages，也能打包成安卓安装包，六十二项自动验收全部通过。",
        "subtitle": "结果：GitHub Pages 上线 · Android APK · 62 项验收通过",
        "min_dur": 8.2,
    },
    {
        "key": "outro",
        "chapter": "尾声",
        "speech": "一数复习，让每一次复习，都有迹可循。",
        "subtitle": "一数复习 · 让每一次复习都有迹可循",
        "min_dur": 5.4,
    },
]

TOTAL_FRAMES = 0  # 由 build_timeline 填充
SCENE_STARTS: list[float] = []
SCENE_DURS: list[float] = []
XFADE = 0.45


# ============================ 工具函数 ============================


def font(size: int, bold: bool = False, mono: bool = False):
    path = FONT_MONO if mono else (FONT_BOLD if bold else FONT_REG)
    return ImageFont.truetype(path, size)


def ease_out(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def ease_in_out(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def fade_alpha(t: float, start: float, dur: float = 0.5) -> float:
    return clamp((t - start) / dur)


def text_size(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont):
    box = draw.textbbox((0, 0), text, font=f)
    return box[2] - box[0], box[3] - box[1]


def wrap_text(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for ch in text:
        if ch == "\n":
            lines.append(current)
            current = ""
            continue
        candidate = current + ch
        if text_size(draw, candidate, f)[0] <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = ch
    if current:
        lines.append(current)
    return lines


def draw_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    text: str,
    f: ImageFont.FreeTypeFont,
    fill,
    anchor: str = "la",
    shadow: bool = False,
):
    if shadow:
        draw.text((xy[0] + 3, xy[1] + 3), text, font=f, fill=(0, 0, 0, 90), anchor=anchor)
    draw.text(xy, text, font=f, fill=fill, anchor=anchor)


def rounded(draw: ImageDraw.ImageDraw, box, radius: int, fill=None, outline=None, width: int = 1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_glow(size: int, color: tuple[int, int, int], max_alpha: int = 120) -> Image.Image:
    y, x = np.mgrid[0:size, 0:size]
    cx = cy = (size - 1) / 2
    dist = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / (size / 2)
    alpha = np.clip(1 - dist, 0, 1) ** 2.2 * max_alpha
    arr = np.zeros((size, size, 4), dtype=np.uint8)
    arr[..., 0] = color[0]
    arr[..., 1] = color[1]
    arr[..., 2] = color[2]
    arr[..., 3] = alpha.astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def build_background() -> Image.Image:
    """深色渐变背景 + 两团氛围光 + 轻网格。"""
    top = np.array(BG_TOP, dtype=np.float32)
    bottom = np.array(BG_BOTTOM, dtype=np.float32)
    rows = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    arr = (top[None, None, :] * (1 - rows) + bottom[None, None, :] * rows).astype(np.uint8)
    arr = np.repeat(arr, W, axis=1)
    bg = Image.fromarray(arr, "RGB").convert("RGBA")

    glow_pink = make_glow(1100, PINK, 95).resize((1100, 1100), Image.LANCZOS)
    glow_blue = make_glow(1000, BLUE, 80).resize((1000, 1000), Image.LANCZOS)
    bg.alpha_composite(glow_pink, (-260, H - 620))
    bg.alpha_composite(glow_blue, (W - 520, -260))

    # 极淡网格
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for x in range(0, W, 80):
        gd.line([(x, 0), (x, H)], fill=(255, 255, 255, 5), width=1)
    for y in range(0, H, 80):
        gd.line([(0, y), (W, y)], fill=(255, 255, 255, 5), width=1)
    bg.alpha_composite(grid)
    return bg


def make_phone(screenshot_path: str, screen_w: int, bezel: int = 10, radius: int = 40) -> Image.Image:
    screenshot = Image.open(screenshot_path).convert("RGB")
    ratio = screenshot.height / screenshot.width
    screen_h = int(screen_w * ratio)
    screen = screenshot.resize((screen_w, screen_h), Image.LANCZOS).convert("RGBA")

    mask = Image.new("L", (screen_w, screen_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, screen_w - 1, screen_h - 1], radius=radius - 12, fill=255)
    screen.putalpha(mask)

    total_w, total_h = screen_w + bezel * 2, screen_h + bezel * 2
    phone = Image.new("RGBA", (total_w, total_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(phone)
    rounded(draw, (0, 0, total_w - 1, total_h - 1), radius, fill=(26, 27, 32, 255))
    rounded(draw, (1, 1, total_w - 2, total_h - 2), radius - 1, outline=(70, 72, 82, 255), width=2)
    phone.alpha_composite(screen, (bezel, bezel))

    # 刘海
    notch_w = int(screen_w * 0.26)
    rounded(
        draw,
        (total_w // 2 - notch_w // 2, bezel - 1, total_w // 2 + notch_w // 2, bezel + 16),
        9,
        fill=(10, 10, 12, 255),
    )
    return phone


def paste_with_shadow(
    base: Image.Image,
    img: Image.Image,
    pos: tuple[float, float],
    alpha: float = 1.0,
    shadow_alpha: int = 120,
    shadow_offset: tuple[int, int] = (0, 26),
    blur: int = 26,
):
    if alpha <= 0:
        return
    if alpha < 1:
        img = img.copy()
        arr = np.array(img, dtype=np.float32)
        arr[..., 3] *= alpha
        img = Image.fromarray(arr.astype(np.uint8), "RGBA")
    # 阴影
    shadow = Image.new("RGBA", (img.width + abs(shadow_offset[0]) * 2, img.height + abs(shadow_offset[1]) * 2), (0, 0, 0, 0))
    sh = Image.new("RGBA", img.size, (0, 0, 0, shadow_alpha))
    sh.putalpha(img.getchannel("A").point(lambda v: int(v * 0.75)))
    shadow.alpha_composite(sh, (abs(shadow_offset[0]), abs(shadow_offset[1])))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(shadow, (int(pos[0] - abs(shadow_offset[0])), int(pos[1] - abs(shadow_offset[1]))))
    base.alpha_composite(img, (int(pos[0]), int(pos[1])))


# ============================ 场景绘制 ============================

CHAPTERS = [("01", "问题"), ("02", "产品"), ("03", "内容"), ("04", "玩法"), ("05", "创作 · 开始"), ("06", "创作 · 发展"), ("07", "结果"), ("08", "尾声")]


# -*- coding: utf-8 -*-
# 重写后的渲染层：避免 PIL 在 RGBA 上直接填半透明色导致的“纯色块”问题，
# 统一用 blend() 预混合颜色；同时修正各镜头布局，避免字幕压住内容。

BG_APPROX = (16, 17, 22)
DARK_CARD = (24, 26, 33)
DARK_CARD_2 = (30, 32, 41)


def blend(color, alpha: float, bg=BG_APPROX):
    alpha = clamp(alpha)
    return tuple(int(bg[i] * (1 - alpha) + color[i] * alpha) for i in range(3))


class Renderer:
    def __init__(self):
        self.bg = build_background()
        self.glow_pink = make_glow(880, PINK, 90)
        self.glow_blue = make_glow(820, BLUE, 80)
        self.icon = Image.open(os.path.join(PUBLIC, "icons", "icon-512.png")).convert("RGBA")

        self.phone_home = make_phone(os.path.join(ASSETS, "02-home-progress.png"), 330)
        self.phone_knowledge = make_phone(os.path.join(ASSETS, "03-knowledge.png"), 300)
        self.phone_topics = make_phone(os.path.join(ASSETS, "08-topics.png"), 300)
        self.phone_return = make_phone(os.path.join(ASSETS, "06-return-bar.png"), 330)
        self.phone_mine = make_phone(os.path.join(ASSETS, "04-mine.png"), 300)
        self.phone_search = make_phone(os.path.join(ASSETS, "07-search.png"), 300)
        self.qr = Image.open(os.path.join(VIDEO_DIR, "qr.png")).convert("RGBA")
        self.rng = random.Random(7)
        self.particles = [
            (self.rng.uniform(0, W), self.rng.uniform(0, H), self.rng.uniform(0.5, 1.6), self.rng.uniform(1, 3))
            for _ in range(38)
        ]
        self.cached_end: dict[int, Image.Image] = {}

    # ---------- 通用 ----------
    def base(self, t: float) -> Image.Image:
        frame = self.bg.copy()
        ox = int(math.sin(t * 0.25) * 60)
        oy = int(math.cos(t * 0.2) * 40)
        frame.alpha_composite(self.glow_pink, (-380 + ox, H - 720 + oy))
        frame.alpha_composite(self.glow_blue, (W - 600 - ox, -300 - oy))
        draw = ImageDraw.Draw(frame)
        for px, py, speed, size in self.particles:
            x = (px + t * 12 * speed) % W
            y = (py + math.sin(t * 0.6 + px) * 18) % H
            draw.ellipse([x, y, x + size, y + size], fill=blend(WHITE, 0.10))
        return frame

    def chapter(self, frame: Image.Image, idx: int):
        draw = ImageDraw.Draw(frame)
        num, name = CHAPTERS[idx]
        draw.text((92, 62), num, font=font(26, bold=True), fill=blend(WHITE, 0.34))
        draw.text((148, 62), f"/ 08   {name}", font=font(26), fill=blend(WHITE, 0.34))
        draw.line([(92, 108), (300, 108)], fill=blend(PINK, 0.62), width=3)

    def subtitle(self, frame: Image.Image, text: str, alpha: float):
        if alpha <= 0.01:
            return
        draw = ImageDraw.Draw(frame)
        f = font(38)
        lines = wrap_text(draw, text, f, 1500)
        line_h = 58
        box_w = max(text_size(draw, line, f)[0] for line in lines) + 90
        box_h = line_h * len(lines) + 34
        x0 = (W - box_w) / 2
        y0 = H - 172 - (len(lines) - 1) * (line_h // 2)
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        rounded(od, (x0, y0, x0 + box_w, y0 + box_h), 22, fill=(8, 9, 12, int(190 * alpha)))
        frame.alpha_composite(overlay)
        draw = ImageDraw.Draw(frame)
        shade = (8, 9, 12)
        for i, line in enumerate(lines):
            draw.text(
                (W / 2, y0 + 17 + i * line_h),
                line,
                font=f,
                fill=blend((240, 242, 245), alpha, shade),
                anchor="ma",
            )

    def watermark(self, frame: Image.Image):
        icon = self.icon.resize((44, 44), Image.LANCZOS)
        x = W - 322
        frame.alpha_composite(icon, (x, 56))
        ImageDraw.Draw(frame).text(
            (x + 54, 64), "一数复习", font=font(28, bold=True), fill=blend(WHITE, 0.72)
        )

    # ---------- 01 Hook ----------
    def s_hook(self, t: float, dur: float) -> Image.Image:
        frame = self.base(t)
        self.chapter(frame, 0)
        draw = ImageDraw.Draw(frame)
        p = ease_out(t / 1.1)
        draw.text((W / 2, 380 + (1 - p) * 34), "收藏了几百个视频", font=font(104, bold=True), fill=blend(WHITE, p), anchor="ma")
        p2 = ease_out((t - 0.55) / 1.0)
        draw.text((W / 2, 530 + (1 - p2) * 34), "却总不知道自己看到哪了？", font=font(104, bold=True), fill=blend(PINK, p2), anchor="ma")
        p3 = ease_out((t - 1.4) / 0.9)
        draw.text((W / 2, 700), "一数高中数学 · 视频复习的困境", font=font(42), fill=blend(GRAY, p3, (24, 26, 32)), anchor="ma")

        for i, (x, y, color) in enumerate([(90, 690, PINK), (1520, 200, BLUE), (1460, 740, (120, 120, 255))]):
            a = 0.12 + 0.1 * math.sin(t * 1.2 + i)
            card = Image.new("RGBA", (340, 190), (0, 0, 0, 0))
            cd = ImageDraw.Draw(card)
            rounded(cd, (0, 0, 339, 189), 24, fill=(*blend(color, a, (12, 13, 18)), 16), outline=(*blend(color, a + 0.25, (12, 13, 18)), 26), width=2)
            frame.alpha_composite(card, (x + int((1 - p3) * 30), y + int(math.sin(t * 1.4 + i) * 10)))
        self.watermark(frame)
        return frame

    # ---------- 02 产品 ----------
    def s_intro(self, t: float, dur: float) -> Image.Image:
        frame = self.base(t)
        self.chapter(frame, 1)
        draw = ImageDraw.Draw(frame)

        icon_p = ease_out((t - 0.1) / 0.9)
        icon = self.icon.resize((190, 190), Image.LANCZOS)
        paste_with_shadow(frame, icon, (150, 300), alpha=icon_p, shadow_alpha=110, blur=30)
        draw = ImageDraw.Draw(frame)
        p = ease_out((t - 0.35) / 0.8)
        draw.text((392, 318), "一数复习", font=font(112, bold=True), fill=blend(WHITE, p))
        p2 = ease_out((t - 0.7) / 0.8)
        draw.text((398, 470), "一数 · 高中数学 · 知识体系 + 打勾进度本", font=font(38), fill=blend(GRAY, p2, (24, 26, 32)))

        chips = ["PWA 可安装", "离线可用", "跳转 B站 App", "本地存储"]
        for i, chip in enumerate(chips):
            cp = ease_out((t - 1.15 - i * 0.12) / 0.6)
            if cp <= 0:
                continue
            f = font(30)
            tw = text_size(draw, chip, f)[0]
            x = 398 + (i % 2) * 300
            y = 596 + (i // 2) * 74 + (1 - cp) * 16
            rounded(draw, (x, y, x + tw + 52, y + 52), 26, fill=blend(PINK, 0.16, (24, 26, 32)), outline=blend(PINK, 0.55, (24, 26, 32)), width=2)
            draw.text((x + 26, y + 11), chip, font=f, fill=blend((255, 255, 255), cp, (34, 26, 34)))

        pp = ease_out((t - 0.5) / 1.0)
        paste_with_shadow(frame, self.phone_home, (1350 - 560 * (1 - pp), 118), alpha=min(1, pp * 1.2), shadow_alpha=150, blur=34)
        self.watermark(frame)
        return frame

    # ---------- 03 内容 ----------
    def s_content(self, t: float, dur: float) -> Image.Image:
        frame = self.base(t)
        self.chapter(frame, 2)
        draw = ImageDraw.Draw(frame)
        p = ease_out(t / 0.7)
        draw.text((120, 160), "内容，一次整理好", font=font(78, bold=True), fill=blend(WHITE, p))
        draw.text((124, 268), "数据来自一数 B站 主页，静态内置，运行时不请求任何 B站 接口", font=font(32), fill=blend(GRAY, p, (24, 26, 32)))

        stats = [("194", "个知识点", "覆盖高中全部模块", PINK), ("7", "个专题合集", "按最新内容排序", BLUE), ("320", "条视频", "每条都带发布时间", (108, 192, 255))]
        for i, (num, label, desc, color) in enumerate(stats):
            ap = ease_out((t - 0.3 - i * 0.2) / 0.9)
            if ap <= 0:
                continue
            y = 372 + i * 178
            value = int(int(num) * ease_out(clamp((t - 0.3 - i * 0.2) / 1.2)))
            draw.text((150, y - 24), str(value), font=font(112, bold=True), fill=blend(color, ap, (22, 23, 30)))
            draw.text((470, y + 10), label, font=font(42, bold=True), fill=blend(WHITE, ap, (22, 23, 30)))
            draw.text((470, y + 72), desc, font=font(28), fill=blend(GRAY, ap, (22, 23, 30)))
            draw.line([(150, y + 128), (150 + 880, y + 128)], fill=blend((255, 255, 255), 0.07 * ap, (22, 23, 30)), width=2)

        pp = ease_out((t - 1.0) / 0.9)
        if pp > 0:
            paste_with_shadow(frame, self.phone_knowledge, (1220, 170 - 40 * (1 - pp)), alpha=pp, shadow_alpha=90, blur=26)
            mini = self.phone_topics.resize((int(self.phone_topics.width * 0.62), int(self.phone_topics.height * 0.62)), Image.LANCZOS)
            paste_with_shadow(frame, mini, (1600, 400 - 40 * (1 - pp)), alpha=pp * 0.96, shadow_alpha=80, blur=24)
        self.watermark(frame)
        return frame

    # ---------- 04 玩法 ----------
    def s_loop(self, t: float, dur: float) -> Image.Image:
        frame = self.base(t)
        self.chapter(frame, 3)
        draw = ImageDraw.Draw(frame)
        p = ease_out(t / 0.7)
        draw.text((W / 2, 112), "核心循环：点开 → 看完 → 打勾", font=font(66, bold=True), fill=blend(WHITE, p), anchor="ma")

        la = ease_out((t - 0.35) / 0.7)
        ra = ease_out((t - 0.5) / 0.7)
        if la > 0:
            draw.text((196, 212), "① 点知识点 → 跳 B站 分集", font=font(32, bold=True), fill=blend(PINK, la, (20, 21, 27)))
        if ra > 0:
            draw.text((W - 196, 212), "② 切回来 → 一键打勾", font=font(32, bold=True), fill=blend(GREEN, ra, (20, 21, 27)), anchor="ra")

        lp = ease_out((t - 0.25) / 0.9)
        rp = ease_out((t - 0.55) / 0.9)
        left_x, left_y = 228, 272
        right_x = W - 548
        paste_with_shadow(frame, self.phone_home, (left_x - 120 * (1 - lp), left_y), alpha=lp, shadow_alpha=140, blur=30)
        paste_with_shadow(frame, self.phone_return, (right_x + 120 * (1 - rp), left_y), alpha=rp, shadow_alpha=140, blur=30)

        draw = ImageDraw.Draw(frame)
        if la > 0.5:
            hx, hy = left_x + 20, left_y + 196
            rounded(draw, (hx, hy, hx + 132, hy + 150), 14, outline=blend(PINK, la, (24, 26, 32)), width=4)
        if ra > 0.5:
            hx2, hy2 = right_x + 18, left_y + 524
            rounded(draw, (hx2, hy2, hx2 + 266, hy2 + 80), 18, outline=blend(GREEN, ra, (24, 26, 32)), width=4)

        ba = ease_out((t - 1.1) / 0.6)
        if ba > 0:
            bx, by = 842, 470
            rounded(draw, (bx, by, bx + 250, by + 78), 20, fill=blend(BLUE, 0.22, (18, 22, 30)), outline=blend(BLUE, 0.8, (18, 22, 30)), width=3)
            draw.text((bx + 125, by + 38), "B站 App 分P", font=font(30, bold=True), fill=blend((255, 255, 255), ba, (18, 22, 30)), anchor="mm")
            ay = by + 39
            draw.line([(left_x + 336, ay), (bx - 30, ay)], fill=blend(PINK, la, (20, 21, 27)), width=5)
            draw.polygon([(bx - 44, ay - 13), (bx - 16, ay), (bx - 44, ay + 13)], fill=blend(PINK, la, (20, 21, 27)))
        self.watermark(frame)
        return frame

    # ---------- 05 创作 · 开始 ----------
    def s_start(self, t: float, dur: float) -> Image.Image:
        frame = self.base(t)
        self.chapter(frame, 4)
        draw = ImageDraw.Draw(frame)
        p = ease_out(t / 0.7)
        draw.text((120, 150), "创作历程 · 开始", font=font(76, bold=True), fill=blend(WHITE, p))
        draw.text((124, 258), "从一句提示词、一个空目录开始", font=font(34), fill=blend(GRAY, p, (24, 26, 32)))

        cp = ease_out((t - 0.3) / 0.9)
        card_x, card_y, card_w, card_h = 140, 340, 780, 480
        lift = 60 * (1 - cp)
        rounded(
            draw,
            (card_x, card_y - lift, card_x + card_w, card_y + card_h - lift),
            28,
            fill=DARK_CARD,
            outline=blend(PINK, 0.34, DARK_CARD),
            width=2,
        )
        draw.text((card_x + 44, card_y + 34 - lift), "主提示词", font=font(34, bold=True), fill=blend(PINK, cp, DARK_CARD))
        prompt_lines = [
            "做一个「一数复习」App：",
            "B站风格的界面，内容是一数的",
            "高中数学视频，按知识体系拆好。",
            "点知识点直接跳 B站 App……",
        ]
        for i, line in enumerate(prompt_lines):
            a = ease_out((t - 0.6 - i * 0.12) / 0.5) * cp
            draw.text((card_x + 44, card_y + 112 + i * 74 - lift), line, font=font(34), fill=blend((228, 231, 238), a, DARK_CARD))
        draw.text((card_x + 44, card_y + 428 - lift), "—— 第一条消息：先出方案，不写代码", font=font(27), fill=blend(GRAY, cp, DARK_CARD))

        steps = [
            ("1", "定方案", "技术栈 / 目录 / 数据模型 / 分阶段"),
            ("2", "搭骨架", "Vite + React + TS，3 个页面"),
            ("3", "接数据", "194 个知识点 + 专题合集"),
            ("4", "打通核心", "深链 + 返回浮条 + 打勾"),
        ]
        for i, (num, title, desc) in enumerate(steps):
            a = ease_out((t - 0.9 - i * 0.26) / 0.6)
            if a <= 0:
                continue
            y = 336 + i * 150 - 16 * (1 - a)
            cx = 1140
            draw.ellipse([cx, y, cx + 64, y + 64], fill=blend(PINK, 0.92, (20, 21, 27)))
            draw.text((cx + 32, y + 32), num, font=font(34, bold=True), fill=(255, 255, 255), anchor="mm")
            if i < len(steps) - 1:
                draw.line([(cx + 32, y + 68), (cx + 32, y + 146)], fill=blend(PINK, 0.4, (20, 21, 27)), width=3)
            draw.text((cx + 96, y + 2), title, font=font(42, bold=True), fill=blend(WHITE, a, (20, 21, 27)))
            draw.text((cx + 96, y + 58), desc, font=font(27), fill=blend(GRAY, a, (20, 21, 27)))
        self.watermark(frame)
        return frame

    # ---------- 06 创作 · 发展 ----------
    def s_dev(self, t: float, dur: float) -> Image.Image:
        frame = self.base(t)
        self.chapter(frame, 5)
        draw = ImageDraw.Draw(frame)
        p = ease_out(t / 0.7)
        draw.text((120, 150), "创作历程 · 发展", font=font(76, bold=True), fill=blend(WHITE, p))
        draw.text((124, 258), "不停迭代：从能用，到好用", font=font(34), fill=blend(GRAY, p, (24, 26, 32)))

        sp = ease_out((t - 0.3) / 0.7)
        draw.text((124, 330), "9 次提交   ·   34 个源文件   ·   7,247 行代码", font=font(30), fill=blend((140, 146, 158), sp, (22, 23, 30)))

        cards = [
            ("11/14", "v2 迭代", ["学习日历 · 打卡热力", "视频发布时间 · 已学排后", "内容更新检查"]),
            ("11/14", "修复 & 重抓", ["修复 B站 深链唤起问题", "重抓主页：7 合集 320 条", "APK v2.0 → v2.1"]),
            ("11/15", "上线", ["GitHub Pages 自动部署", "线上 PWA 可安装", "62 项自动验收全通过"]),
        ]
        for i, (date, title, lines) in enumerate(cards):
            a = ease_out((t - 0.45 - i * 0.3) / 0.7)
            if a <= 0:
                continue
            x = 120 + i * 560
            y = 400 - 26 * (1 - a)
            rounded(draw, (x, y, x + 520, y + 420), 26, fill=DARK_CARD, outline=blend((255, 255, 255), 0.12, DARK_CARD), width=2)
            draw.text((x + 34, y + 28), date, font=font(30, bold=True), fill=blend(PINK, a, DARK_CARD))
            draw.text((x + 34, y + 78), title, font=font(42, bold=True), fill=blend(WHITE, a, DARK_CARD))
            for j, line in enumerate(lines):
                draw.text((x + 34, y + 160 + j * 66), "· " + line, font=font(27), fill=blend((176, 181, 192), a, DARK_CARD))
        self.watermark(frame)
        return frame

    # ---------- 07 结果 ----------
    def s_result(self, t: float, dur: float) -> Image.Image:
        frame = self.base(t)
        self.chapter(frame, 6)
        draw = ImageDraw.Draw(frame)
        p = ease_out(t / 0.7)
        draw.text((120, 150), "结果：上线了", font=font(80, bold=True), fill=blend(WHITE, p))
        draw.text((124, 258), "做出来了，跑起来了，也上线了", font=font(34), fill=blend(GRAY, p, (24, 26, 32)))

        phones = [self.phone_home, self.phone_mine, self.phone_topics]
        for i, phone in enumerate(phones):
            a = ease_out((t - 0.3 - i * 0.16) / 0.8)
            if a <= 0:
                continue
            scale = 0.56
            img = phone.resize((int(phone.width * scale), int(phone.height * scale)), Image.LANCZOS)
            x = 170 + i * 292
            y = 470 - 10 * i - 60 * (1 - a)
            paste_with_shadow(frame, img, (x, y), alpha=a, shadow_alpha=120, blur=28)

        draw = ImageDraw.Draw(frame)
        items = [
            ("GitHub Pages", "线上 PWA · 自动部署", PINK, 1.0),
            ("Android APK", "3.9 MB · 完全离线", BLUE, 1.3),
            ("62 项", "自动化验收全部通过", GREEN, 1.6),
        ]
        for i, (title, desc, color, delay) in enumerate(items):
            a = ease_out((t - delay) / 0.6)
            if a <= 0:
                continue
            y = 226 + i * 128
            rounded(draw, (1180, y, 1810, y + 104), 22, fill=blend(color, 0.1, (20, 21, 27)), outline=blend(color, 0.55, (20, 21, 27)), width=2)
            draw.text((1216, y + 14), title, font=font(40, bold=True), fill=blend(color, a, (20, 21, 27)))
            draw.text((1216, y + 66), desc, font=font(28), fill=blend((205, 209, 217), a, (20, 21, 27)))
        self.watermark(frame)
        return frame

    # ---------- 08 尾声 ----------
    def s_outro(self, t: float, dur: float) -> Image.Image:
        frame = self.base(t)
        self.chapter(frame, 7)
        draw = ImageDraw.Draw(frame)
        p = ease_out(t / 0.8)
        icon = self.icon.resize((140, 140), Image.LANCZOS)
        paste_with_shadow(frame, icon, (W / 2 - 70, 150), alpha=p, shadow_alpha=120, blur=26)
        draw = ImageDraw.Draw(frame)
        draw.text((W / 2, 332), "一数复习", font=font(92, bold=True), fill=blend(WHITE, p), anchor="ma")
        p2 = ease_out((t - 0.35) / 0.7)
        draw.text((W / 2, 462), "让每一次复习，都有迹可循", font=font(44), fill=blend((182, 187, 197), p2, (22, 23, 30)), anchor="ma")

        qp = ease_out((t - 0.7) / 0.8)
        if qp > 0:
            card_w, card_h = 690, 280
            card = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
            cd = ImageDraw.Draw(card)
            rounded(cd, (0, 0, card_w - 1, card_h - 1), 26, fill=(255, 255, 255, 255))
            qr = self.qr.resize((196, 196), Image.LANCZOS)
            card.alpha_composite(qr, (38, 42))
            cd = ImageDraw.Draw(card)
            cd.text((270, 42), "手机扫码安装", font=font(36, bold=True), fill=(24, 25, 32, 255))
            cd.text((270, 104), "yiweiima.github.io", font=font(27, bold=True), fill=(30, 31, 38, 255))
            cd.text((270, 144), "/yishu-review/", font=font(27, bold=True), fill=(30, 31, 38, 255))
            cd.text((270, 200), "Android APK 可安装", font=font(24), fill=(96, 99, 108, 255))
            if qp < 1:
                arr = np.array(card, dtype=np.float32)
                arr[..., 3] *= qp
                card = Image.fromarray(arr.astype(np.uint8), "RGBA")
            frame.alpha_composite(card, (int(W / 2 - card_w / 2), int(552 + 20 * (1 - qp))))

        self.watermark(frame)
        return frame

    # ---------- 调度 ----------
    def render_scene(self, idx: int, t: float, dur: float) -> Image.Image:
        key = SCENES[idx]["key"]
        fn = getattr(self, f"s_{key}")
        frame = fn(t, dur)
        alpha = fade_alpha(t, 0.25, 0.35)
        if t > dur - 0.5:
            alpha *= clamp((dur - t) / 0.5)
        self.subtitle(frame, SCENES[idx]["subtitle"], alpha)
        return frame

    def end_frame(self, idx: int) -> Image.Image:
        if idx not in self.cached_end:
            dur = SCENE_DURS[idx]
            self.cached_end[idx] = self.render_scene(idx, max(0.0, dur - 0.001), dur)
        return self.cached_end[idx]

    def darken(self, frame: Image.Image, factor: float) -> Image.Image:
        if factor >= 1:
            return frame
        arr = np.array(frame.convert("RGB"), dtype=np.float32) * factor
        return Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")

    def render_frame(self, t: float) -> Image.Image:
        idx = 0
        for i, start in enumerate(SCENE_STARTS):
            if t >= start:
                idx = i
        local = t - SCENE_STARTS[idx]
        dur = SCENE_DURS[idx]
        frame = self.render_scene(idx, local, dur)
        if idx > 0 and local < XFADE:
            prev = self.end_frame(idx - 1)
            a = ease_in_out(local / XFADE)
            frame = Image.blend(prev, frame, a)

        total = sum(SCENE_DURS)
        if t < 0.5:
            frame = self.darken(frame, 0.2 + 0.8 * clamp(t / 0.5))
        if t > total - 0.9:
            frame = self.darken(frame, 1.0 - 0.9 * clamp((t - (total - 0.9)) / 0.9))
        return frame


# ============================ TTS / 音乐 / 时间轴 ============================


def tts_filename(index: int) -> str:
    return os.path.join(AUDIO_DIR, f"seg{index + 1}.wav")


def generate_tts():
    segments = []
    for i, scene in enumerate(SCENES):
        segments.append({"path": tts_filename(i), "text": scene["speech"]})

    json_path = os.path.join(AUDIO_DIR, "segments.json")
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(segments, fh, ensure_ascii=False)

    ps1 = r"""
Add-Type -AssemblyName System.Speech
$segments = Get-Content -Raw -Encoding UTF8 '__JSON__' | ConvertFrom-Json
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
try { $s.SelectVoice('Microsoft Huihui Desktop') } catch {}
$s.Rate = -1
$s.Volume = 100
foreach ($seg in $segments) {
  $s.SetOutputToWaveFile($seg.path)
  $s.Speak($seg.text)
  $s.SetOutputToNull()
}
Write-Output 'TTS_DONE'
""".replace("__JSON__", json_path)
    ps1_path = os.path.join(AUDIO_DIR, "tts.ps1")
    with open(ps1_path, "w", encoding="utf-8-sig") as fh:
        fh.write(ps1)
    result = subprocess.run(
        ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", ps1_path],
        capture_output=True,
        text=True,
    )
    print(result.stdout.strip()[-200:])
    if result.returncode != 0 or "TTS_DONE" not in result.stdout:
        print("STDERR:", result.stderr[-800:])
        raise SystemExit("TTS 失败")

    durations = []
    for i in range(len(SCENES)):
        with wave.open(tts_filename(i), "rb") as wf:
            durations.append(wf.getnframes() / wf.getframerate())
    print("旁白时长：", [round(d, 2) for d in durations], "合计", round(sum(durations), 1), "秒")
    return durations


def build_timeline(audio_durations: list[float]):
    global SCENE_DURS, SCENE_STARTS, TOTAL_FRAMES
    SCENE_DURS = [max(scene["min_dur"], dur + 1.9) for scene, dur in zip(SCENES, audio_durations)]
    SCENE_STARTS = []
    acc = 0.0
    for dur in SCENE_DURS:
        SCENE_STARTS.append(round(acc, 3))
        acc += dur
    TOTAL_FRAMES = int(round(acc * FPS))
    print("镜头时长：", [(s["key"], round(d, 2)) for s, d in zip(SCENES, SCENE_DURS)])
    print(f"总时长：{acc:.2f}s，{TOTAL_FRAMES} 帧")


def generate_music(total_seconds: float) -> str:
    sr = 44100
    n = int(total_seconds * sr) + sr
    t = np.arange(n) / sr
    chords = [
        (220.00, 261.63, 329.63, 392.00),  # Am7
        (174.61, 220.00, 261.63, 329.63),  # Fmaj7
        (196.00, 246.94, 293.66, 349.23),  # G
        (261.63, 329.63, 392.00, 493.88),  # Cmaj7
    ]
    audio = np.zeros(n, dtype=np.float64)
    chord_len = 4.0
    for idx in range(int(total_seconds / chord_len) + 2):
        start = int(idx * chord_len * sr)
        end = min(n, start + int(chord_len * sr))
        if start >= n:
            break
        chord = chords[idx % len(chords)]
        local_t = t[start:end] - t[start]
        env = np.minimum(1, local_t / 0.8) * np.exp(-local_t / 3.2)
        tone = np.zeros(end - start)
        for k, freq in enumerate(chord):
            tone += (1.0 - k * 0.16) * np.sin(2 * np.pi * freq * local_t) * 0.5
            tone += 0.18 * np.sin(2 * np.pi * freq * 2 * local_t)
        audio[start:end] += tone * env * 0.55
    # 慢速颤音 + 远景空气感
    audio *= 1 + 0.06 * np.sin(2 * np.pi * 0.15 * t)
    audio += 0.02 * np.sin(2 * np.pi * 110 * t + np.sin(2 * np.pi * 0.1 * t) * 4)
    audio = np.tanh(audio * 0.6)
    audio /= max(1e-6, np.max(np.abs(audio)))
    audio *= 0.55
    # 静音淡入淡出
    fade = int(1.6 * sr)
    audio[:fade] *= np.linspace(0, 1, fade)
    audio[-fade:] *= np.linspace(1, 0, fade)
    stereo = np.stack([audio, audio * 0.92], axis=1)
    path = os.path.join(AUDIO_DIR, "music.wav")
    with wave.open(path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes((stereo * 32767).astype(np.int16).tobytes())
    print("背景音乐：", path)
    return path


def read_wav_mono(path: str, sr: int = 44100) -> np.ndarray:
    with wave.open(path, "rb") as wf:
        channels = wf.getnchannels()
        width = wf.getsampwidth()
        rate = wf.getframerate()
        frames = wf.readframes(wf.getnframes())
    if width == 2:
        data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    elif width == 1:
        data = (np.frombuffer(frames, dtype=np.uint8).astype(np.float32) - 128) / 128.0
    else:
        raise SystemExit("unsupported wav")
    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)
    if rate != sr:
        old_t = np.linspace(0, 1, len(data), endpoint=False)
        new_len = int(len(data) * sr / rate)
        new_t = np.linspace(0, 1, new_len, endpoint=False)
        data = np.interp(new_t, old_t, data).astype(np.float32)
    return data


def build_audio(audio_durations: list[float], total_seconds: float) -> str:
    sr = 44100
    total_samples = int(total_seconds * sr) + sr // 2
    narration = np.zeros(total_samples, dtype=np.float32)
    for i, dur in enumerate(audio_durations):
        start = SCENE_STARTS[i] + 0.55
        samples = read_wav_mono(tts_filename(i), sr)
        s0 = int(start * sr)
        s1 = min(total_samples, s0 + len(samples))
        narration[s0:s1] += samples[: s1 - s0] * 0.95

    music = read_wav_mono(os.path.join(AUDIO_DIR, "music.wav"), sr)
    music_track = np.zeros(total_samples, dtype=np.float32)
    m1 = min(total_samples, len(music))
    music_track[:m1] = music[:m1] * 0.16

    mix = narration + music_track
    mix = np.clip(mix, -1, 1)
    stereo = np.stack([mix, mix], axis=1)
    path = os.path.join(AUDIO_DIR, "final_audio.wav")
    with wave.open(path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes((stereo * 32767).astype(np.int16).tobytes())
    print("最终音轨：", path)
    return path


# ============================ 渲染 / 编码 ============================


def render_stills():
    durations = [scene["min_dur"] for scene in SCENES]
    build_timeline(durations)
    r = Renderer()
    os.makedirs(os.path.join(VIDEO_DIR, "stills"), exist_ok=True)
    for i in range(len(SCENES)):
        t = SCENE_STARTS[i] + SCENE_DURS[i] * 0.58
        frame = r.render_frame(t)
        path = os.path.join(VIDEO_DIR, "stills", f"{i + 1:02d}-{SCENES[i]['key']}.png")
        frame.convert("RGB").save(path)
        print("静帧：", path)


def render_video(audio_durations: list[float]):
    build_timeline(audio_durations)
    total_seconds = sum(SCENE_DURS)
    generate_music(total_seconds)
    renderer = Renderer()

    os.makedirs(VIDEO_DIR, exist_ok=True)
    silent = os.path.join(VIDEO_DIR, "silent.mp4")
    cmd = [
        FFMPEG,
        "-y",
        "-loglevel",
        "error",
        "-nostats",
        "-f",
        "rawvideo",
        "-vcodec",
        "rawvideo",
        "-s",
        f"{W}x{H}",
        "-pix_fmt",
        "rgb24",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "19",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        silent,
    ]
    print("开始渲染帧 → ffmpeg ...", flush=True)
    process = subprocess.Popen(
        cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    try:
        for frame_index in range(TOTAL_FRAMES):
            t = frame_index / FPS
            frame = renderer.render_frame(t)
            process.stdin.write(frame.convert("RGB").tobytes())
            if frame_index % 150 == 0:
                print(f"  帧 {frame_index}/{TOTAL_FRAMES}  ({t:.1f}s)", flush=True)
    finally:
        process.stdin.close()
        code = process.wait()
    if code != 0:
        raise SystemExit("ffmpeg 编码失败")
    print("无声视频完成：", silent, flush=True)

    audio_path = build_audio(audio_durations, total_seconds)
    output = os.path.join(VIDEO_DIR, "一数复习-介绍.mp4")
    mux_cmd = [
        FFMPEG,
        "-y",
        "-i",
        silent,
        "-i",
        audio_path,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        output,
    ]
    result = subprocess.run(mux_cmd, capture_output=True, encoding="utf-8", errors="ignore")
    if result.returncode != 0:
        print(result.stderr[-2000:])
        raise SystemExit("音频合成失败")
    print("成片：", output)

    # 封面
    cover = renderer.render_frame(SCENE_STARTS[1] + 2.0)
    cover_path = os.path.join(VIDEO_DIR, "cover.png")
    cover.convert("RGB").save(cover_path)
    print("封面：", cover_path)


def make_qr():
    qr_path = os.path.join(VIDEO_DIR, "qr.png")
    script = (
        "const QR=require('qrcode');"
        f"QR.toFile({json.dumps(qr_path)},'https://yiweiima.github.io/yishu-review/',"
        "{width:520,margin:1,color:{dark:'#15161a',light:'#ffffff'}}).then(()=>console.log('QR_OK'))"
    )
    env = dict(os.environ)
    env["NODE_PATH"] = NODE_MODULES
    result = subprocess.run(["node", "-e", script], capture_output=True, text=True, env=env)
    print(result.stdout.strip() or result.stderr[-500:])


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    os.makedirs(VIDEO_DIR, exist_ok=True)
    if not os.path.exists(os.path.join(VIDEO_DIR, "qr.png")):
        make_qr()

    durations = None
    if mode in ("tts", "all"):
        durations = generate_tts()
        with open(os.path.join(AUDIO_DIR, "durations.json"), "w", encoding="utf-8") as fh:
            json.dump(durations, fh)
    elif mode in ("render", "stills"):
        with open(os.path.join(AUDIO_DIR, "durations.json"), encoding="utf-8") as fh:
            durations = json.load(fh)

    if mode == "tts":
        build_timeline(durations)
        return
    if mode == "stills":
        render_stills()
        return
    if mode in ("render", "all"):
        render_video(durations)


if __name__ == "__main__":
    main()
