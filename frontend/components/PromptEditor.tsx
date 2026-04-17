'use client';

import { Sparkles } from 'lucide-react';

const BAGS_PLACEHOLDER = `ultra-realistic luxury product photography, placed on a perfectly styled surface in a beautifully lit environment, professional commercial studio photography, highly detailed, sharp focus`;
const JEWELRY_PLACEHOLDER = `ultra-realistic luxury product photography, displayed on an elegant surface in a beautifully lit environment, professional commercial studio photography, highly detailed, sharp focus, macro detail`;

interface PromptEditorProps {
    prompt: string;
    category: 'bags' | 'jewelry';
    onPromptChange: (v: string) => void;
    onCategoryChange: (v: 'bags' | 'jewelry') => void;
}

export default function PromptEditor({
    prompt,
    category,
    onPromptChange,
    onCategoryChange,
}: PromptEditorProps) {
    return (
        <div className="space-y-3">
            {/* Category tabs */}
            <div className="flex gap-1 p-1 bg-glass rounded-xl w-fit border border-border">
                {(['bags', 'jewelry'] as const).map((cat) => (
                    <button
                        key={cat}
                        type="button"
                        onClick={() => onCategoryChange(cat)}
                        aria-pressed={category === cat}
                        className={`focus-ring px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all duration-200 active:translate-y-px ${category === cat
                                ? 'bg-accent text-accent-foreground shadow-sm'
                                : 'text-faint hover:text-foreground'
                            }`}
                    >
                        {cat === 'bags' ? '👜 Bags' : '💍 Jewelry'}
                    </button>
                ))}
            </div>

            {/* Prompt textarea */}
            <div className="relative">
                <textarea
                    value={prompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                    placeholder={category === 'bags' ? BAGS_PLACEHOLDER : JEWELRY_PLACEHOLDER}
                    rows={3}
                    className="focus-ring w-full bg-glass border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-faint resize-none transition-all
                      focus:bg-glass-hover focus:border-[color:color-mix(in_oklch,var(--color-accent)_40%,var(--color-border))]"
                />
                <div className="absolute bottom-3 right-3 opacity-30">
                    <Sparkles className="w-4 h-4 text-[color:color-mix(in_oklch,var(--color-accent)_40%,var(--color-muted))]" />
                </div>
            </div>

            <p className="text-xs text-faint">
                Leave blank to use the default {category} prompt — or write your own.
                Pose &amp; angle variations are added automatically.
            </p>
        </div>
    );
}
