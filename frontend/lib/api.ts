// Typed API wrappers for the FastAPI backend

import type { Job, CreateJobResponse, UploadResponse } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type RequestOptions = {
    signal?: AbortSignal;
};

export async function createJob(prompt: string, category: string, numImages: number = 3): Promise<CreateJobResponse> {
    const res = await fetch(`${API_BASE}/job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, category, num_images: numImages }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function uploadImages(jobId: string, files: File[]): Promise<UploadResponse> {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    const res = await fetch(`${API_BASE}/upload/${jobId}`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function triggerGeneration(jobId: string) {
    const res = await fetch(`${API_BASE}/generate/${jobId}`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getJob(jobId: string, opts: RequestOptions = {}): Promise<Job> {
    const res = await fetch(`${API_BASE}/job/${jobId}`, { signal: opts.signal });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function listJobs(opts: RequestOptions = {}): Promise<Job[]> {
    const res = await fetch(`${API_BASE}/jobs`, { signal: opts.signal });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.jobs ?? [];
}

export function downloadZipUrl(jobId: string): string {
    return `${API_BASE}/download/${jobId}`;
}

export async function deleteJob(jobId: string): Promise<{ deleted: string }> {
    const res = await fetch(`${API_BASE}/job/${jobId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function cancelJob(jobId: string): Promise<{ job_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/job/${jobId}/cancel`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
