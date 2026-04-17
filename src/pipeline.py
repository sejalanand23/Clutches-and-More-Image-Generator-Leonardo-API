"""
src/pipeline.py
Main orchestration loop.  Iterates all product images in input_dir,
generates model photos via Leonardo AI, applies watermark, and saves results.

Refactored to expose:
  process_images(image_paths, config) -> list[str]   ← used by web backend
  process_all_products(config) -> None               ← used by CLI (unchanged)
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Callable, Generator

from tqdm import tqdm

from src.config import Config
from src.prompts import get_prompts, get_scene_prompts
from src.leonardo_client import (
    upload_image,
    start_generation,
    start_scene_generation,
    poll_generation,
    download_image,
)
from src.watermark import apply_watermark
from src.logger import get_logger

log = get_logger()

_SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
_INTER_PRODUCT_PAUSE = 2  # seconds between products (rate-limit courtesy)


# ─── Public API used by the web backend ───────────────────────────────────────

def process_images(
    image_paths: list[Path],
    config: Config,
    custom_prompt: str | None = None,
    on_progress: Callable[[int, int, str], None] | None = None,
) -> Generator[str, None, None]:
    """
    Process an explicit list of image paths. Yields output paths one by one.
    """
    for product_path in image_paths:
        yield from _process_single_product(product_path, config, custom_prompt, on_progress)


# ─── CLI entry point (unchanged behaviour) ────────────────────────────────────

def process_all_products(config: Config) -> None:
    """
    Main CLI entry point.  For every product image in config.input_dir:
      1. Upload it to Leonardo as an init-image
      2. Generate config.num_images variations (one API call per variation)
      3. Download each generated image
      4. Apply watermark
      5. Save to config.output_dir / <product_name> / img_N.jpg
    """
    product_images = sorted(
        p for p in config.input_dir.iterdir()
        if p.is_file() and p.suffix.lower() in _SUPPORTED_EXTENSIONS
    )

    if not product_images:
        log.warning("No supported images found in %s — nothing to do.", config.input_dir)
        return

    log.info(
        "Found %d product image(s) in %s",
        len(product_images),
        config.input_dir,
    )

    for product_path in tqdm(product_images, desc="Products", unit="product"):
        _process_single_product(product_path, config)
        time.sleep(_INTER_PRODUCT_PAUSE)

    log.info("✅  Pipeline complete.  Results saved in: %s", config.output_dir)


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _process_single_product(
    product_path: Path,
    config: Config,
    custom_prompt: str | None = None,
    on_progress: Callable[[int, int, str], None] | None = None,
) -> Generator[str, None, None]:
    """
    Process one product image end-to-end.
    Yields output file paths as they are saved.
    """
    product_name = product_path.stem
    output_dir = config.output_dir / product_name
    output_dir.mkdir(parents=True, exist_ok=True)

    log.info("━━━ Processing: %s ━━━", product_name)

    # ── 1. Upload source image ────────────────────────────────────────────────
    try:
        init_image_id, cdn_url = upload_image(product_path, config.api_key)
        log.info("[%s] Uploaded source image (id=%s, url=%s)", product_name, init_image_id, cdn_url)
    except Exception as exc:
        log.error("[%s] Upload failed — skipping. Reason: %s", product_name, exc)
        return []

    # ── 2. Build per-variation prompts ────────────────────────────────────────
    if config.mode == "scene":
        prompts = get_scene_prompts(
            config.category,
            n=config.num_images,
            base_prompt=custom_prompt,
        )
    else:
        prompts = get_prompts(
            config.category,
            n=config.num_images,
            base_prompt=custom_prompt,
        )

    # ── 3. Generate one image per prompt ─────────────────────────────────────
    image_urls: list[str] = []
    for idx, prompt in enumerate(prompts, start=1):
        msg = f"Generating variation {idx}/{config.num_images}…"
        log.info("[%s] %s", product_name, msg)
        if on_progress:
            on_progress(idx, config.num_images, msg)

        try:
            if config.mode == "scene":
                generation_id = start_scene_generation(
                    image_url=cdn_url,
                    prompt=prompt,
                    api_key=config.api_key,
                )
            else:
                generation_id = start_generation(
                    init_image_id=init_image_id,
                    prompt=prompt,
                    api_key=config.api_key,
                    num_images=1,
                    width=config.width,
                    height=config.height,
                    guidance_scale=config.guidance_scale,
                    init_strength=config.init_strength,
                )
            urls = poll_generation(generation_id, config.api_key)
            image_urls.extend(urls)
            log.info("[%s] Variation %d ready (%d URL(s))", product_name, idx, len(urls))
        except Exception as exc:
            log.error(
                "[%s] Generation %d/%d failed — skipping. Reason: %s",
                product_name, idx, config.num_images, exc,
            )

    if not image_urls:
        log.error("[%s] No images generated — skipping watermark step.", product_name)
        return []

    # ── 4. Download & watermark ───────────────────────────────────────────────
    saved: list[str] = []
    for img_idx, url in enumerate(image_urls, start=1):
        raw_path = output_dir / f"_raw_{img_idx}.jpg"
        final_path = output_dir / f"img_{img_idx}.jpg"
        try:
            msg = f"Processing image {img_idx}/{len(image_urls)}…"
            if on_progress:
                on_progress(img_idx, len(image_urls), msg)

            download_image(url, raw_path)
            apply_watermark(raw_path, config.watermark_path, final_path)
            raw_path.unlink()
            log.info("[%s] Saved → %s", product_name, final_path.name)
            yield str(final_path)
        except Exception as exc:
            log.error("[%s] Failed to save image %d. Reason: %s", product_name, img_idx, exc)

    log.info("[%s] Done processing product.", product_name)
