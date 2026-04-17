"""
src/logger.py
Sets up a unified logger that writes to both console and pipeline.log.
"""
import logging
import os
from pathlib import Path


LOG_FILE = Path(__file__).parent.parent / "pipeline.log"


def get_logger(name: str = "clutches_pipeline") -> logging.Logger:
    """Return a configured logger. Safe to call multiple times."""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger  # Already configured

    logger.setLevel(logging.DEBUG)
    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Console handler (INFO and above)
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(fmt)
    logger.addHandler(ch)

    # File handler (DEBUG and above)
    fh = logging.FileHandler(LOG_FILE, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    return logger
