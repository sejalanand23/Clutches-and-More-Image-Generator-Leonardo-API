"""
tools/generate_watermark.py
Utility script to create a default text-based watermark PNG.
Run once to create watermarks/watermark.png if you don't have a logo.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WATERMARK_TEXT = "© Clutches and More"
OUTPUT_PATH = Path(__file__).parent.parent / "watermarks" / "watermark.png"

# Canvas size
W, H = 400, 60
FONT_SIZE = 30

canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(canvas)

try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", FONT_SIZE)
except (IOError, OSError):
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", FONT_SIZE)
    except (IOError, OSError):
        font = ImageFont.load_default()

bbox = draw.textbbox((0, 0), WATERMARK_TEXT, font=font)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
x = (W - tw) // 2
y = (H - th) // 2

# Shadow
draw.text((x + 1, y + 1), WATERMARK_TEXT, font=font, fill=(0, 0, 0, 100))
# White text
draw.text((x, y), WATERMARK_TEXT, font=font, fill=(255, 255, 255, 200))

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
canvas.save(OUTPUT_PATH, "PNG")
print(f"Watermark saved → {OUTPUT_PATH}")
