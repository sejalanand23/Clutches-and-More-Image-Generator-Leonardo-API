'use client';

import type { Job } from '@/lib/types';
import { getDisplayStatus } from '@/lib/types';
import { Lightbulb, Zap, Clock, ImageIcon, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from '@/lib/dateUtils';

interface ContextPanelProps {
    activeJob: Job | null;
    numImages: number;
}

const STUDIO_TIPS = [
    {
        icon: ImageIcon,
        title: 'Clean backgrounds work best',
        body: 'Upload photos against a plain white or neutral background for the most accurate AI placement.',
    },
    {
        icon: Zap,
        title: 'Multiple angles',
        body: 'Upload 2–3 angles of the same product to let the AI pick the most photogenic composition.',
    },
    {
        icon: Lightbulb,
        title: 'Leave the scene blank',
        body: 'The default prompt is tuned for your category. Only override it if you have a specific mood in mind.',
    },
    {
        icon: Clock,
        title: 'Each photo ~30–60s',
        body: 'Generation time scales with photo count. 3 photos typically complete in under 3 minutes.',
    },
];

const CATEGORY_DISPLAY: Record<string, string> = {
    bags: 'Bags & Clutches',
    jewelry: 'Jewelry',
};

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
    pending:    { label: 'Pending',    color: 'text-muted-foreground' },
    processing: { label: 'Generating', color: 'text-accent' },
    completed:  { label: 'Completed',  color: 'text-sage' },
    partial:    { label: 'Partial',    color: 'text-highlight' },
    failed:     { label: 'Failed',     color: 'text-destructive' },
};

function MetaRow({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
    return (
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
            <span className="text-[11.5px] font-medium text-muted-foreground shrink-0">{label}</span>
            <span className={`text-[12px] font-semibold text-right leading-snug ${valueClass || 'text-foreground'}`}>
                {value}
            </span>
        </div>
    );
}

export default function ContextPanel({ activeJob, numImages }: ContextPanelProps) {
    // ── Studio tips (no active job) ───────────────────────────────────────
    if (!activeJob || activeJob.status === 'pending') {
        return (
            <aside className="h-full bg-background overflow-y-auto px-5 py-6 space-y-7 border-l border-border">
                {/* ── Today's Mood Card ── */}
                <div className="paper-card p-5 space-y-4">
                    <p className="eyebrow text-center">Today&apos;s Mood</p>
                    <p className="text-[14px] font-display italic text-muted-foreground leading-relaxed text-center px-1">
                        &ldquo;Elegant yet effortless. A still life bathed in perfect afternoon light.&rdquo;
                    </p>
                    <div className="flex items-center justify-center gap-1.5 pt-1">
                        <div className="w-4 h-4 rounded-full bg-background border border-border shadow-xs" />
                        <div className="w-4 h-4 rounded-full bg-muted border border-border shadow-xs" />
                        <div className="w-4 h-4 rounded-full bg-secondary border border-border shadow-xs" />
                        <div className="w-4 h-4 rounded-full bg-sage shadow-xs" />
                        <div className="w-4 h-4 rounded-full bg-accent shadow-xs" />
                        <div className="w-4 h-4 rounded-full bg-foreground shadow-xs" />
                    </div>
                </div>

                {/* ── Tips Card ── */}
                <div className="paper-card p-5">
                    <p className="eyebrow mb-4">Tips from the studio</p>
                    <div className="space-y-4">
                        {STUDIO_TIPS.map(({ icon: Icon, title, body }) => (
                            <div key={title} className="flex gap-3 group">
                                <div className="w-8 h-8 rounded-xl bg-sage/10 border border-sage/20 text-sage flex items-center justify-center shrink-0 mt-0.5 group-hover:-rotate-3 transition-transform">
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12.5px] font-semibold text-foreground leading-tight">{title}</p>
                                    <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">
                                        {body}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Quick spec ── */}
                <div>
                    <p className="eyebrow mb-2 ml-1">Output spec</p>
                    <div className="paper-card overflow-hidden">
                        <MetaRow label="Resolution"  value="1080 × 1080 px" />
                        <MetaRow label="Format"      value="JPEG" />
                        <MetaRow label="Photos"      value={`${numImages} per product`} />
                        <MetaRow label="Watermark"   value="Included" />
                    </div>
                </div>
            </aside>
        );
    }

    // ── Job metadata (active job) ─────────────────────────────────────────
    const displayStatus = getDisplayStatus(activeJob);
    const statusInfo  = STATUS_DISPLAY[displayStatus] ?? STATUS_DISPLAY.completed;
    const catDisplay  = CATEGORY_DISPLAY[activeJob.category] ?? activeJob.category;
    const outputCount = activeJob.output_images?.length ?? 0;
    const countDisplay = outputCount
        ? `${outputCount} / ${activeJob.num_images ?? '?'}`
        : activeJob.num_images
        ? `${activeJob.num_images} planned`
        : '—';

    return (
        <aside className="h-full bg-background overflow-y-auto px-5 py-6 space-y-7 border-l border-border">
            {/* Job details */}
            <div>
                <p className="eyebrow mb-2 ml-1">Job details</p>
                <div className="paper-card overflow-hidden">
                    <MetaRow label="Status"   value={statusInfo.label} valueClass={statusInfo.color} />
                    <MetaRow label="Category" value={catDisplay} />
                    <MetaRow label="Photos"   value={countDisplay} />
                    <MetaRow
                        label="Created"
                        value={formatDistanceToNow(activeJob.created_at)}
                    />
                </div>
            </div>

            {/* Prompt (read-only) */}
            {activeJob.prompt && (
                <div>
                    <p className="eyebrow mb-2 ml-1">Prompt</p>
                    <div className="paper-card p-4">
                        <p className="text-[12px] font-medium text-foreground leading-relaxed italic font-display">
                            &ldquo;{activeJob.prompt}&rdquo;
                        </p>
                    </div>
                </div>
            )}

            {/* Output thumbnails */}
            {activeJob.output_images?.length > 0 && (
                <div>
                    <div className="flex items-center gap-1.5 mb-3 ml-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sage" />
                        <p className="eyebrow">Generated</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {activeJob.output_images.slice(0, 8).map((url, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                key={i}
                                src={url}
                                alt=""
                                className="aspect-square w-full rounded-2xl object-cover border border-border shadow-xs"
                            />
                        ))}
                    </div>
                </div>
            )}
        </aside>
    );
}
