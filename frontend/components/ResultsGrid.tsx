'use client';

import { Download, Sparkles, X, ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import { useState, useEffect } from 'react';
import { downloadZipUrl } from '@/lib/api';
import type { Job } from '@/lib/types';
import { getDisplayStatus } from '@/lib/types';

interface ResultsGridProps {
    job: Job;
}

const FALLBACK_MESSAGES = [
    'Initializing creative engine…',
    'Analyzing product details…',
    'Synthesizing model poses…',
    'Applying studio lighting…',
    'Calibrating skin textures…',
    'Enhancing depth and shadows…',
    'Rendering final photos…',
];

const CATEGORY_LABEL: Record<string, string> = {
    bags: 'Bags & Clutches',
    jewelry: 'Jewelry',
};

export default function ResultsGrid({ job }: ResultsGridProps) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [simulatedOffset, setSimulatedOffset] = useState(0);
    const [promptExpanded, setPromptExpanded] = useState(false);

    const images = job.output_images || [];
    const inputImages = job.input_images || [];
    // Lightbox navigates only over output images (not input)
    const lightboxImages = images;

    // Keyboard nav for lightbox
    useEffect(() => {
        if (lightboxIndex === null) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') setLightboxIndex((p) => (p !== null && p < lightboxImages.length - 1 ? p + 1 : p));
            else if (e.key === 'ArrowLeft') setLightboxIndex((p) => (p !== null && p > 0 ? p - 1 : p));
            else if (e.key === 'Escape') setLightboxIndex(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxIndex, lightboxImages.length]);

    // Simulated micro-progress between real checkpoints
    useEffect(() => {
        if (job.status !== 'processing' && job.status !== 'pending') return;
        const interval = setInterval(() => {
            setSimulatedOffset((prev) => (prev > 8 ? prev : prev + 0.2));
        }, 500);
        return () => { clearInterval(interval); setSimulatedOffset(0); };
    }, [job.status, images.length]);

    const displayStatus = getDisplayStatus(job);

    // ── Processing state ─────────────────────────────────────────────────
    if (displayStatus === 'processing' || displayStatus === 'pending') {
        const completedCount = images.length;
        const totalCount = job.num_images || 1;
        const baseProgress = (completedCount / totalCount) * 100;
        const displayProgress = Math.min(98, Math.floor(baseProgress + (displayStatus === 'processing' ? simulatedOffset : 0)));
        const currentMessage = job.status_message || FALLBACK_MESSAGES[Math.min(completedCount, FALLBACK_MESSAGES.length - 1)];

        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 gap-10 max-w-sm mx-auto">
                {/* Progress bar */}
                <div className="w-full space-y-2">
                    <div className="flex items-center justify-between text-[12px] font-semibold tabular-nums">
                        <span className="text-foreground">
                            {completedCount > 0 ? `${completedCount} of ${totalCount} generated` : 'Starting…'}
                        </span>
                        <span className="text-[color:var(--color-accent)]">{displayProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-surface-2 border border-border rounded-full overflow-hidden">
                        <div
                            className="h-full bg-accent rounded-full relative transition-all duration-700 ease-out"
                            style={{ width: `${displayProgress}%` }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                        </div>
                    </div>
                </div>

                {/* Status message */}
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-10 h-10 rounded-2xl bg-[color:color-mix(in_oklch,var(--color-accent)_10%,transparent)] border border-[color:color-mix(in_oklch,var(--color-accent)_20%,var(--color-border))] flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-[color:var(--color-accent)] animate-pulse" />
                    </div>
                    <p key={currentMessage} className="text-[13px] font-medium text-secondary animate-fade-in-up">
                        {currentMessage}
                    </p>
                </div>

                {/* Live thumbnail strip */}
                {images.length > 0 && (
                    <div className="w-full animate-fade-in">
                        <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2 text-center">
                            Live results
                        </p>
                        <div className="flex gap-2 justify-center">
                            {images.map((url, i) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={i} src={url} alt="" className="w-12 h-12 rounded-xl object-cover border border-border shadow-sm" />
                            ))}
                            <div className="w-12 h-12 rounded-xl bg-surface-2 border border-dashed border-border flex items-center justify-center">
                                <div className="w-4 h-4 border-2 border-border border-t-[color:var(--color-accent)] rounded-full animate-spin" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── Failed state (no images at all) ──────────────────────────────────
    if (displayStatus === 'failed') {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[color:color-mix(in_oklch,var(--color-danger)_10%,transparent)] border border-[color:color-mix(in_oklch,var(--color-danger)_20%,var(--color-border))] flex items-center justify-center">
                    <X className="w-5 h-5 text-[color:var(--color-danger)]" />
                </div>
                <div>
                    <p className="text-[14px] font-semibold text-foreground">Generation failed</p>
                    <p className="text-[13px] text-muted mt-1 max-w-[40ch]">
                        Something went wrong. Check your settings and try again.
                    </p>
                </div>
            </div>
        );
    }

    // ── Results view ─────────────────────────────────────────────────────
    const catLabel = CATEGORY_LABEL[job.category] ?? job.category;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* ── Page summary header (replaces raw prompt) ── */}
            <div className="space-y-1.5">
                <h1 className="text-[18px] font-bold text-foreground tracking-tight">
                    {catLabel} · {images.length} photo{images.length !== 1 ? 's' : ''}
                </h1>

                {/* Collapsed prompt toggle */}
                <div>
                    <button
                        type="button"
                        onClick={() => setPromptExpanded((v) => !v)}
                        className="focus-ring inline-flex items-center gap-1 text-[12px] hover:text-secondary transition-colors"
                    >
                        {promptExpanded ? 'Hide prompt ↑' : 'View prompt ↓'}
                    </button>
                    {promptExpanded && (
                        <p className="mt-2 text-[12px] text-secondary leading-relaxed bg-surface-2 border border-border rounded-xl px-4 py-3 animate-fade-in">
                            {job.prompt}
                        </p>
                    )}
                </div>
            </div>

            {/* ── Partial-failure banner ── */}
            {displayStatus === 'partial' && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-[13px] border
                  bg-[color:color-mix(in_oklch,var(--color-warning)_8%,transparent)]
                  border-[color:color-mix(in_oklch,var(--color-warning)_22%,var(--color-border))]"
                >
                    <span className="text-[color:var(--color-warning)] mt-0.5 text-base leading-none">⚠</span>
                    <span className="text-secondary">
                        Generation stopped early — showing {images.length} available photo{images.length !== 1 ? 's' : ''}.
                    </span>
                </div>
            )}

            {/* ── Source photos (enlarged, with label) ── */}
            {inputImages.length > 0 && (
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5">
                        Original photo{inputImages.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                        {inputImages.map((url, i) => (
                            <div key={`input-${i}`} className="shrink-0 flex flex-col items-center gap-1.5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={url}
                                    alt={`Original ${i + 1}`}
                                    onClick={() => setLightboxIndex(null)}  /* input images don't open lightbox */
                                    className="w-24 h-24 rounded-xl object-cover border border-border"
                                />
                                <span className="text-[10px] text-muted font-medium">
                                    Original{inputImages.length > 1 ? ` ${i + 1}` : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Header row: count + download all ── */}
            <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-foreground">
                    {images.length} photo{images.length !== 1 ? 's' : ''} generated
                </p>
                <a
                    href={downloadZipUrl(job.id)}
                    download
                    className="focus-ring flex items-center gap-1.5 text-[13px] font-medium text-foreground
                      px-3.5 py-1.5 rounded-xl border border-border bg-white
                      hover:bg-surface-2 hover:border-[color:color-mix(in_oklch,var(--color-accent)_28%,var(--color-border))]
                      transition-all active:scale-[0.98] shadow-xs"
                >
                    <Download className="w-3.5 h-3.5" />
                    Download all
                </a>
            </div>

            {/* ── Image grid: larger cells ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {images.map((url, i) => (
                    <div
                        key={i}
                        className="group relative rounded-2xl overflow-hidden bg-surface-2 border border-border cursor-pointer"
                        style={{ aspectRatio: '1 / 1', minHeight: '240px' }}
                        onClick={() => setLightboxIndex(i)}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={url}
                            alt={`Generated ${i + 1}`}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />

                        {/* Hover overlay — bottom bar with actions */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3 gap-2">
                            {/* Download (primary action) */}
                            <a
                                href={url}
                                download
                                onClick={(e) => e.stopPropagation()}
                                className="focus-ring flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 text-[12px] font-semibold text-foreground hover:bg-white transition-colors shadow-sm"
                            >
                                <Download className="w-3 h-3" />
                                Download
                            </a>
                            {/* Expand (secondary) */}
                            <button
                                type="button"
                                className="focus-ring w-8 h-8 rounded-lg bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/25 transition-colors"
                                onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                            >
                                <Expand className="w-3.5 h-3.5 text-white" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Lightbox ── */}
            {lightboxIndex !== null && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-sm animate-fade-in"
                    onClick={() => setLightboxIndex(null)}
                >
                    {/* Close */}
                    <button
                        type="button"
                        aria-label="Close"
                        className="focus-ring absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-white/20 transition-colors"
                        onClick={() => setLightboxIndex(null)}
                    >
                        <X className="w-4 h-4 text-white" />
                    </button>

                    {/* Counter */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[12px] text-white/60 tabular-nums bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
                        {lightboxIndex + 1} / {lightboxImages.length}
                    </div>

                    {/* Prev */}
                    {lightboxIndex > 0 && (
                        <button
                            type="button"
                            aria-label="Previous image"
                            className="focus-ring absolute left-4 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    )}

                    {/* Next */}
                    {lightboxIndex < lightboxImages.length - 1 && (
                        <button
                            type="button"
                            aria-label="Next image"
                            className="focus-ring absolute right-4 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    )}

                    {/* Download in lightbox */}
                    <a
                        href={lightboxImages[lightboxIndex]}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="focus-ring absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[13px] font-medium text-white hover:bg-white/20 transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Download
                    </a>

                    {/* Image */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={lightboxImages[lightboxIndex]}
                        alt="Preview"
                        className="max-w-[calc(100vw-120px)] max-h-[calc(100vh-100px)] rounded-2xl shadow-2xl object-contain animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
