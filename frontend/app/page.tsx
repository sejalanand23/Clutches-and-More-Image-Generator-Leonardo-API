'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import UploadZone from '@/components/UploadZone';
import PromptEditor from '@/components/PromptEditor';
import ResultsGrid from '@/components/ResultsGrid';
import type { Job } from '@/lib/types';
import { createJob, uploadImages, triggerGeneration, getJob, listJobs, deleteJob, cancelJob } from '@/lib/api';
import { Wand2, AlertCircle } from 'lucide-react';

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
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const pollErrorsRef = useRef(0);
  const isMountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    if (pollAbortRef.current) {
      pollAbortRef.current.abort();
      pollAbortRef.current = null;
    }
    pollErrorsRef.current = 0;
  }, []);

  // ── Load job history ──────────────────────────────────────────────────────────
  const refreshJobs = useCallback(async () => {
    try {
      const all = await listJobs();
      setJobs(all);
    } catch {
      // silently fail on refresh
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshJobs();
  }, [refreshJobs]);

  const handleCategoryChange = (next: 'bags' | 'jewelry') => {
    setCategory(next);
    setPrompt('');
  };

  // ── Polling active job until complete ─────────────────────────────────────────
  const startPolling = useCallback(
    (jobId: string) => {
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
          
          // Only update the active view if the user is still looking at this specific job
          setActiveJob((current) => (current?.id === jobId ? job : current));
          
          // Always update the job in the sidebar history
          setJobs((prev) =>
            prev.map((j) => (j.id === job.id ? job : j))
          );
          
          if (job.status === 'completed' || job.status === 'failed') {
            stopPolling();
            setStage('idle');
            await refreshJobs();
            return;
          }
        } catch {
          if (!isMountedRef.current) return;
          pollErrorsRef.current += 1;

          // If the user navigated away / restarted polling, aborts will land here.
          // In that case, don't schedule more work.
          if (pollAbortRef.current?.signal.aborted) return;

          if (pollErrorsRef.current >= 5) {
            stopPolling();
            setStage('idle');
            setError('Lost connection while checking job status. Please try again.');
            return;
          }
        }

        const baseMs = 3000;
        const backoffMs = Math.min(baseMs * Math.pow(2, pollErrorsRef.current), 30000);
        pollTimeoutRef.current = setTimeout(tick, backoffMs);
      };

      // Run immediately (no initial delay) to get fast UI updates.
      void tick();
    },
    [refreshJobs, stopPolling]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  // ── Generate ─────────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setError(null);
    if (files.length === 0) {
      setError('Please upload at least one product image.');
      return;
    }

    try {
      // 1. Create job
      setStage('creating');
      const { job_id } = await createJob(
        prompt.trim() || (category === 'bags' ? BAGS_DEFAULT : JEWELRY_DEFAULT),
        category,
        numImages
      );

      // 2. Upload images
      setStage('uploading');
      await uploadImages(job_id, files);

      // 3. Trigger generation
      setStage('generating');
      await triggerGeneration(job_id);

      // Optimistic: add pending job to list
      const pendingJob: Job = {
        id: job_id,
        prompt: prompt.trim() || (category === 'bags' ? BAGS_DEFAULT : JEWELRY_DEFAULT),
        category,
        status: 'processing',
        created_at: new Date().toISOString(),
        input_images: [],
        output_images: [],
      };
      setActiveJob(pendingJob);
      setJobs((prev) => [pendingJob, ...prev]);

      // Reset form
      setFiles([]);
      setPrompt('');

      // Start polling
      startPolling(job_id);
    } catch (err: unknown) {
      setStage('idle');
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
    }
  };

  // ── Load past job ─────────────────────────────────────────────────────────────
  const handleJobClick = async (job: Job) => {
    setError(null);
    // Show the job immediately with whatever data we have (fast perceived response)
    setActiveJob(job);

    // If it was left processing, resume polling (polling will fill in images)
    if (job.status === 'processing' || job.status === 'pending') {
      setStage('generating');
      startPolling(job.id);
      return;
    }

    // For completed/failed jobs: fetch full detail so input_images & output_images are populated from Supabase
    try {
      const full = await getJob(job.id);
      setActiveJob((current) => (current?.id === job.id ? full : current));
    } catch {
      // silently fall back to the partial data already shown
    }
  };

  const handleCancelJob = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await cancelJob(job.id);
      await refreshJobs();
      
      // Update active view only if this is still the active job
      setActiveJob((current) => {
        if (current?.id === job.id) {
          // If the job was cancelled, we might want to refresh its data
          // but we also need to consider if we should switch to idle stage
          setStage('idle');
          stopPolling();
          return current; // The fetch below will update it
        }
        return current;
      });

      if (activeJob?.id === job.id) {
        const updated = await getJob(job.id);
        setActiveJob((current) => (current?.id === job.id ? updated : current));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to stop job';
      setError(msg);
    }
  };

  const handleDeleteJob = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this generation? This cannot be undone.')) return;

    try {
      await deleteJob(job.id);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      if (activeJob?.id === job.id) {
        handleNewSession();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete job';
      setError(msg);
    }
  };

  const handleNewSession = () => {
    setActiveJob(null);
    setFiles([]);
    setPrompt('');
    setNumImages(3);
    setError(null);
    setStage('idle');
    stopPolling();
  };

  // ── Stage label ───────────────────────────────────────────────────────────────
  const stageLabel: Record<Stage, string> = {
    idle: 'Generate Photos',
    creating: 'Creating job…',
    uploading: 'Uploading images…',
    generating: 'Generating…',
  };

  const isLoading = stage !== 'idle';

  return (
    <div className="flex h-screen bg-canvas text-foreground overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 shrink-0 h-full">
        <Sidebar
          jobs={jobs}
          activeJobId={activeJob?.id ?? null}
          onJobClick={handleJobClick}
          onNewSession={handleNewSession}
          onDelete={handleDeleteJob}
          onCancel={handleCancelJob}
        />
      </div>

      {/* Main panel */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 flex flex-col gap-6">

          {/* When no active job — show the studio */}
          {!activeJob || activeJob.status === 'pending' ? (
            <>
              {/* Hero */}
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Product Photo Studio</h2>
                <p className="text-faint text-sm mt-1 max-w-[65ch]">
                  Upload product images, tweak the vibe, and generate {numImages} model photo{numImages !== 1 ? 's' : ''} — ready for Instagram and listings.
                </p>
              </div>

              {/* Upload */}
              <UploadZone files={files} onChange={setFiles} />

              {/* Prompt editor */}
              <PromptEditor
                prompt={prompt}
                category={category}
                onPromptChange={setPrompt}
                onCategoryChange={handleCategoryChange}
              />

              {/* Number of photos */}
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-border bg-glass">
                <div>
                  <p className="text-sm font-medium text-foreground">Number of photos</p>
                  <p className="text-xs text-faint mt-0.5">How many images to generate per product</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    id="num-images-decrement"
                    type="button"
                    onClick={() => setNumImages((n) => Math.max(1, n - 1))}
                    disabled={numImages <= 1}
                    className="focus-ring w-8 h-8 flex items-center justify-center rounded-xl border border-border bg-glass hover:bg-glass-hover active:scale-95 transition-all text-foreground disabled:opacity-30 disabled:cursor-not-allowed font-bold text-base"
                    aria-label="Decrease number of photos"
                  >
                    −
                  </button>
                  <span
                    id="num-images-value"
                    className="w-6 text-center text-sm font-semibold tabular-nums text-foreground"
                  >
                    {numImages}
                  </span>
                  <button
                    id="num-images-increment"
                    type="button"
                    onClick={() => setNumImages((n) => Math.min(10, n + 1))}
                    disabled={numImages >= 10}
                    className="focus-ring w-8 h-8 flex items-center justify-center rounded-xl border border-border bg-glass hover:bg-glass-hover active:scale-95 transition-all text-foreground disabled:opacity-30 disabled:cursor-not-allowed font-bold text-base"
                    aria-label="Increase number of photos"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm border
                  bg-[color:color-mix(in_oklch,var(--color-danger)_10%,transparent)]
                  border-[color:color-mix(in_oklch,var(--color-danger)_24%,var(--color-border))]
                  text-foreground"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-danger" />
                  {error}
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                type="button"
                className={`
                  focus-ring
                  flex items-center justify-center gap-2
                  w-full py-3.5 rounded-2xl font-semibold text-sm
                  transition-all duration-300
                  ${isLoading
                    ? 'cursor-not-allowed bg-[color:color-mix(in_oklch,var(--color-accent)_22%,transparent)] text-faint border border-border'
                    : 'bg-accent text-accent-foreground shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.995]'
                  }
                `}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
                    {stageLabel[stage]}
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    {stageLabel[stage]}
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Active job view */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground leading-snug line-clamp-2">
                    {activeJob.prompt}
                  </h2>
                  <p className="text-faint text-sm mt-1 capitalize">
                    {activeJob.category} · {activeJob.status}
                  </p>
                </div>
                <button
                  onClick={handleNewSession}
                  type="button"
                  className="focus-ring shrink-0 px-3 py-1.5 text-xs text-faint hover:text-foreground border border-border rounded-lg transition-all active:translate-y-px bg-glass hover:bg-glass-hover"
                >
                  ← New
                </button>
              </div>

              {/* Input images row */}
              {activeJob.input_images?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {activeJob.input_images.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={url}
                      alt="Input"
                      className="w-16 h-16 shrink-0 rounded-xl object-cover opacity-60"
                    />
                  ))}
                </div>
              )}

              {/* Results */}
              <ResultsGrid job={activeJob} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
