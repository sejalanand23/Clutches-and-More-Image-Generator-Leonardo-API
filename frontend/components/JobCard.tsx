'use client';

import { useState } from 'react';
import type { Job } from '@/lib/types';
import { getDisplayStatus } from '@/lib/types';
import { formatDistanceToNow } from '../lib/dateUtils';
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

const STATUS_BADGE: Record<string, { label: string; cls: string; dot: string }> = {
    pending:    { label: 'Pending',    cls: 'text-muted-foreground', dot: 'bg-muted-foreground' },
    processing: { label: 'Active',     cls: 'text-accent', dot: 'bg-accent' },
    completed:  { label: 'Done',       cls: 'text-sage', dot: 'bg-sage' },
    partial:    { label: 'Partial',    cls: 'text-highlight', dot: 'bg-highlight' },
    failed:     { label: 'Failed',     cls: 'text-destructive', dot: 'bg-destructive' },
};

export default function JobCard({ job, isActive, onClick, onDelete, onCancel }: JobCardProps) {
    const [imgError, setImgError] = useState(false);

    const displayStatus = getDisplayStatus(job);
    const isFailed  = displayStatus === 'failed';
    const isLive    = displayStatus === 'pending' || displayStatus === 'processing';

    const thumbnail = !imgError ? (job.input_images?.[0] || job.output_images?.[0] || undefined) : undefined;
    const catLabel  = CATEGORY_LABEL[job.category] ?? job.category;
    const badge     = STATUS_BADGE[displayStatus] ?? STATUS_BADGE.completed;

    return (
        <div className={`relative group/card transition-opacity duration-150 ${isFailed ? 'opacity-60 hover:opacity-100' : ''}`}>
            <button
                type="button"
                onClick={onClick}
                className={`focus-ring w-full text-left rounded-2xl overflow-hidden transition-all duration-200 border flex items-center gap-3 p-2 ${
                    isActive
                        ? 'bg-card border-border shadow-sm ring-1 ring-ring/10'
                        : 'bg-transparent border-transparent hover:bg-card hover:border-border hover:shadow-xs'
                }`}
            >
                {/* 56px Thumbnail */}
                <div className="w-14 h-14 shrink-0 rounded-xl relative overflow-hidden bg-muted border border-border flex items-center justify-center">
                    {thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
                    )}
                </div>

                {/* Card body */}
                <div className="flex-1 min-w-0 pr-1 py-0.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-foreground truncate">
                            {catLabel}
                        </span>
                        {/* Status pill (text + dot) */}
                        <span suppressHydrationWarning className={`flex items-center gap-1.5 text-[11px] font-medium shrink-0 ${badge.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} ${isLive ? 'animate-pulse-dot' : ''}`} />
                            {badge.label}
                        </span>
                    </div>
                    <p suppressHydrationWarning className="text-[12px] text-muted-foreground mt-1 leading-tight truncate">
                        {formatDistanceToNow(job.created_at)}
                    </p>
                </div>
            </button>

            {/* Hover-reveal action buttons (visible by default on mobile) */}
            <div className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover/card:opacity-100 transition-opacity duration-150 pr-2">
                {isLive && (
                    <button
                        type="button"
                        title="Stop generation"
                        onClick={(e) => onCancel(job, e)}
                        className="focus-ring w-8 h-8 rounded-full bg-background border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                    >
                        <StopCircle className="w-3.5 h-3.5" />
                    </button>
                )}
                <button
                    type="button"
                    title="Delete"
                    onClick={(e) => onDelete(job, e)}
                    className="focus-ring w-8 h-8 rounded-full bg-background border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-card transition-colors"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
