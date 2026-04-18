'use client';

interface PromptEditorProps {
    prompt: string;
    category: 'bags' | 'jewelry';
    onPromptChange: (v: string) => void;
    onCategoryChange: (v: 'bags' | 'jewelry') => void;
    numImages: number;
    onNumImagesChange: (n: number) => void;
}

const PLACEHOLDERS = {
    bags: `Describe the scene — e.g., "warm studio light, marble surface, editorial mood"`,
    jewelry: `Describe the scene — e.g., "black velvet background, macro, jeweller lighting"`,
} as const;

const CATEGORIES: { value: 'bags' | 'jewelry'; label: string }[] = [
    { value: 'bags', label: 'Bags & Clutches' },
    { value: 'jewelry', label: 'Jewelry' },
];

export default function PromptEditor({
    prompt,
    category,
    onPromptChange,
    onCategoryChange,
    numImages,
    onNumImagesChange,
}: PromptEditorProps) {
    return (
        <div className="space-y-8">
            {/* ── Category + photo count ── */}
            <div className="paper-card p-6 flex items-start justify-between gap-8 flex-wrap">
                <div>
                    <label className="block eyebrow mb-3">
                        Product category
                    </label>
                    <div className="flex gap-1 p-1 bg-muted/60 rounded-xl border border-border w-fit shadow-xs">
                        {CATEGORIES.map(({ value, label }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => onCategoryChange(value)}
                                aria-pressed={category === value}
                                className={`focus-ring px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-200 active:scale-[0.98] ${
                                    category === value
                                        ? 'bg-card text-foreground shadow-sm border border-border'
                                        : 'text-muted-foreground hover:text-foreground border border-transparent'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Unified number stepper (moved from page.tsx) */}
                <div>
                    <label className="block eyebrow mb-3">
                        Photo count
                    </label>
                    <div className="flex h-[38px] border border-border rounded-xl overflow-hidden bg-background divide-x divide-border w-max shadow-xs">
                        <button
                            type="button"
                            onClick={() => onNumImagesChange(Math.max(1, numImages - 1))}
                            disabled={numImages <= 1}
                            className="focus-ring w-10 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground active:bg-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-lg font-light leading-none"
                        >
                            −
                        </button>
                        <span className="w-14 flex items-center justify-center text-[14px] font-bold tabular-nums text-foreground bg-card">
                            {numImages}
                        </span>
                        <button
                            type="button"
                            onClick={() => onNumImagesChange(Math.min(10, numImages + 1))}
                            disabled={numImages >= 10}
                            className="focus-ring w-10 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground active:bg-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-lg font-light leading-none"
                        >
                            +
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Scene description ── */}
            <div className="paper-card p-6">
                <label className="block eyebrow mb-3">
                    Scene description
                    <span className="ml-[1ex] lowercase font-normal italic normal-case text-muted-foreground">(optional)</span>
                </label>
                <textarea
                    value={prompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                    placeholder={PLACEHOLDERS[category]}
                    rows={3}
                    className="focus-ring w-full bg-background border border-border rounded-xl px-4 py-3 text-[13.5px] font-medium text-foreground placeholder:text-muted-foreground resize-none transition-all leading-relaxed
                      hover:border-primary/30 shadow-xs
                      focus:border-primary/50 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-ring)_15%,transparent)]"
                />
                
                {/* Visual suggestion chips */}
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
                    {['☀️ Daylight & shadows', '🏛️ Marble podium', '🌿 Botanical backdrop', '🎬 Moody editorial'].map((chip) => (
                        <button
                            key={chip}
                            type="button"
                            onClick={() => onPromptChange(chip.replace(/^[^\s]+\s/, '') + ', highly detailed, sharp focus')}
                            className="text-[12px] font-medium text-muted-foreground bg-muted/40 hover:bg-muted border border-border hover:text-foreground px-3 py-1.5 rounded-full transition-colors active:scale-[0.98]"
                        >
                            {chip}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
