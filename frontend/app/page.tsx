'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import UploadZone from '@/components/UploadZone';
import PromptEditor from '@/components/PromptEditor';
import ResultsGrid from '@/components/ResultsGrid';
import ContextPanel from '@/components/ContextPanel';
import type { Job } from '@/lib/types';
import { createJob, uploadImages, triggerGeneration, getJob, listJobs, deleteJob, cancelJob } from '@/lib/api';
import { Wand2, AlertCircle, ArrowLeft, PanelLeftOpen } from 'lucide-react';

const BAGS_DEFAULT = `ultra-realistic luxury product photography, placed on a perfectly styled surface in a beautifully lit environment, professional commercial studio photography, highly detailed, sharp focus, depth of field`;
const JEWELRY_DEFAULT = `ultra-realistic luxury product photography, displayed on an elegant surface in a beautifully lit environment, professional commercial studio photography, highly detailed, sharp focus, macro detail`;

type Stage = 'idle' | 'creating' | 'uploading' | 'generating';

export default function Home() {
  const [jobs, setJobs]           = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [files, setFiles]         = useState<File[]>([]);
  const [prompt, setPrompt]       = useState('');
  const [category, setCategory]   = useState<'bags' | 'jewelry'>('bags');
  const [numImages, setNumImages] = useState(3);
  const [stage, setStage]         = useState<Stage>('idle');
  const [error, setError]         = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAbortRef   = useRef<AbortController | null>(null);
  const pollErrorsRef  = useRef(0);
  const isMountedRef   = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null; }
    if (pollAbortRef.current)   { pollAbortRef.current.abort(); pollAbortRef.current = null; }
    pollErrorsRef.current = 0;
  }, []);

  const refreshJobs = useCallback(async () => {
    try {
      const all = await listJobs();
      setJobs(all);

      // listJobs returns lightweight rows with empty output_images.
      // Hydrate the 10 most-recent jobs that lack input/output images sequentially (one at a time)
      // to avoid Next.js/Turbopack async_hooks Map overflow from concurrent fetches.
      // This ensures we can display the input image as the thumbnail.
      const toHydrate = all
        .filter((j) => !j.input_images?.length && !j.output_images?.length)
        .slice(0, 4);

      for (const job of toHydrate) {
        try {
          const full = await getJob(job.id);
          setJobs((prev) => prev.map((j) => (j.id === full.id ? full : j)));
          // Delay to prevent Next.js Turbopack's async_hooks Map from overflowing during dev
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch { /* ignore individual failures */ }
      }
    } catch { /* silent */ }
  }, []);


  useEffect(() => { refreshJobs(); }, [refreshJobs]);

  const handleCategoryChange = (next: 'bags' | 'jewelry') => {
    setCategory(next);
    setPrompt('');
  };

  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    pollErrorsRef.current = 0;
    const tick = async () => {
      if (!isMountedRef.current) return;
      try {
        pollAbortRef.current?.abort();
        const controller = new AbortController();
        pollAbortRef.current = controller;
        const job = await getJob(jobId, { signal: controller.signal });
        if (!isMountedRef.current) return;
        pollErrorsRef.current = 0;
        setActiveJob((cur) => (cur?.id === jobId ? job : cur));
        setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
        if (job.status === 'completed' || job.status === 'failed') {
          stopPolling(); setStage('idle'); await refreshJobs(); return;
        }
      } catch {
        if (!isMountedRef.current) return;
        pollErrorsRef.current += 1;
        if (pollAbortRef.current?.signal.aborted) return;
        if (pollErrorsRef.current >= 5) {
          stopPolling(); setStage('idle');
          setError('Lost connection while checking job status. Please try again.');
          return;
        }
      }
      pollTimeoutRef.current = setTimeout(tick, Math.min(3000 * Math.pow(2, pollErrorsRef.current), 30000));
    };
    void tick();
  }, [refreshJobs, stopPolling]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; stopPolling(); };
  }, [stopPolling]);

  const handleGenerate = async () => {
    setError(null);
    if (files.length === 0) { setError('Upload at least one product image to continue.'); return; }
    try {
      setStage('creating');
      const { job_id } = await createJob(
        prompt.trim() || (category === 'bags' ? BAGS_DEFAULT : JEWELRY_DEFAULT),
        category,
        numImages
      );
      setStage('uploading');
      await uploadImages(job_id, files);
      setStage('generating');
      await triggerGeneration(job_id);
      const pendingJob: Job = {
        id: job_id,
        prompt: prompt.trim() || (category === 'bags' ? BAGS_DEFAULT : JEWELRY_DEFAULT),
        category,
        status: 'processing',
        created_at: new Date().toISOString(),
        num_images: numImages,
        input_images: [],
        output_images: [],
      };
      setActiveJob(pendingJob);
      setJobs((prev) => [pendingJob, ...prev]);
      setFiles([]);
      setPrompt('');
      startPolling(job_id);
    } catch (err: unknown) {
      setStage('idle');
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const handleJobClick = async (job: Job) => {
    setError(null);
    setActiveJob(job);
    if (job.status === 'processing' || job.status === 'pending') {
      setStage('generating'); startPolling(job.id); return;
    }
    try {
      const full = await getJob(job.id);
      setActiveJob((cur) => (cur?.id === job.id ? full : cur));
    } catch { /* silent */ }
  };

  const handleCancelJob = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await cancelJob(job.id);
      await refreshJobs();
      setActiveJob((cur) => { if (cur?.id === job.id) { setStage('idle'); stopPolling(); } return cur; });
      if (activeJob?.id === job.id) {
        const updated = await getJob(job.id);
        setActiveJob((cur) => (cur?.id === job.id ? updated : cur));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to stop job');
    }
  };

  const handleDeleteJob = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this generation? This cannot be undone.')) return;
    try {
      await deleteJob(job.id);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      if (activeJob?.id === job.id) handleNewSession();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete job');
    }
  };

  const handleNewSession = () => {
    setActiveJob(null); setFiles([]); setPrompt('');
    setNumImages(3); setError(null); setStage('idle'); stopPolling();
  };

  const stageLabel: Record<Stage, string> = {
    idle:       'Generate photos',
    creating:   'Creating job…',
    uploading:  'Uploading images…',
    generating: 'Generating…',
  };

  const isLoading  = stage !== 'idle';
  const showStudio = !activeJob || activeJob.status === 'pending';

  return (
    <div className="flex h-screen bg-canvas text-foreground overflow-hidden">

      {/* ── Left sidebar ── */}
      <div 
        className={`shrink-0 h-full transition-all duration-300 z-10 bg-surface ${isSidebarOpen ? 'w-72 border-r border-border' : 'w-0 overflow-hidden'}`}
      >
        <div className="w-72 h-full">
          <Sidebar
            jobs={jobs}
            activeJobId={activeJob?.id ?? null}
            onJobClick={handleJobClick}
            onNewSession={handleNewSession}
            onDelete={handleDeleteJob}
            onCancel={handleCancelJob}
            onCollapse={() => setIsSidebarOpen(false)}
          />
        </div>
      </div>

      {/* ── Center main content ── */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto min-w-0 relative">
        {!isSidebarOpen && (
          <button
            type="button"
            title="Open sidebar"
            onClick={() => setIsSidebarOpen(true)}
            className="focus-ring absolute top-5 left-5 z-20 w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-2 transition-colors shadow-sm"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}
        <div className="w-full max-w-[640px] mx-auto px-8 py-10 flex flex-col gap-8">

          {showStudio ? (
            /* ── Studio form ─────────────────────────────────────────── */
            <>
              <div>
                <h1 className="text-[22px] font-bold tracking-tight text-foreground">
                  Product Photo Studio
                </h1>
                <p className="text-[14px] text-muted mt-1.5 leading-relaxed">
                  Upload your product, describe the scene, and get{' '}
                  <span className="text-foreground font-medium">{numImages} AI-generated photo{numImages !== 1 ? 's' : ''}</span>{' '}
                  ready for listings and social.
                </p>
              </div>

              <div className="space-y-6">
                <UploadZone files={files} onChange={setFiles} />
                <PromptEditor
                  prompt={prompt}
                  category={category}
                  onPromptChange={setPrompt}
                  onCategoryChange={handleCategoryChange}
                />

                {/* ── Unified number stepper ── */}
                <div>
                  <label className="block text-[13px] font-semibold text-foreground mb-2">
                    Number of photos
                  </label>
                  <div className="flex h-10 border border-border rounded-xl overflow-hidden bg-white divide-x divide-border">
                    <button
                      id="num-images-decrement"
                      type="button"
                      onClick={() => setNumImages((n) => Math.max(1, n - 1))}
                      disabled={numImages <= 1}
                      aria-label="Decrease"
                      className="focus-ring w-10 flex items-center justify-center text-secondary hover:bg-surface-2 hover:text-foreground active:bg-[color:color-mix(in_oklch,var(--color-accent)_8%,transparent)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-lg font-light leading-none"
                    >
                      −
                    </button>
                    <span
                      id="num-images-value"
                      className="flex-1 flex items-center justify-center text-[14px] font-semibold tabular-nums text-foreground bg-surface-2/50"
                    >
                      {numImages}
                    </span>
                    <button
                      id="num-images-increment"
                      type="button"
                      onClick={() => setNumImages((n) => Math.min(10, n + 1))}
                      disabled={numImages >= 10}
                      aria-label="Increase"
                      className="focus-ring w-10 flex items-center justify-center text-secondary hover:bg-surface-2 hover:text-foreground active:bg-[color:color-mix(in_oklch,var(--color-accent)_8%,transparent)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-lg font-light leading-none"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-[11px] text-muted mt-1.5">1–10 images generated per product</p>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-[13px] border
                    bg-[color:color-mix(in_oklch,var(--color-danger)_8%,transparent)]
                    border-[color:color-mix(in_oklch,var(--color-danger)_22%,var(--color-border))]"
                  >
                    <AlertCircle className="w-4 h-4 mt-px shrink-0 text-[color:var(--color-danger)]" />
                    <span className="text-foreground">{error}</span>
                  </div>
                )}

                {/* Generate CTA */}
                <button
                  id="generate-btn"
                  type="button"
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className={`focus-ring flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-[14px] transition-all duration-200 ${
                    isLoading
                      ? 'cursor-not-allowed bg-surface-2 text-muted border border-border'
                      : 'bg-accent text-accent-foreground shadow-sm hover:bg-accent-hover hover:shadow-md active:scale-[0.995]'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-border border-t-[color:var(--color-accent)] rounded-full animate-spin" />
                      {stageLabel[stage]}
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      {stageLabel[stage]}
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* ── Active job view ───────────────────────────────────── */
            <>
              <button
                type="button"
                onClick={handleNewSession}
                className="focus-ring self-start flex items-center gap-1 text-[12px] text-muted hover:text-secondary transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                New generation
              </button>
              <ResultsGrid job={activeJob} />
            </>
          )}
        </div>
      </main>

      {/* ── Right contextual panel ── */}
      <div className="w-80 shrink-0 h-full border-l border-border bg-surface">
        <ContextPanel activeJob={activeJob} numImages={numImages} />
      </div>

    </div>
  );
}
