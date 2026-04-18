'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import UploadZone from '@/components/UploadZone';
import PromptEditor from '@/components/PromptEditor';
import ResultsGrid from '@/components/ResultsGrid';
import ContextPanel from '@/components/ContextPanel';
import type { Job } from '@/lib/types';
import { createJob, uploadImages, triggerGeneration, getJob, listJobs, deleteJob, cancelJob } from '@/lib/api';
import { Wand2, AlertCircle, ArrowLeft, PanelLeftOpen, Menu, Sparkles } from 'lucide-react';

const BAGS_DEFAULT = `ultra-realistic luxury product photography, placed on a perfectly styled surface in a beautifully lit environment, professional commercial studio photography, highly detailed, sharp focus, depth of field`;
const JEWELRY_DEFAULT = `ultra-realistic luxury product photography, displayed on an elegant surface in a beautifully lit environment, professional commercial studio photography, highly detailed, sharp focus, macro detail`;

type Stage = 'idle' | 'creating' | 'uploading' | 'generating';

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState<'bags' | 'jewelry'>('bags');
  const [numImages, setNumImages] = useState(3);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const pollErrorsRef = useRef(0);
  const isMountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null; }
    if (pollAbortRef.current) { pollAbortRef.current.abort(); pollAbortRef.current = null; }
    pollErrorsRef.current = 0;
  }, []);

  const refreshJobs = useCallback(async () => {
    try {
      const all = await listJobs();
      setJobs(all);
    } catch { /* silent */ }
  }, []);

  // Responsive logic
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
      if (isMobile) setIsSidebarOpen(false);
      startPolling(job_id);
    } catch (err: unknown) {
      setStage('idle');
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const handleJobClick = async (job: Job) => {
    setError(null);
    setActiveJob(job);
    if (isMobile) setIsSidebarOpen(false);
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
    if (isMobile) setIsSidebarOpen(false);
  };

  const stageLabel: Record<Stage, string> = {
    idle: 'Generate photos',
    creating: 'Creating job…',
    uploading: 'Uploading images…',
    generating: 'Generating…',
  };

  const isLoading = stage !== 'idle';
  const showStudio = !activeJob || activeJob.status === 'pending';

  return (
    <div className="flex h-screen bg-canvas text-foreground overflow-hidden relative">

      {/* ── Mobile Sidebar Backdrop ── */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 animate-fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Left sidebar ── */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 lg:static lg:block
          transition-all duration-300 ease-in-out border-r border-border
          ${isSidebarOpen ? 'translate-x-0 w-[320px] bg-sidebar shadow-2xl lg:shadow-none' : '-translate-x-full lg:translate-x-0 w-0 lg:w-0 overflow-hidden bg-transparent border-none'}
        `}
      >
        <div className="w-[320px] h-full">
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
        {/* Mobile Header */}
        <div className="lg:hidden shrink-0 flex items-center justify-between px-5 py-4 bg-sidebar border-b border-border sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[color:var(--color-accent)] shrink-0" />
            <p className="text-[14px] font-bold text-foreground leading-tight tracking-tight">
              Clutches &amp; More
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-muted hover:text-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop Sidebar Toggle */}
        {!isSidebarOpen && !isMobile && (
          <button
            type="button"
            title="Open sidebar"
            onClick={() => setIsSidebarOpen(true)}
            className="focus-ring absolute top-5 left-5 z-20 w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-2 transition-colors shadow-sm"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        <div className="w-full max-w-[640px] mx-auto px-5 lg:px-8 py-6 lg:py-8 flex flex-col gap-6">

          {showStudio ? (
            /* ── Studio form ─────────────────────────────────────────── */
            <>
              <div className="">
                <p className="eyebrow mb-3">№ 001 — Product Photo Studio</p>
                <h1 className="text-3xl lg:text-4xl font-display text-foreground leading-[1.1] mb-4">
                  Transform products into <br className="hidden sm:block" />
                  <span className="italic text-accent">editorial artwork</span>.
                </h1>
                <p className="text-[14px] lg:text-[14.5px] text-muted-foreground leading-relaxed">
                  Upload your product, describe the scene, and let the studio generate perfectly lit photos for your collection.
                </p>
              </div>

              <div className="space-y-4">
                <UploadZone files={files} onChange={setFiles} />
                <PromptEditor
                  prompt={prompt}
                  category={category}
                  onPromptChange={setPrompt}
                  onCategoryChange={handleCategoryChange}
                  numImages={numImages}
                  onNumImagesChange={(n) => setNumImages(n)}
                />

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-3 px-5 py-4 rounded-xl text-[13.5px] font-medium border
                    bg-destructive/10 border-destructive/20 text-destructive"
                  >
                    <AlertCircle className="w-4 h-4 mt-px shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Generate CTA */}
                <div className="pt-2 pb-6">
                  <button
                    id="generate-btn"
                    type="button"
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className={`focus-ring flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl font-bold text-[15px] transition-all duration-200 ${isLoading
                      ? 'cursor-not-allowed bg-muted text-muted-foreground border border-border shadow-none'
                      : 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.99] border border-primary/20 hover:rotate-[0.5deg]'
                      }`}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        {stageLabel[stage]}
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5" />
                        {stageLabel[stage]}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* ── Active job view ───────────────────────────────────── */
            <>
              <button
                type="button"
                onClick={handleNewSession}
                className="focus-ring self-start flex items-center gap-1 text-[12px] hover:text-secondary transition-colors"
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
      <div className="w-[360px] shrink-0 h-full border-l border-border bg-sidebar hidden xl:block">
        <ContextPanel activeJob={activeJob} numImages={numImages} />
      </div>

    </div>
  );
}
