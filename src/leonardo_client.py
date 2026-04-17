"""
src/leonardo_client.py
Thin wrapper around the Leonardo AI REST API.

Covers:
  - Image upload (init-image)
  - Image generation (image-to-image via init strength)
  - Generation polling (status check)
  - Image download
All network calls are retried automatically via tenacity.
"""
from __future__ import annotations

import json
import time
import mimetypes
from pathlib import Path

import requests
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from src.config import (
    LEONARDO_BASE_URL,
    LEONARDO_MODEL_ID,
    LEONARDO_PHOENIX_MODEL_ID,
    DEFAULT_GUIDANCE_SCALE,
    DEFAULT_INIT_STRENGTH,
    DEFAULT_SCHEDULER,
    RETRY_ATTEMPTS,
    RETRY_WAIT_SECONDS,
    POLL_INTERVAL_SECONDS,
    POLL_MAX_WAIT_SECONDS,
    SCENE_CONTRAST,
)
from src.prompts import NEGATIVE_PROMPT
from src.logger import get_logger

log = get_logger()

_RETRYABLE = (requests.ConnectionError, requests.Timeout)


def _headers(api_key: str) -> dict:
    return {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }


# ─── Upload source image ───────────────────────────────────────────────────────

@retry(
    stop=stop_after_attempt(RETRY_ATTEMPTS),
    wait=wait_exponential(multiplier=RETRY_WAIT_SECONDS, min=RETRY_WAIT_SECONDS),
    retry=retry_if_exception_type(_RETRYABLE),
    before_sleep=before_sleep_log(log, 20),  # 20 = logging.DEBUG
    reraise=True,
)
def upload_image(image_path: Path, api_key: str) -> tuple[str, str]:
    """
    Upload a local image to Leonardo as an init-image.
    Returns (init_image_id, image_cdn_url).
    """
    url = f"{LEONARDO_BASE_URL}/init-image"

    # Step 1 — request a presigned S3 URL
    mime, _ = mimetypes.guess_type(str(image_path))
    mime = mime or "image/jpeg"
    # Leonardo expects common lowercase extensions (no dot), e.g. "jpg", "png".
    ext = image_path.suffix.lstrip(".").lower() or "jpg"

    log.debug("Requesting presigned upload URL for %s", image_path.name)
    resp = requests.post(
        url,
        headers=_headers(api_key),
        json={"extension": ext},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()

    upload_url: str = data["uploadInitImage"]["url"]
    fields = data["uploadInitImage"]["fields"]
    init_image_id: str = data["uploadInitImage"]["id"]

    # Leonardo sometimes returns `fields` as a JSON string; requests requires a mapping.
    if isinstance(fields, str):
        try:
            fields = json.loads(fields)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Leonardo init-image upload fields were a string but not valid JSON: {fields!r}") from exc

    if not isinstance(fields, dict):
        raise RuntimeError(f"Leonardo init-image upload fields must be a dict, got {type(fields).__name__}: {fields!r}")

    # Step 2 — upload the file to S3
    # Leonardo can return either presigned POST fields (multipart/form-data) or a bare URL for PUT.
    log.debug("Uploading image to S3 (%s)…", image_path.name)
    with open(image_path, "rb") as fh:
        try:
            is_presigned_post = any(k in fields for k in ("key", "policy", "x-amz-signature", "x-amz-credential", "x-amz-algorithm"))
            if is_presigned_post:
                files = {"file": (image_path.name, fh, mime)}
                s3_resp = requests.post(upload_url, data=fields, files=files, timeout=60)
            else:
                # Some providers return a presigned PUT URL and expect raw bytes.
                s3_resp = requests.put(upload_url, data=fh, headers={"Content-Type": mime}, timeout=60)

            if not s3_resp.ok:
                raise RuntimeError(
                    f"S3 upload failed ({s3_resp.status_code}). "
                    f"Response: {s3_resp.text[:500]!r}. "
                    f"upload_url={upload_url!r} fields_keys={sorted(list(fields.keys()))!r}"
                )
        except requests.HTTPError:
            raise
        except Exception as exc:
            # Provide context for debugging S3 field mismatches without leaking secrets.
            raise RuntimeError(
                f"S3 upload failed. upload_url={upload_url!r} fields_keys={sorted(list(fields.keys()))!r}. Error: {exc}"
            ) from exc

    cdn_url = f"https://cdn.leonardo.ai/{fields['key']}"

    log.debug("Upload complete. init_image_id=%s, url=%s", init_image_id, cdn_url)
    return init_image_id, cdn_url


# ─── Start generation ──────────────────────────────────────────────────────────

@retry(
    stop=stop_after_attempt(RETRY_ATTEMPTS),
    wait=wait_exponential(multiplier=RETRY_WAIT_SECONDS, min=RETRY_WAIT_SECONDS),
    retry=retry_if_exception_type(_RETRYABLE),
    before_sleep=before_sleep_log(log, 20),
    reraise=True,
)
def start_generation(
    init_image_id: str,
    prompt: str,
    api_key: str,
    num_images: int = 1,
    width: int = 1024,
    height: int = 1024,
    guidance_scale: int = DEFAULT_GUIDANCE_SCALE,
    init_strength: float = DEFAULT_INIT_STRENGTH,
) -> str:
    """
    Start an image-to-image generation job.
    Returns the generation_id string.
    """
    url = f"{LEONARDO_BASE_URL}/generations"

    payload = {
        "modelId": LEONARDO_MODEL_ID,
        "prompt": prompt,
        "negative_prompt": NEGATIVE_PROMPT,
        "num_images": num_images,
        "width": width,
        "height": height,
        "guidance_scale": guidance_scale,
        "scheduler": DEFAULT_SCHEDULER,
        "alchemy": True,
        "photoReal": True,
        "photoRealVersion": "v2",
        "highContrast": False,
        "presetStyle": "CINEMATIC",
        # Image-to-image settings
        "init_image_id": init_image_id,
        "init_strength": init_strength,
    }

    log.debug("Starting generation: prompt snippet = %.80s…", prompt)
    resp = requests.post(url, headers=_headers(api_key), json=payload, timeout=60)
    if not resp.ok:
        raise RuntimeError(
            f"Leonardo /generations failed ({resp.status_code}). "
            f"Response: {resp.text[:1000]!r}"
        )
    generation_id: str = resp.json()["sdGenerationJob"]["generationId"]
    log.debug("Generation started. generation_id=%s", generation_id)
    return generation_id


    return generation_id


@retry(
    stop=stop_after_attempt(RETRY_ATTEMPTS),
    wait=wait_exponential(multiplier=RETRY_WAIT_SECONDS, min=RETRY_WAIT_SECONDS),
    retry=retry_if_exception_type(_RETRYABLE),
    before_sleep=before_sleep_log(log, 20),
    reraise=True,
)
def start_scene_generation(
    image_url: str,
    prompt: str,
    api_key: str,
) -> str:
    """
    Execute the 'Product Photography' blueprint.
    Returns the generation_id triggered by the execution.
    """
    url = f"{LEONARDO_BASE_URL}/blueprint-executions"

    payload = {
        "blueprintVersionId": "ef51b59d-1734-4c92-abb0-6f66a4e33cb3",
        "input": {
            "public": False,
            "nodeInputs": [
                {
                    "nodeId": "c5cef162-0d59-4a13-a8aa-1ae881e62f85",
                    "settingName": "imageUrl",
                    "value": image_url
                },
                {
                    "nodeId": "238ea0da-49ef-45d7-bf67-7066eab6a547",
                    "settingName": "textVariables",
                    "value": [
                        {"name": "environment", "value": prompt[:200]}
                    ]
                }
            ]
        }
    }

    log.debug("Starting blueprint execution: prompt snippet = %.80s…", prompt)
    resp = requests.post(url, headers=_headers(api_key), json=payload, timeout=60)
    
    if not resp.ok:
        raise RuntimeError(f"Leonardo blueprint execution failed ({resp.status_code}): {resp.text[:1000]}")
        
    resp_data = resp.json()
    if isinstance(resp_data, list):
        # Leonardo validation errors return HTTP 200 but as a List
        raise RuntimeError(f"Leonardo blueprint execution explicitly rejected the payload: {json.dumps(resp_data)}")

    execution_id = resp_data["executeBlueprint"]["akUUID"]
    log.debug("Blueprint execution started. execution_id=%s", execution_id)
    
    # Poll until generation_id is assigned
    poll_url = f"{LEONARDO_BASE_URL}/blueprint-executions/{execution_id}/generations"
    for _ in range(60):
        time.sleep(2)
        p_resp = requests.get(poll_url, headers=_headers(api_key))
        if not p_resp.ok:
            continue
            
        edges = p_resp.json().get("blueprintExecutionGenerations", {}).get("edges", [])
        if edges:
            node = edges[0].get("node", {})
            if node.get("status") == "FAILED":
                raise RuntimeError(f"Blueprint execution failed: {node.get('failedReason')}")
            gen_id = node.get("generationId")
            if gen_id:
                return gen_id
                
    raise RuntimeError("Timed out waiting for generation_id from blueprint execution.")


# ─── Poll until complete ───────────────────────────────────────────────────────

def poll_generation(generation_id: str, api_key: str) -> list[str]:
    """
    Block until the generation is complete (or timeout).
    Returns a list of image URLs.
    """
    url = f"{LEONARDO_BASE_URL}/generations/{generation_id}"
    deadline = time.time() + POLL_MAX_WAIT_SECONDS

    while time.time() < deadline:
        resp = requests.get(url, headers=_headers(api_key), timeout=30)
        resp.raise_for_status()
        data = resp.json()["generations_by_pk"]
        status: str = data["status"]

        if status == "COMPLETE":
            urls = [img["url"] for img in data["generated_images"]]
            log.debug("Generation complete. %d image(s) ready.", len(urls))
            return urls

        if status == "FAILED":
            raise RuntimeError(f"Leonardo generation {generation_id} FAILED.")

        log.debug("Generation status=%s — waiting %ds…", status, POLL_INTERVAL_SECONDS)
        time.sleep(POLL_INTERVAL_SECONDS)

    raise TimeoutError(
        f"Generation {generation_id} did not complete within "
        f"{POLL_MAX_WAIT_SECONDS}s."
    )


# ─── Download a single image ───────────────────────────────────────────────────

@retry(
    stop=stop_after_attempt(RETRY_ATTEMPTS),
    wait=wait_exponential(multiplier=RETRY_WAIT_SECONDS, min=RETRY_WAIT_SECONDS),
    retry=retry_if_exception_type(_RETRYABLE),
    reraise=True,
)
def download_image(url: str, dest_path: Path) -> None:
    """Download a remote image URL to a local file."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    log.debug("Downloading %s → %s", url, dest_path)
    resp = requests.get(url, stream=True, timeout=60)
    resp.raise_for_status()
    with open(dest_path, "wb") as fh:
        for chunk in resp.iter_content(chunk_size=8192):
            fh.write(chunk)
