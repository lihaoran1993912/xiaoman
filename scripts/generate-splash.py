#!/usr/bin/env python3
"""生成 iPhone PWA 启动图。仅构建期使用：python3 scripts/generate-splash.py"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE_ICON = ROOT / "icons" / "icon-512.png"
FONT_PATH = Path("/usr/share/fonts/opentype/source-han-cjk/SourceHanSerifSC-Regular.otf")
OUT = ROOT / "icons" / "splash"

DEVICES = [
    ("iphone-440x956@3", 1320, 2868, 3),
    ("iphone-402x874@3", 1206, 2622, 3),
    ("iphone-430x932@3", 1290, 2796, 3),
    ("iphone-393x852@3", 1179, 2556, 3),
    ("iphone-390x844@3", 1170, 2532, 3),
    ("iphone-428x926@3", 1284, 2778, 3),
    ("iphone-414x896@3", 1242, 2688, 3),
    ("iphone-414x896@2", 828, 1792, 2),
    ("iphone-375x812@3", 1125, 2436, 3),
    ("iphone-414x736@3", 1242, 2208, 3),
    ("iphone-375x667@2", 750, 1334, 2),
    ("iphone-320x568@2", 640, 1136, 2),
]

BG = "#FBF4F0"
WORD_COLOR = "#5E4652"


def rounded_icon(size, radius_ratio=0.235):
    source = Image.open(SOURCE_ICON).convert("RGB")
    icon = source.resize((size, size), Image.LANCZOS)
    radius = int(size * radius_ratio)
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rectangle((radius, 0, size - radius - 1, size - 1), fill=255)
    mask_draw.rectangle((0, radius, size - 1, size - radius - 1), fill=255)
    for box in (
        (0, 0, 2 * radius, 2 * radius),
        (size - 2 * radius - 1, 0, size - 1, 2 * radius),
        (0, size - 2 * radius - 1, 2 * radius, size - 1),
        (size - 2 * radius - 1, size - 2 * radius - 1, size - 1, size - 1),
    ):
        mask_draw.ellipse(box, fill=255)
    rounded = Image.new("RGB", (size, size), BG)
    rounded.paste(icon, (0, 0), mask)
    return rounded


def text_width(font, text):
    if hasattr(font, "getlength"):
        return font.getlength(text)
    return font.getsize(text)[0]


def text_height(font, text):
    if hasattr(font, "getbbox"):
        box = font.getbbox(text)
        return box[3] - box[1]
    return font.getsize(text)[1]


def draw_text_with_tracking(draw, center_x, top, text, font, fill, tracking):
    widths = [text_width(font, char) for char in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = center_x - total / 2
    for char, width in zip(text, widths):
        draw.text((x, top), char, font=font, fill=fill)
        x += width + tracking


def make_splash(width, height, ratio):
    canvas = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(canvas)

    icon_css = 64
    icon_px = round(icon_css * ratio)
    gap_px = round(13 * ratio)
    word_size = round(16 * ratio)
    tracking = round(3.2 * ratio)
    font = ImageFont.truetype(str(FONT_PATH), word_size)

    height_of_text = text_height(font, "小满")
    group_height = icon_px + gap_px + height_of_text
    top = (height - group_height) // 2 - round(4 * ratio)

    icon = rounded_icon(icon_px)
    canvas.paste(icon, ((width - icon_px) // 2, top))

    draw = ImageDraw.Draw(canvas)
    draw_text_with_tracking(
        draw,
        width / 2,
        top + icon_px + gap_px,
        "小满",
        font,
        WORD_COLOR,
        tracking,
    )
    return canvas


OUT.mkdir(parents=True, exist_ok=True)
if not SOURCE_ICON.exists():
    raise SystemExit("缺少 icons/icon-512.png")

for name, width, height, ratio in DEVICES:
    image = make_splash(width, height, ratio)
    destination = OUT / f"{name}.png"
    image.save(destination, "PNG", optimize=True)
    print(f"{destination.name}: {width}×{height}")
