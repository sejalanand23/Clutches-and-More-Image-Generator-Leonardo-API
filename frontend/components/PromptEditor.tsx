'use client';

interface PromptEditorProps {
    prompt: string;
    category: 'bags' | 'jewelry';
    onPromptChange: (v: string) => void;
    onCategoryChange: (v: 'bags' | 'jewelry') => void;
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
}: PromptEditorProps) {
    return (
        <div className="space-y-3">
            {/* Section label */}
            <div>
                <label className="block text-[13px] font-semibold text-foreground mb-2">
                    Product category
                </label>
                {/* Segmented control */}
                <div className="flex gap-1 p-1 bg-surface-2 rounded-xl border border-border w-fit">
                    {CATEGORIES.map(({ value, label }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => onCategoryChange(value)}
                            aria-pressed={category === value}
                            className={`focus-ring px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 active:scale-[0.98] ${
                                category === value
                                    ? 'bg-white text-foreground shadow-sm border border-border'
                                    : 'text-faint hover:text-secondary'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Prompt */}
            <div>
                <label className="block text-[13px] font-semibold text-foreground mb-2">
                    Scene description
                    <span className="ml-1.5 text-[11px] font-normal text-muted">(optional)</span>
                </label>
                <textarea
                    value={prompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                    placeholder={PLACEHOLDERS[category]}
                    rows={3}
                    className="focus-ring w-full bg-white border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted resize-none transition-all leading-relaxed
                      hover:border-[color:color-mix(in_oklch,var(--color-accent)_30%,var(--color-border))]
                      focus:border-[color:color-mix(in_oklch,var(--color-accent)_50%,var(--color-border))]
                      focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-accent)_12%,transparent)]"
                />
                <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
                    Leave blank to use the default {category === 'bags' ? 'bags' : 'jewelry'} prompt. Pose &amp; angle variations are added automatically.
                </p>
            </div>
        </div>
    );
}
