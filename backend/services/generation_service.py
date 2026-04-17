"""
backend/services/generation_service.py
Background task: download inputs → run pipeline → upload outputs → update DB.
"""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse

import httpx

# ── Ensure project root is on sys.path so src.* imports work ──────────────────
_PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(_PROJECT_ROOT))

from src.pipeline import process_images
from src.config import load_config
from src.logger import get_logger
from backend.supabase_client import supabase, INPUT_BUCKET, OUTPUT_BUCKET, SUPABASE_URL

log = get_logger()


def run_generation(job_id: str, num_images: int = 3) -> None:
    """
    Full generation pipeline for one job.
    Called as a background task by FastAPI.
    """
    log.info("[job %s] Generation started", job_id)

    # ── Mark job as processing ────────────────────────────────────────────────
    supabase.table("jobs").update({"status": "processing"}).eq("id", job_id).execute()

    try:
        # ── Fetch job metadata ────────────────────────────────────────────────
        job_row = (
            supabase.table("jobs").select("*").eq("id", job_id).single().execute()
        ).data
        category: str = job_row["category"]
        custom_prompt: str | None = job_row.get("prompt") or None
        # Honour per-job num_images; fall back to the value passed in (which itself defaults to 3)
        job_num_images: int = int(job_row.get("num_images") or num_images)

        # ── Fetch input image URLs from DB ────────────────────────────────────
        input_rows = (
            supabase.table("images")
            .select("url")
            .eq("job_id", job_id)
            .eq("type", "input")
            .execute()
        ).data
        if not input_rows:
            raise ValueError("No input images found for job")

        input_urls = [r["url"] for r in input_rows]

        # ── Download input images to temp dir ─────────────────────────────────
        with tempfile.TemporaryDirectory(prefix=f"clutches_{job_id}_") as tmpdir:
            tmp_path = Path(tmpdir)
            input_dir = tmp_path / "input"
            output_dir = tmp_path / "output"
            input_dir.mkdir()
            output_dir.mkdir()

            local_input_paths: list[Path] = []
            for idx, url in enumerate(input_urls):
                ext = url.split(".")[-1].split("?")[0] or "jpg"
                dest = input_dir / f"product_{idx}.{ext}"
                _download_file(url, dest)
                local_input_paths.append(dest)

            # ── Build pipeline Config ─────────────────────────────────────────
            api_key = os.getenv("LEONARDO_API_KEY", "")
            if not api_key:
                raise EnvironmentError("LEONARDO_API_KEY is not set")

            # Resolve watermark
            watermark_path = _PROJECT_ROOT / "watermarks" / "watermark.png"
            wm = str(watermark_path) if watermark_path.is_file() else None

            config = load_config(
                input_dir=str(input_dir),
                output_dir=str(output_dir),
                category=category,
                watermark=wm,
                num_images=job_num_images,
                mode=job_row.get("mode", "scene")
            )

            def on_progress(current: int, total: int, msg: str):
                try:
                    supabase.table("jobs").update({"status_message": msg}).eq("id", job_id).execute()
                except Exception:
                    pass  # status_message might not exist in DB yet

            # ── Run pipeline and upload outputs incrementally ────────────────
            uploaded_count = 0
            for local_path in process_images(local_input_paths, config, custom_prompt, on_progress):
                file_name = Path(local_path).name
                file_key = f"{job_id}/{file_name}"
                
                with open(local_path, "rb") as fh:
                    supabase.storage.from_(OUTPUT_BUCKET).upload(
                        file_key,
                        fh.read(),
                        {"content-type": "image/jpeg", "upsert": "true"},
                    )

                public_url = f"{SUPABASE_URL}/storage/v1/object/public/{OUTPUT_BUCKET}/{file_key}"
                supabase.table("images").insert(
                    {
                        "job_id": job_id,
                        "type": "output",
                        "url": public_url,
                    }
                ).execute()
                uploaded_count += 1

            if uploaded_count == 0:
                raise RuntimeError("Pipeline produced no output images")

            supabase.table("jobs").update({
                "status": "completed",
                "status_message": "Generation complete"
            }).eq("id", job_id).execute()
            log.info("[job %s] Completed — %d image(s) uploaded", job_id, uploaded_count)

    except Exception as exc:
        log.exception("[job %s] Generation failed: %s", job_id, exc)
        supabase.table("jobs").update({"status": "failed"}).eq("id", job_id).execute()


def _download_file(url: str, dest: Path) -> None:
    """
    Download a file URL to disk.

    Prefer the Supabase Storage SDK when the URL points at our Supabase project,
    because buckets may not be public (and public endpoints can return 400/401).
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme in ("http", "https") and url.startswith(SUPABASE_URL):
            # Expected forms:
            #   /storage/v1/object/public/<bucket>/<path>
            #   /storage/v1/object/sign/<bucket>/<path>
            # We want "<path>" (object key inside the bucket).
            path = unquote(parsed.path)
            public_prefix = f"/storage/v1/object/public/{INPUT_BUCKET}/"
            sign_prefix = f"/storage/v1/object/sign/{INPUT_BUCKET}/"

            if path.startswith(public_prefix):
                object_key = path[len(public_prefix):]
                data = supabase.storage.from_(INPUT_BUCKET).download(object_key)
                dest.write_bytes(data)
                return

            if path.startswith(sign_prefix):
                # Some signed URLs include extra segments; still treat remainder as key.
                object_key = path[len(sign_prefix):]
                data = supabase.storage.from_(INPUT_BUCKET).download(object_key)
                dest.write_bytes(data)
                return
    except Exception:
        # Fall back to plain HTTP below.
        pass

    with httpx.Client(timeout=60) as client:
        resp = client.get(url)
        resp.raise_for_status()
        dest.write_bytes(resp.content)
