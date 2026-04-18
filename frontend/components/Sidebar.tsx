'use client';

import { useState } from 'react';
import type { Job } from '@/lib/types';
import { getDisplayStatus } from '@/lib/types';
import JobCard from './JobCard';
import { Plus, Sparkles, Search, PanelLeftClose } from 'lucide-react';

interface SidebarProps {
    jobs: Job[];
    activeJobId: string | null;
    onJobClick: (job: Job) => void;
    onNewSession: () => void;
    onDelete: (job: Job, e: React.MouseEvent) => void;
    onCancel: (job: Job, e: React.MouseEvent) => void;
    onCollapse?: () => void;
}

type StatusFilter = 'all' | 'completed' | 'processing' | 'partial' | 'failed';
type CategoryFilter = 'all' | 'bags' | 'jewelry';

export default function Sidebar({ jobs, activeJobId, onJobClick, onNewSession, onDelete, onCancel, onCollapse }: SidebarProps) {
    const [statusFilter, setStatusFilter]     = useState<StatusFilter>('all');
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
    const [searchQuery, setSearchQuery]       = useState('');

    // Apply filters
    const visibleJobs = jobs.filter((job) => {
        const dStatus = getDisplayStatus(job);
        // Status filter — group pending+processing as "active"
        if (statusFilter === 'completed'  && dStatus !== 'completed')  return false;
        if (statusFilter === 'processing' && dStatus !== 'processing' && dStatus !== 'pending') return false;
        if (statusFilter === 'partial'    && dStatus !== 'partial')    return false;
        if (statusFilter === 'failed'     && dStatus !== 'failed')     return false;
        // Category filter
        if (categoryFilter !== 'all' && job.category !== categoryFilter)  return false;
        // Text search — matches prompt or category
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            if (!job.prompt.toLowerCase().includes(q) && !job.category.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    const STATUS_OPTS: { value: StatusFilter; label: string }[] = [
        { value: 'all',        label: 'All'      },
        { value: 'completed',  label: 'Done'     },
        { value: 'processing', label: 'Active'   },
        { value: 'partial',    label: 'Partial'  },
        { value: 'failed',     label: 'Failed'   },
    ];

    const hasFilters = statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery.trim().length > 0;

    return (
        <aside className="flex flex-col h-full bg-surface border-r border-border">
            {/* ── Brand header ── */}
            <div className="px-4 pt-5 pb-4 border-b border-border shrink-0">
                <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shadow-sm shrink-0">
                        <Sparkles className="w-4 h-4 text-accent-foreground" />
                    </div>
                    <div className="flex-1">
                        <p className="text-[13px] font-semibold text-foreground leading-tight tracking-tight">
                            Clutches &amp; More
                        </p>
                        <p className="text-[11px] text-faint leading-tight mt-px">AI Photo Studio</p>
                    </div>
                    {onCollapse && (
                        <button
                            type="button"
                            onClick={onCollapse}
                            title="Close sidebar"
                            className="focus-ring w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-2 transition-colors -mr-1"
                        >
                            <PanelLeftClose className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onNewSession}
                    className="focus-ring w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all active:scale-[0.98]
                      bg-accent text-accent-foreground shadow-sm hover:bg-accent-hover"
                >
                    <Plus className="w-3.5 h-3.5" />
                    New generation
                </button>
            </div>

            {/* ── History filter toolbar ── */}
            {jobs.length > 0 && (
                <div className="px-3 pt-3 pb-2 border-b border-border shrink-0 space-y-2">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search generations…"
                            className="focus-ring w-full bg-surface-2 border border-border rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-foreground placeholder:text-muted transition-all
                              hover:border-[color:color-mix(in_oklch,var(--color-accent)_25%,var(--color-border))]
                              focus:border-[color:color-mix(in_oklch,var(--color-accent)_45%,var(--color-border))]"
                        />
                    </div>

                    {/* Status pills */}
                    <div className="flex gap-1 flex-wrap">
                        {STATUS_OPTS.map(({ value, label }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setStatusFilter(value)}
                                className={`focus-ring text-[11px] font-medium px-2.5 py-1 rounded-full transition-all ${
                                    statusFilter === value
                                        ? 'bg-accent text-accent-foreground'
                                        : 'bg-surface-2 text-muted hover:text-secondary border border-border'
                                }`}
                            >
                                {label}
                            </button>
                        ))}

                        {/* Category filter — inline after status pills */}
                        <button
                            type="button"
                            onClick={() => setCategoryFilter((v) => v === 'bags' ? 'all' : 'bags')}
                            className={`focus-ring text-[11px] font-medium px-2.5 py-1 rounded-full transition-all ${
                                categoryFilter === 'bags'
                                    ? 'bg-accent text-accent-foreground'
                                    : 'bg-surface-2 text-muted hover:text-secondary border border-border'
                            }`}
                        >
                            Bags
                        </button>
                        <button
                            type="button"
                            onClick={() => setCategoryFilter((v) => v === 'jewelry' ? 'all' : 'jewelry')}
                            className={`focus-ring text-[11px] font-medium px-2.5 py-1 rounded-full transition-all ${
                                categoryFilter === 'jewelry'
                                    ? 'bg-accent text-accent-foreground'
                                    : 'bg-surface-2 text-muted hover:text-secondary border border-border'
                            }`}
                        >
                            Jewelry
                        </button>
                    </div>
                </div>
            )}

            {/* ── History list ── */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
                {jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
                        <div className="w-10 h-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center mb-1">
                            <Sparkles className="w-4 h-4 text-muted" />
                        </div>
                        <p className="text-[12px] font-medium text-secondary">No generations yet</p>
                        <p className="text-[11px] text-faint leading-snug max-w-[130px]">
                            Your past sessions will appear here
                        </p>
                    </div>
                ) : visibleJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-1.5 text-center">
                        <p className="text-[12px] font-medium text-secondary">No results</p>
                        <button
                            type="button"
                            onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); setSearchQuery(''); }}
                            className="text-[11px] text-[color:var(--color-accent)] hover:underline mt-0.5"
                        >
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-0.5 mb-2">
                            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                                History
                            </p>
                            {hasFilters && (
                                <button
                                    type="button"
                                    onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); setSearchQuery(''); }}
                                    className="text-[10px] text-[color:var(--color-accent)] hover:underline"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        {visibleJobs.map((job) => (
                            <JobCard
                                key={job.id}
                                job={job}
                                isActive={job.id === activeJobId}
                                onClick={() => onJobClick(job)}
                                onDelete={onDelete}
                                onCancel={onCancel}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Footer ── */}
            <div className="px-4 py-3 border-t border-border shrink-0">
                <p className="text-[11px] text-muted leading-none">
                    Powered by <span className="font-medium text-secondary">Leonardo AI</span>
                </p>
            </div>
        </aside>
    );
}
