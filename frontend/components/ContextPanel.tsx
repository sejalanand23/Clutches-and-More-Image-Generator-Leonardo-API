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
    pending:    { label: 'Pending',    color: 'text-[color:var(--color-warning)]' },
    processing: { label: 'Generating', color: 'text-[color:var(--color-accent)]' },
    completed:  { label: 'Completed',  color: 'text-[color:var(--color-success)]' },
    partial:    { label: 'Partial',    color: 'text-[color:var(--color-warning)]' },
    failed:     { label: 'Failed',     color: 'text-[color:var(--color-danger)]' },
};

function MetaRow({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
    return (
        <div className="flex items-start justify-between gap-3 px-3 py-2.5 border-b border-border last:border-0">
            <span className="text-[11px] text-muted shrink-0">{label}</span>
            <span className={`text-[12px] font-medium text-right leading-snug ${valueClass || 'text-foreground'}`}>
                {value}
            </span>
        </div>
    );
}

export default function ContextPanel({ activeJob, numImages }: ContextPanelProps) {
    // ── Studio tips (no active job) ───────────────────────────────────────
    if (!activeJob || activeJob.status === 'pending') {
        return (
            <aside className="h-full overflow-y-auto px-4 py-6 space-y-6">
                <div>
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3">
                        Tips
                    </p>
                    <div className="space-y-3">
                        {STUDIO_TIPS.map(({ icon: Icon, title, body }) => (
                            <div key={title} className="flex gap-3">
                                <div className="w-7 h-7 rounded-lg bg-[color:color-mix(in_oklch,var(--color-accent)_10%,transparent)] border border-[color:color-mix(in_oklch,var(--color-accent)_18%,var(--color-border))] flex items-center justify-center shrink-0 mt-0.5">
                                    <Icon className="w-3.5 h-3.5 text-[color:var(--color-accent)]" />
                                </div>
                                <div>
                                    <p className="text-[12px] font-semibold text-foreground leading-tight">{title}</p>
                                    <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{body}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick spec */}
                <div>
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3">
                        Output spec
                    </p>
                    <div className="rounded-xl border border-border bg-white divide-y divide-border overflow-hidden">
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
        <aside className="h-full overflow-y-auto px-4 py-6 space-y-6">
            {/* Job details */}
            <div>
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-3">
                    Job details
                </p>
                <div className="rounded-xl border border-border bg-white divide-y divide-border overflow-hidden">
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
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">
                        Prompt
                    </p>
                    <p className="text-[11px] text-secondary leading-relaxed bg-surface-2 border border-border rounded-xl px-3 py-2.5">
                        {activeJob.prompt}
                    </p>
                </div>
            )}

            {/* Output thumbnails */}
            {activeJob.output_images?.length > 0 && (
                <div>
                    <div className="flex items-center gap-1.5 mb-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[color:var(--color-success)]" />
                        <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                            Generated
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        {activeJob.output_images.slice(0, 9).map((url, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                key={i}
                                src={url}
                                alt=""
                                className="aspect-square rounded-lg object-cover border border-border"
                            />
                        ))}
                    </div>
                </div>
            )}
        </aside>
    );
}
