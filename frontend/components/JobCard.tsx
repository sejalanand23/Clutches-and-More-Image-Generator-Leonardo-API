'use client';

import { useState } from 'react';
import type { Job } from '@/lib/types';
import { getDisplayStatus } from '@/lib/types';
import { formatShortDate, formatDistanceToNow } from '../lib/dateUtils';
import { Trash2, StopCircle, ImageIcon } from 'lucide-react';

interface JobCardProps {
    job: Job;
    isActive: boolean;
    onClick: () => void;
    onDelete: (job: Job, e: React.MouseEvent) => void;
    onCancel: (job: Job, e: React.MouseEvent) => void;
}

const CATEGORY_LABEL: Record<string, string> = {
    bags: 'Bags',
    jewelry: 'Jewelry',
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    pending:    { label: 'Pending',    cls: 'bg-[color:color-mix(in_oklch,var(--color-warning)_15%,transparent)] text-[color:color-mix(in_oklch,var(--color-warning)_70%,var(--color-foreground))]' },
    processing: { label: 'Generating', cls: 'bg-[color:color-mix(in_oklch,var(--color-accent)_14%,transparent)] text-[color:color-mix(in_oklch,var(--color-accent)_70%,var(--color-foreground))]' },
    completed:  { label: 'Done',       cls: 'bg-[color:color-mix(in_oklch,var(--color-success)_15%,transparent)] text-[color:color-mix(in_oklch,var(--color-success)_65%,var(--color-foreground))]' },
    partial:    { label: 'Partial',    cls: 'bg-[color:color-mix(in_oklch,var(--color-warning)_15%,transparent)] text-[color:color-mix(in_oklch,var(--color-warning)_70%,var(--color-foreground))]' },
    failed:     { label: 'Failed',     cls: 'bg-[color:color-mix(in_oklch,var(--color-danger)_12%,transparent)] text-[color:color-mix(in_oklch,var(--color-danger)_60%,var(--color-foreground))]' },
};

export default function JobCard({ job, isActive, onClick, onDelete, onCancel }: JobCardProps) {
    const [imgError, setImgError] = useState(false);

    const displayStatus = getDisplayStatus(job);
    const isFailed  = displayStatus === 'failed';    // pure failures — no output
    const isPartial = displayStatus === 'partial';   // stopped early, has some images
    const isLive    = displayStatus === 'pending' || displayStatus === 'processing';

    const thumbnail = !imgError ? (job.input_images?.[0] || job.output_images?.[0] || undefined) : undefined;
    const catLabel  = CATEGORY_LABEL[job.category] ?? job.category;
    const badge     = STATUS_BADGE[displayStatus] ?? STATUS_BADGE.completed;

    // Count label — fall back to num_images when output_images not yet loaded
    let countLabel: string;
    if (job.output_images?.length) {
        countLabel = `${job.output_images.length} photo${job.output_images.length !== 1 ? 's' : ''}`;
    } else if (job.status === 'completed' && job.num_images) {
        countLabel = `${job.num_images} photo${job.num_images !== 1 ? 's' : ''}`;
    } else {
        countLabel = '';
    }

    return (
        <div className={`relative group/card transition-opacity duration-150 ${isFailed ? 'opacity-55 hover:opacity-85' : ''}`}>
            <button
                type="button"
                onClick={onClick}
                className={`focus-ring w-full text-left rounded-xl overflow-hidden transition-all duration-150 border ${
                    isActive
                        ? 'bg-[color:color-mix(in_oklch,var(--color-accent)_9%,transparent)] border-[color:color-mix(in_oklch,var(--color-accent)_32%,var(--color-border))]'
                        : 'bg-white border-border hover:border-[color:color-mix(in_oklch,var(--color-accent)_22%,var(--color-border))] hover:shadow-sm'
                }`}
            >
                {/* Thumbnail strip */}
                <div className={`w-full h-[88px] relative overflow-hidden ${isPartial ? 'bg-[color:color-mix(in_oklch,var(--color-warning)_8%,transparent)]' : 'bg-surface-2'}`}>
                    {thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-border" />
                        </div>
                    )}

                    {/* Status badge — top-right overlay */}
                    <div className="absolute top-2 right-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm ${badge.cls}`}>
                            {isLive && <span className="w-1 h-1 rounded-full bg-current animate-pulse-dot" />}
                            {badge.label}
                        </span>
                    </div>
                </div>

                {/* Card body */}
                <div className="px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-secondary bg-surface-2 border border-border px-2 py-0.5 rounded-full">
                            {catLabel}
                        </span>
                        <span suppressHydrationWarning className="text-[11px] text-muted shrink-0">
                            {formatShortDate(job.created_at)}
                        </span>
                    </div>
                    <p suppressHydrationWarning className="text-[12px] text-muted mt-1.5 leading-tight">
                        {countLabel || formatDistanceToNow(job.created_at)}
                    </p>
                </div>
            </button>

            {/* Hover-reveal action buttons on thumbnail */}
            <div className="absolute top-2 left-2 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
                {isLive && (
                    <button
                        type="button"
                        title="Stop generation"
                        onClick={(e) => onCancel(job, e)}
                        className="focus-ring w-6 h-6 rounded-lg bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/50 transition-colors"
                    >
                        <StopCircle className="w-3.5 h-3.5" />
                    </button>
                )}
                <button
                    type="button"
                    title="Delete"
                    onClick={(e) => onDelete(job, e)}
                    className="focus-ring w-6 h-6 rounded-lg bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/50 transition-colors"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
