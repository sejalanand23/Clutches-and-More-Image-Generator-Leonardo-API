'use client';

import type { Job } from '@/lib/types';
import { formatDistanceToNow } from '../lib/dateUtils';
import { Trash2, StopCircle } from 'lucide-react';

interface JobCardProps {
    job: Job;
    isActive: boolean;
    onClick: () => void;
    onDelete: (job: Job, e: React.MouseEvent) => void;
    onCancel: (job: Job, e: React.MouseEvent) => void;
}

const STATUS_CONFIG = {
    pending: {
        label: 'Pending',
        color:
            'bg-[color:color-mix(in_oklch,var(--color-warning)_18%,transparent)] text-[color:color-mix(in_oklch,var(--color-warning)_55%,var(--color-foreground))]',
    },
    processing: {
        label: 'Generating',
        color:
            'bg-[color:color-mix(in_oklch,var(--color-accent)_16%,transparent)] text-[color:color-mix(in_oklch,var(--color-accent)_55%,var(--color-foreground))]',
    },
    completed: {
        label: 'Done',
        color:
            'bg-[color:color-mix(in_oklch,var(--color-success)_18%,transparent)] text-[color:color-mix(in_oklch,var(--color-success)_55%,var(--color-foreground))]',
    },
    failed: {
        label: 'Failed',
        color:
            'bg-[color:color-mix(in_oklch,var(--color-danger)_18%,transparent)] text-[color:color-mix(in_oklch,var(--color-danger)_60%,var(--color-foreground))]',
    },
} as const;

export default function JobCard({ job, isActive, onClick, onDelete, onCancel }: JobCardProps) {
    const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
    const isLive = job.status === 'pending' || job.status === 'processing';

    return (
        <div className="relative group/card">
            <button
                onClick={onClick}
                className={`focus-ring w-full text-left px-3 py-3 rounded-xl transition-all duration-200 border active:translate-y-px ${isActive
                        ? 'bg-[color:color-mix(in_oklch,var(--color-accent)_12%,transparent)] border-[color:color-mix(in_oklch,var(--color-accent)_28%,var(--color-border))]'
                        : 'bg-glass border-border hover:bg-glass-hover hover:border-border'
                    }`}
            >
                {/* Prompt preview */}
                <p className="text-sm text-foreground font-medium leading-snug line-clamp-2 mb-2 pr-6">
                    {job.prompt || 'No prompt'}
                </p>

                <div className="flex items-center justify-between gap-2">
                    {/* Status badge */}
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                        {cfg.label}
                        {job.status === 'processing' && (
                            <span className="inline-block ml-1 animate-pulse">●</span>
                        )}
                    </span>

                    {/* Category + time */}
                    <span suppressHydrationWarning className="text-[11px] text-faint shrink-0">
                        {job.category} · {formatDistanceToNow(job.created_at)}
                    </span>
                </div>

                {/* Thumbnail strip */}
                {job.output_images?.length > 0 && (
                    <div className="flex gap-1 mt-2 overflow-hidden">
                        {job.output_images.slice(0, 3).map((url, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                key={i}
                                src={url}
                                alt=""
                                className="w-10 h-10 rounded-md object-cover opacity-70 group-hover/card:opacity-100 transition-opacity"
                            />
                        ))}
                        {job.output_images.length > 3 && (
                            <div className="w-10 h-10 rounded-md bg-glass-hover flex items-center justify-center text-[11px] text-faint">
                                +{job.output_images.length - 3}
                            </div>
                        )}
                    </div>
                )}
            </button>

            {/* Action buttons — hover-reveal top-right */}
            <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
                {/* Stop button — only for live jobs */}
                {isLive && (
                    <button
                        type="button"
                        title="Stop job"
                        onClick={(e) => onCancel(job, e)}
                        className="focus-ring w-6 h-6 rounded-md flex items-center justify-center
                          text-[color:color-mix(in_oklch,var(--color-warning)_70%,var(--color-foreground))]
                          hover:bg-[color:color-mix(in_oklch,var(--color-warning)_16%,transparent)]
                          transition-colors"
                    >
                        <StopCircle className="w-3.5 h-3.5" />
                    </button>
                )}

                {/* Delete button */}
                <button
                    type="button"
                    title="Delete job"
                    onClick={(e) => onDelete(job, e)}
                    className="focus-ring w-6 h-6 rounded-md flex items-center justify-center
                      text-[color:color-mix(in_oklch,var(--color-danger)_65%,var(--color-foreground))]
                      hover:bg-[color:color-mix(in_oklch,var(--color-danger)_14%,transparent)]
                      transition-colors"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
