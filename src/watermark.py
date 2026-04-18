"""
src/watermark.py
Applies a watermark image (or auto-generated text) to the bottom-right corner.

Adaptive colour logic: the brightness of the placement region is sampled and
the watermark is rendered in dark or white so it always contrasts with the
background.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps, ImageStat

from src.logger import get_logger

log = get_logger()

_WATERMARK_TEXT = "© Clutches and More"
_FONT_SIZE = 80
_PADDING = 0           # redundant now that we center on product
_DARK_THRESHOLD = 128  # average luminance below this → background is dark


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _region_brightness(base: Image.Image, x: int, y: int, wm_w: int, wm_h: int) -> float:
    """
    Return the mean luminance (0–255) of the rectangular region in *base*
    where the watermark will be placed.
    """
    region = base.crop((x, y, x + wm_w, y + wm_h)).convert("L")
    arr = np.array(region, dtype=np.float32)
    return float(arr.mean())


def _find_product_center(base: Image.Image) -> tuple[int, int]:
    """
    Heuristic to find the center of the product.
    Divides the image into a grid and finds the cell with the highest
    standard deviation of luminance (most detail/texture).
    """
    w, h = base.size
    gray = base.convert("L")
    grid_size = 8
    cell_w = w // grid_size
    cell_h = h // grid_size

    best_val = -1
    best_center = (w // 2, h // 2)

    for i in range(grid_size):
        for j in range(grid_size):
            # Calculate variance in this cell
            left = i * cell_w
            top = j * cell_h
            right = (i + 1) * cell_w
            bottom = (j + 1) * cell_h
            
            # Crop and calculate stats
            cell = gray.crop((left, top, right, bottom))
            stat = ImageStat.Stat(cell)
            std_dev = stat.stddev[0]
            
            # Weighted by distance to center to favor central products
            dx = (i - grid_size / 2) / grid_size
            dy = (j - grid_size / 2) / grid_size
            centrality = 1.0 - (dx*dx + dy*dy)**0.5
            
            score = std_dev * centrality
            
            if score > best_val:
                best_val = score
                best_center = (left + cell_w // 2, top + cell_h // 2)
                
    return best_center


def _adapt_wm_image(wm: Image.Image, brightness: float) -> Image.Image:
    """
    Return a version of the RGBA watermark *wm* coloured for contrast.

    - Light background  (brightness >= threshold) → keep original dark logo
    - Dark background   (brightness <  threshold) → invert to white logo
    """
    if brightness < _DARK_THRESHOLD:
        log.debug("Dark background detected (%.1f) — inverting watermark to white.", brightness)
        # Split channels, invert only RGB, keep alpha
        r, g, b, a = wm.split()
        rgb = Image.merge("RGB", (r, g, b))
        rgb_inv = ImageOps.invert(rgb)
        r2, g2, b2 = rgb_inv.split()
        wm = Image.merge("RGBA", (r2, g2, b2, a))
    else:
        log.debug("Light background detected (%.1f) — using original dark watermark.", brightness)
    return wm


def _make_text_watermark(
    width: int,
    height: int,
    x: int,
    y: int,
    text_w: int,
    text_h: int,
    font,
    brightness: float,
) -> Image.Image:
    """Create an RGBA text watermark layer with contrast-adaptive colour."""
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    if brightness < _DARK_THRESHOLD:
        # Dark background → white text
        text_color = (255, 255, 255, 200)
        shadow_color = (0, 0, 0, 100)
    else:
        # Light background → dark text
        text_color = (30, 30, 30, 200)
        shadow_color = (255, 255, 255, 100)

    # Shadow for depth
    draw.text((x + 1, y + 1), _WATERMARK_TEXT, font=font, fill=shadow_color)
    # Main text
    draw.text((x, y), _WATERMARK_TEXT, font=font, fill=text_color)
    return canvas


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def apply_watermark(
    image_path: Path | str,
    watermark_path: Path | str | None,
    output_path: Path | str,
    padding: int = _PADDING,
) -> None:
    """
    Apply a watermark to an image and save to output_path.

    The watermark colour (dark vs. white) is chosen automatically based on
    the brightness of the region where it will be placed.

    Args:
        image_path:     Source image (RGB or RGBA).
        watermark_path: PNG watermark with transparency, or None to use
                        auto-generated text watermark.
        output_path:    Where to save the watermarked image (JPEG).
        padding:        Pixels from the bottom-right corner.
    """
    image_path = Path(image_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    base = Image.open(image_path).convert("RGBA")
    w, h = base.size

    if watermark_path and Path(watermark_path).is_file():
        wm = Image.open(watermark_path).convert("RGBA")

        # Force watermark to 80% of base image width (upscale or downscale)
        target_wm_w = int(w * 0.80)
        ratio = target_wm_w / wm.width
        wm = wm.resize(
            (target_wm_w, int(wm.height * ratio)),
            Image.LANCZOS,
        )

        # Smart placement: find product center
        pc_x, pc_y = _find_product_center(base)
        x = pc_x - wm.width // 2
        y = pc_y - wm.height // 2

        # Ensure it stays within bounds
        x = max(0, min(x, w - wm.width))
        y = max(0, min(y, h - wm.height))

        # Adaptive colour: sample the background under the watermark placement
        brightness = _region_brightness(base, x, y, wm.width, wm.height)
        wm = _adapt_wm_image(wm, brightness)

        overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
        overlay.paste(wm, (x, y), wm)
        composite = Image.alpha_composite(base, overlay)

    else:
        log.debug("No watermark PNG found — using text watermark.")

        # Build font first so we can measure text dimensions
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", _FONT_SIZE)
        except (IOError, OSError):
            try:
                font = ImageFont.truetype(
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", _FONT_SIZE
                )
            except (IOError, OSError):
                font = ImageFont.load_default()

        # Measure text
        dummy = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
        bbox = dummy.textbbox((0, 0), _WATERMARK_TEXT, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]

        # Smart placement: find product center
        pc_x, pc_y = _find_product_center(base)
        x = pc_x - text_w // 2
        y = pc_y - text_h // 2

        # Ensure it stays within bounds
        x = max(0, min(x, w - text_w))
        y = max(0, min(y, h - text_h))

        # Sample brightness of the text region
        brightness = _region_brightness(base, x, y, text_w, text_h)

        text_overlay = _make_text_watermark(w, h, x, y, text_w, text_h, font, brightness)
        composite = Image.alpha_composite(base, text_overlay)

    # Save as JPEG (drop alpha channel)
    composite.convert("RGB").save(output_path, "JPEG", quality=92)
    log.debug("Watermarked image saved → %s", output_path)

