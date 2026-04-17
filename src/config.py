"""
src/config.py
Loads environment variables and CLI arguments into a Config dataclass.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root (two levels up from this file)
_ROOT = Path(__file__).parent.parent
load_dotenv(_ROOT / ".env")


# ─── Leonardo AI model / generation constants ─────────────────────────────────

# Leonardo Kino XL — best for realistic, cinematic model photography
LEONARDO_MODEL_ID = "aa77f04e-3eec-4034-9c07-d0f619684628"

# Leonardo Phoenix 1.0 — best for product photography scene placement
# (used by the 'Product Photography - Place into New Scene' blueprint)
LEONARDO_PHOENIX_MODEL_ID = "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3"

# Leonardo API base URL
LEONARDO_BASE_URL = "https://cloud.leonardo.ai/api/rest/v1"

# Default generation parameters (model / img2img mode)
DEFAULT_NUM_IMAGES = 5          # images generated per product
DEFAULT_WIDTH = 1080            # Instagram square post width
DEFAULT_HEIGHT = 1080           # Instagram square post height
DEFAULT_GUIDANCE_SCALE = 7      # higher = more prompt-faithful
DEFAULT_INIT_STRENGTH = 0.40    # high = preserve input strongly, low = more AI freedom
DEFAULT_SCHEDULER = "EULER_DISCRETE"

# Scene mode defaults (Place into New Scene blueprint)
# Higher init_strength so product stays coherent and preserved; scene prompt changes background
SCENE_INIT_STRENGTH = 0.85
SCENE_GUIDANCE_SCALE = 7
SCENE_CONTRAST = 0.5            # Leonardo Phoenix API expects [0, 1]

# Retry settings (tenacity)
RETRY_ATTEMPTS = 3
RETRY_WAIT_SECONDS = 4          # initial wait between retries

# Polling settings
POLL_INTERVAL_SECONDS = 5
POLL_MAX_WAIT_SECONDS = 300     # give up after 5 minutes


@dataclass
class Config:
    api_key: str
    input_dir: Path
    output_dir: Path
    category: str                    # "bags" or "jewelry"
    watermark_path: Path | None
    num_images: int = DEFAULT_NUM_IMAGES
    width: int = DEFAULT_WIDTH
    height: int = DEFAULT_HEIGHT
    guidance_scale: int = DEFAULT_GUIDANCE_SCALE
    init_strength: float = DEFAULT_INIT_STRENGTH
    mode: str = "model"              # "model" = img2img with model; "scene" = place into new scene


def load_config(
    input_dir: str,
    output_dir: str,
    category: str,
    watermark: str | None = None,
    num_images: int = DEFAULT_NUM_IMAGES,
    mode: str = "model",
) -> Config:
    """Validate and return a Config object."""
    api_key = os.getenv("LEONARDO_API_KEY", "").strip()
    if not api_key:
        raise EnvironmentError(
            "LEONARDO_API_KEY is not set. "
            "Copy .env.example → .env and add your key."
        )

    category = category.lower()
    if category not in ("bags", "jewelry"):
        raise ValueError(f"--category must be 'bags' or 'jewelry', got: {category!r}")

    mode = mode.lower()
    if mode not in ("model", "scene"):
        raise ValueError(f"--mode must be 'model' or 'scene', got: {mode!r}")

    input_path = Path(input_dir).expanduser().resolve()
    if not input_path.is_dir():
        raise FileNotFoundError(f"Input directory not found: {input_path}")

    output_path = Path(output_dir).expanduser().resolve()
    output_path.mkdir(parents=True, exist_ok=True)

    watermark_path: Path | None = None
    if watermark:
        watermark_path = Path(watermark).expanduser().resolve()
        if not watermark_path.is_file():
            raise FileNotFoundError(f"Watermark file not found: {watermark_path}")
    else:
        # Try the default location
        default_wm = _ROOT / "watermarks" / "watermark.png"
        if default_wm.is_file():
            watermark_path = default_wm

    # In scene mode, use lower init_strength so background is replaced freely
    if mode == "scene":
        init_strength = SCENE_INIT_STRENGTH
        guidance_scale = SCENE_GUIDANCE_SCALE
    else:
        init_strength = DEFAULT_INIT_STRENGTH
        guidance_scale = DEFAULT_GUIDANCE_SCALE

    return Config(
        api_key=api_key,
        input_dir=input_path,
        output_dir=output_path,
        category=category,
        watermark_path=watermark_path,
        num_images=num_images,
        mode=mode,
        init_strength=init_strength,
        guidance_scale=guidance_scale,
    )
