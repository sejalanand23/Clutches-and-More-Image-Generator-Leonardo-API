'use client';

import type { Job } from '@/lib/types';
import JobCard from './JobCard';
import { Plus, Sparkles } from 'lucide-react';

interface SidebarProps {
    jobs: Job[];
    activeJobId: string | null;
    onJobClick: (job: Job) => void;
    onNewSession: () => void;
    onDelete: (job: Job, e: React.MouseEvent) => void;
    onCancel: (job: Job, e: React.MouseEvent) => void;
}

export default function Sidebar({ jobs, activeJobId, onJobClick, onNewSession, onDelete, onCancel }: SidebarProps) {
    return (
        <aside className="flex flex-col h-full bg-surface border-r border-border">
            {/* Header */}
            <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shadow-sm">
                        <Sparkles className="w-4 h-4 text-accent-foreground" />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold text-foreground leading-none">Clutches &amp; More</h1>
                        <p className="text-[10px] text-faint leading-none mt-0.5">AI Photo Studio</p>
                    </div>
                </div>

                <button
                    onClick={onNewSession}
                    className="focus-ring w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all active:translate-y-px
                      bg-[color:color-mix(in_oklch,var(--color-accent)_10%,transparent)]
                      hover:bg-[color:color-mix(in_oklch,var(--color-accent)_14%,transparent)]
                      border-[color:color-mix(in_oklch,var(--color-accent)_22%,var(--color-border))]
                      text-foreground"
                >
                    <Plus className="w-4 h-4" />
                    New Generation
                </button>
            </div>

            {/* History */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {jobs.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-xs text-faint">No generations yet</p>
                    </div>
                ) : (
                    jobs.map((job) => (
                        <JobCard
                            key={job.id}
                            job={job}
                            isActive={job.id === activeJobId}
                            onClick={() => onJobClick(job)}
                            onDelete={onDelete}
                            onCancel={onCancel}
                        />
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border">
                <p className="text-[10px] text-faint text-center">
                    Powered by Leonardo AI · 1080×1080
                </p>
            </div>
        </aside>
    );
}
