"""
backend/api/jobs.py
All HTTP endpoints for the Clutches and More image generation API.
"""
from __future__ import annotations

import io
import re
import unicodedata
import zipfile
from typing import List

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.supabase_client import supabase, INPUT_BUCKET, OUTPUT_BUCKET, SUPABASE_URL
from backend.services.generation_service import run_generation

router = APIRouter()

_INVALID_KEY_CHARS = re.compile(r"[^A-Za-z0-9._-]+")
_WHITESPACE = re.compile(r"\s+")


def _sanitize_storage_filename(filename: str) -> str:
    """
    Supabase Storage rejects some object keys (e.g. unicode whitespace).
    Keep a conservative ASCII allowlist and preserve extension when possible.
    """
    name = unicodedata.normalize("NFKC", filename).strip()
    name = _WHITESPACE.sub("_", name)
    name = _INVALID_KEY_CHARS.sub("_", name)
    name = re.sub(r"_+", "_", name).strip("._-")
    if not name:
        return "product.jpg"

    # Prevent path tricks and excessively long names.
    name = name.replace("/", "_").replace("\\", "_")
    return name[:180]


# ─── Request / Response models ─────────────────────────────────────────────────

class CreateJobRequest(BaseModel):
    prompt: str
    category: str   # "bags" | "jewelry"
    num_images: int = 3
    mode: str = "scene" # "scene" | "model"


class JobResponse(BaseModel):
    id: str
    prompt: str
    category: str
    status: str
    created_at: str
    mode: str = "scene"
    input_images: List[str] = []
    output_images: List[str] = []


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/job")
async def create_job(body: CreateJobRequest):
    """Create a new job row in Supabase. Returns job_id."""
    if body.category not in ("bags", "jewelry"):
        raise HTTPException(status_code=400, detail="category must be 'bags' or 'jewelry'")

    if body.mode not in ("model", "scene"):
        raise HTTPException(status_code=400, detail="mode must be 'model' or 'scene'")

    result = supabase.table("jobs").insert(
        {"prompt": body.prompt, "category": body.category, "status": "pending", "num_images": body.num_images, "mode": body.mode}
    ).execute()

    job = result.data[0]
    return {"job_id": job["id"], "status": job["status"]}


@router.post("/upload/{job_id}")
async def upload_images(job_id: str, files: List[UploadFile] = File(...)):
    """Upload one or more product images for a job to Supabase Storage."""
    _assert_job_exists(job_id)

    uploaded_urls = []
    for file in files:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"File {file.filename} is not an image")

        raw_name = file.filename or "product.jpg"
        ext = raw_name.rsplit(".", 1)[-1].lower()
        safe_name = _sanitize_storage_filename(raw_name)

        # If sanitization removed the extension entirely, add a best-effort one.
        if "." not in safe_name and ext:
            safe_name = f"{safe_name}.{ext}"

        file_key = f"{job_id}/{safe_name}"
        content = await file.read()

        supabase.storage.from_(INPUT_BUCKET).upload(
            file_key,
            content,
            {"content-type": file.content_type, "upsert": "true"},
        )

        public_url = f"{SUPABASE_URL}/storage/v1/object/public/{INPUT_BUCKET}/{file_key}"
        supabase.table("images").insert(
            {"job_id": job_id, "type": "input", "url": public_url}
        ).execute()
        uploaded_urls.append(public_url)

    return {"job_id": job_id, "uploaded": len(uploaded_urls), "urls": uploaded_urls}


@router.post("/generate/{job_id}")
async def generate(job_id: str, background_tasks: BackgroundTasks):
    """Kick off background generation for a job."""
    _assert_job_exists(job_id)

    # Verify there are input images
    images = (
        supabase.table("images")
        .select("id")
        .eq("job_id", job_id)
        .eq("type", "input")
        .execute()
    ).data
    if not images:
        raise HTTPException(status_code=400, detail="No input images uploaded for this job")

    job_row = _get_job_row(job_id)
    num_images = job_row.get("num_images") or 3
    background_tasks.add_task(run_generation, job_id, num_images)
    return {"job_id": job_id, "status": "processing"}


@router.get("/jobs")
async def list_jobs():
    """Return all jobs ordered by created_at DESC."""
    result = (
        supabase.table("jobs")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return {"jobs": result.data}


@router.post("/job/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a pending or processing job by marking it as failed."""
    job = _get_job_row(job_id)
    if job["status"] not in ("pending", "processing"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel a job with status '{job['status']}'",
        )
    supabase.table("jobs").update({"status": "failed"}).eq("id", job_id).execute()
    return {"job_id": job_id, "status": "failed"}


@router.delete("/job/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and all its associated images from DB and Storage."""
    _assert_job_exists(job_id)

    # Fetch all image rows so we can remove storage objects too
    images = (
        supabase.table("images").select("url, type").eq("job_id", job_id).execute()
    ).data

    # Delete storage objects (best-effort; don't raise on failures)
    for row in images:
        try:
            bucket = INPUT_BUCKET if row["type"] == "input" else OUTPUT_BUCKET
            marker = f"/{bucket}/"
            idx = row["url"].find(marker)
            if idx != -1:
                object_key = row["url"][idx + len(marker):].split("?")[0]
                supabase.storage.from_(bucket).remove([object_key])
        except Exception:
            pass

    # Delete image rows, then job row
    supabase.table("images").delete().eq("job_id", job_id).execute()
    supabase.table("jobs").delete().eq("id", job_id).execute()

    return {"deleted": job_id}


@router.get("/job/{job_id}")
async def get_job(job_id: str):
    """Return full job detail including signed input and output image URLs."""
    job = _get_job_row(job_id)

    images = (
        supabase.table("images").select("*").eq("job_id", job_id).execute()
    ).data

    input_imgs = [_sign_url(r["url"], INPUT_BUCKET) for r in images if r["type"] == "input"]
    output_imgs = [_sign_url(r["url"], OUTPUT_BUCKET) for r in images if r["type"] == "output"]

    return {
        **job,
        "input_images": input_imgs,
        "output_images": output_imgs,
    }


@router.get("/download/{job_id}")
async def download_zip(job_id: str):
    """Download all output images for a job as a ZIP archive."""
    _assert_job_exists(job_id)

    output_rows = (
        supabase.table("images")
        .select("url")
        .eq("job_id", job_id)
        .eq("type", "output")
        .execute()
    ).data

    if not output_rows:
        raise HTTPException(status_code=404, detail="No output images found for this job")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        async with httpx.AsyncClient(timeout=60) as client:
            for idx, row in enumerate(output_rows, start=1):
                resp = await client.get(row["url"])
                resp.raise_for_status()
                zf.writestr(f"img_{idx}.jpg", resp.content)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="job_{job_id[:8]}_images.zip"'},
    )


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _get_job_row(job_id: str) -> dict:
    result = supabase.table("jobs").select("*").eq("id", job_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    return result.data[0]


def _assert_job_exists(job_id: str) -> None:
    _get_job_row(job_id)


def _sign_url(stored_url: str, bucket: str, expires_in: int = 3600) -> str:
    """
    Convert a stored Supabase Storage URL into a fresh 1-hour signed URL.
    Falls back to the original URL if signing fails.
    """
    try:
        # Extract the object key — the part after "/<bucket>/"
        marker = f"/{bucket}/"
        idx = stored_url.find(marker)
        if idx == -1:
            return stored_url
        object_key = stored_url[idx + len(marker):].split("?")[0]  # strip query params

        result = supabase.storage.from_(bucket).create_signed_url(object_key, expires_in)
        # supabase-py v1 returns a dict; v2 returns an object
        if isinstance(result, dict):
            return result.get("signedURL") or result.get("signed_url") or stored_url
        return getattr(result, "signed_url", None) or stored_url
    except Exception:
        return stored_url


