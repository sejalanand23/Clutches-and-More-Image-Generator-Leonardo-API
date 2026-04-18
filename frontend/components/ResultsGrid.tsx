'use client';

import { Download, ZoomIn, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { downloadZipUrl } from '@/lib/api';
import type { Job } from '@/lib/types';

interface ResultsGridProps {
    job: Job;
}

const FALLBACK_MESSAGES = [
    "Initializing creative engine...",
    "Analyzing product details...",
    "Synthesizing model poses...",
    "Applying studio lighting...",
    "Calibrating skin textures...",
    "Enhancing depth and shadows...",
    "Rendering final photos...",
];

export default function ResultsGrid({ job }: ResultsGridProps) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [simulatedOffset, setSimulatedOffset] = useState(0);

    const images = job.output_images || [];
    const inputImages = job.input_images || [];
    const allImages = [...inputImages, ...images];

    // keyboard nav for lightbox
    useEffect(() => {
        if (lightboxIndex === null) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                setLightboxIndex((prev) => (prev !== null && prev < allImages.length - 1 ? prev + 1 : prev));
            } else if (e.key === 'ArrowLeft') {
                setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
            } else if (e.key === 'Escape') {
                setLightboxIndex(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxIndex, allImages.length]);

    // Simulated micro-progress to make the bar feel alive between real checkpoints
    useEffect(() => {
        if (job.status !== 'processing' && job.status !== 'pending') return;

        const interval = setInterval(() => {
            setSimulatedOffset(prev => {
                // reset or slow down as we approach the next "real" 10% step
                if (prev > 8) return prev; 
                return prev + 0.2;
            });
        }, 500);

        return () => {
            clearInterval(interval);
            setSimulatedOffset(0);
        };
    }, [job.status, images.length]);

    if (job.status === 'processing' || job.status === 'pending') {
        const completedCount = images.length;
        const totalCount = job.num_images || 1;
        
        // Calculate progress based on actually saved images + simulated micro-steps
        const baseProgress = (completedCount / totalCount) * 100;
        // Add a bit of progress if we are "in between" images
        const displayProgress = Math.min(98, Math.floor(baseProgress + (job.status === 'processing' ? simulatedOffset : 0)));
        
        // Use the real log message from backend if available
        const currentMessage = job.status_message || FALLBACK_MESSAGES[Math.min(completedCount, FALLBACK_MESSAGES.length - 1)];

        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 gap-8 max-w-md mx-auto">
                <div className="relative w-full">
                    {/* Background Progress Track */}
                    <div className="h-3 w-full bg-glass border border-border rounded-full overflow-hidden shadow-inner font-mono text-[10px]">
                        {/* Animated Gradient Progress Fill */}
                        <div 
                            className="h-full bg-accent transition-all duration-700 ease-out relative"
                            style={{ width: `${displayProgress}%` }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                        </div>
                    </div>
                    
                    {/* Progress percentage pill */}
                    <div 
                        className="absolute top-[-30px] transition-all duration-700 ease-out transform -translate-x-1/2"
                        style={{ left: `${displayProgress}%` }}
                    >
                        <span className="bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap border border-white/10 tabular-nums">
                            {displayProgress}%
                        </span>
                    </div>
                </div>

                <div className="text-center space-y-3">
                    <div className="flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4 text-accent animate-pulse" />
                        <p className="text-foreground font-semibold text-lg tracking-tight">
                            {completedCount > 0 ? `Generated ${completedCount} of ${totalCount}` : 'Starting generation...'}
                        </p>
                    </div>
                    
                    <div className="h-6 overflow-hidden">
                        <p className="text-accent font-medium text-sm animate-fade-in-up key={currentMessage}">
                            {currentMessage}
                        </p>
                    </div>
                    
                    {images.length > 0 && (
                        <p className="text-faint text-[10px] uppercase tracking-widest font-bold pt-1">
                            Live results appearing below ↓
                        </p>
                    )}
                </div>

                {/* Micro-images preview (if any completed yet) */}
                {images.length > 0 && (
                    <div className="flex gap-2 animate-fade-in-up">
                        {images.map((url, i) => (
                            <img key={i} src={url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border opacity-60 shadow-sm" />
                        ))}
                        <div className="w-10 h-10 rounded-lg bg-glass border border-dashed border-border flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const failedContent = job.status === 'failed' ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mb-2">
                <span className="text-danger text-2xl">×</span>
            </div>
            <p className="text-danger font-semibold">Generation stopped or failed</p>
            <p className="text-faint text-sm">Please check your settings or retry the generation. {images.length > 0 && "Partial results are available below."}</p>
        </div>
    ) : null;

    if (!images.length) {
        return failedContent;
    }

    return (
        <div className="space-y-4">
            {failedContent}

            {/* Input Images Row */}
            {inputImages.length > 0 && (
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-muted">Input Photo{inputImages.length !== 1 ? 's' : ''}</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {inputImages.map((url, i) => (
                            <img
                                key={`input-${i}`}
                                src={url}
                                alt={`Input ${i + 1}`}
                                onClick={() => setLightboxIndex(i)}
                                className="w-16 h-16 shrink-0 rounded-xl object-cover opacity-60 hover:opacity-100 cursor-pointer transition-opacity"
                            />
                        ))}
                    </div>
                </div>
            )}
            
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted">
                    {images.length} photo{images.length !== 1 ? 's' : ''} generated
                </p>
                <a
                    href={downloadZipUrl(job.id)}
                    download
                    className="focus-ring flex items-center gap-1.5 text-xs text-foreground px-3 py-1.5 rounded-lg transition-all active:translate-y-px border border-border
                      bg-[color:color-mix(in_oklch,var(--color-accent)_10%,transparent)]
                      hover:bg-[color:color-mix(in_oklch,var(--color-accent)_14%,transparent)]
                      border-[color:color-mix(in_oklch,var(--color-accent)_22%,var(--color-border))]"
                >
                    <Download className="w-3.5 h-3.5" />
                    Download All
                </a>
            </div>

            {/* Image grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {images.map((url, i) => {
                    const globalIndex = inputImages.length + i;
                    return (
                    <div
                        key={i}
                        className="group relative aspect-square rounded-2xl overflow-hidden bg-glass cursor-pointer"
                        onClick={() => setLightboxIndex(globalIndex)}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={url}
                            alt={`Generated ${i + 1}`}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                            <button type="button" className="focus-ring w-9 h-9 rounded-full bg-glass-hover backdrop-blur-sm flex items-center justify-center transition-transform hover:scale-110">
                                <ZoomIn className="w-4 h-4 text-foreground" />
                            </button>
                            <a
                                href={url}
                                download
                                onClick={(e) => e.stopPropagation()}
                                className="focus-ring w-9 h-9 rounded-full bg-glass-hover backdrop-blur-sm flex items-center justify-center transition-transform hover:scale-110"
                            >
                                <Download className="w-4 h-4 text-foreground" />
                            </a>
                        </div>
                    </div>
                    );
                })}
            </div>

            {/* Lightbox */}
            {lightboxIndex !== null && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setLightboxIndex(null)}
                >
                    {/* Left arrow */}
                    {lightboxIndex > 0 && (
                        <button type="button" aria-label="Previous image" className="focus-ring absolute left-4 w-12 h-12 rounded-full bg-glass-hover flex items-center justify-center text-white transition-colors text-2xl z-50" onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}>
                            ‹
                        </button>
                    )}
                    {/* Right arrow */}
                    {lightboxIndex < allImages.length - 1 && (
                        <button type="button" aria-label="Next image" className="focus-ring absolute right-4 w-12 h-12 rounded-full bg-glass-hover flex items-center justify-center text-white transition-colors text-2xl z-50" onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}>
                            ›
                        </button>
                    )}

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={allImages[lightboxIndex]}
                        alt="Preview"
                        className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain relative z-40"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button
                        type="button"
                        aria-label="Close preview"
                        className="focus-ring absolute top-4 right-4 w-10 h-10 rounded-full bg-glass-hover flex items-center justify-center text-foreground transition-colors text-xl z-50"
                        onClick={() => setLightboxIndex(null)}
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
}
