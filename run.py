#!/usr/bin/env python3
"""
run.py — CLI entry point for the Clutches and More image generation pipeline.

Usage:
    python run.py --input ./input --output ./output --category bags
    python run.py --input ./input --output ./output --category jewelry --num-images 4
    python run.py --help
"""
import argparse
import sys

from src.config import load_config
from src.pipeline import process_all_products
from src.logger import get_logger

log = get_logger()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="run.py",
        description=(
            "Clutches and More — Automated product image generator.\n"
            "Generates realistic model photos from product images using Leonardo AI."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run.py --input ./input --category bags
  python run.py --input ./input --output ./output --category jewelry --num-images 4
  python run.py --input ./input --category bags --watermark ./watermarks/logo.png
        """,
    )

    parser.add_argument(
        "--input", "-i",
        default="./input",
        metavar="DIR",
        help="Folder containing product images (default: ./input)",
    )
    parser.add_argument(
        "--output", "-o",
        default="./output",
        metavar="DIR",
        help="Folder to save generated images (default: ./output)",
    )
    parser.add_argument(
        "--category", "-c",
        required=True,
        choices=["bags", "jewelry"],
        help="Product category: 'bags' or 'jewelry'",
    )
    parser.add_argument(
        "--mode", "-m",
        default="model",
        choices=["model", "scene"],
        help="Generation mode: 'model' (model photo) or 'scene' (place into new scene). Default: model.",
    )
    parser.add_argument(
        "--num-images", "-n",
        type=int,
        default=5,
        dest="num_images",
        metavar="N",
        help="Number of images to generate per product (default: 5)",
    )
    parser.add_argument(
        "--watermark", "-w",
        default=None,
        metavar="FILE",
        help="Path to a PNG watermark file (optional; uses text watermark if omitted)",
    )

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    log.info("=" * 60)
    log.info("Clutches and More — Image Generation Pipeline")
    log.info("  Mode     : %s", args.mode)
    log.info("  Category : %s", args.category)
    log.info("  Input dir: %s", args.input)
    log.info("  Output   : %s", args.output)
    log.info("  Images   : %d per product", args.num_images)
    log.info("=" * 60)

    try:
        config = load_config(
            input_dir=args.input,
            output_dir=args.output,
            category=args.category,
            watermark=args.watermark,
            num_images=args.num_images,
            mode=args.mode,
        )
    except (EnvironmentError, FileNotFoundError, ValueError) as exc:
        log.error("Configuration error: %s", exc)
        sys.exit(1)

    try:
        process_all_products(config)
    except KeyboardInterrupt:
        log.warning("Pipeline interrupted by user.")
        sys.exit(130)
    except Exception as exc:
        log.exception("Unexpected error: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
