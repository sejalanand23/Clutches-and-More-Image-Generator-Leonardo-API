'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, ImageIcon } from 'lucide-react';

interface UploadZoneProps {
    files: File[];
    onChange: (files: File[]) => void;
}

function fileKey(file: File) {
    return `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
}

export default function UploadZone({ files, onChange }: UploadZoneProps) {
    const urlByKeyRef = useRef<Map<string, string>>(new Map());
    const [urlByKey, setUrlByKey] = useState<Map<string, string>>(() => new Map());

    const onDrop = useCallback(
        (accepted: File[]) => {
            onChange([...files, ...accepted]);
        },
        [files, onChange]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
        multiple: true,
    });

    const remove = (idx: number) => {
        onChange(files.filter((_, i) => i !== idx));
    };

    // Manage stable object URLs, revoke removed ones.
    useEffect(() => {
        const nextKeys = new Set(files.map(fileKey));
        const map = urlByKeyRef.current;
        for (const [key, url] of map.entries()) {
            if (!nextKeys.has(key)) { URL.revokeObjectURL(url); map.delete(key); }
        }
        for (const file of files) {
            const key = fileKey(file);
            if (!map.has(key)) map.set(key, URL.createObjectURL(file));
        }
        setUrlByKey(new Map(map));
    }, [files]);

    // Revoke all on unmount.
    useEffect(() => {
        return () => {
            const map = urlByKeyRef.current;
            for (const url of map.values()) URL.revokeObjectURL(url);
            map.clear();
        };
    }, []);

    const fileItems = useMemo(
        () => files.map((file, idx) => ({ file, idx, key: fileKey(file) })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [files, urlByKey]
    );

    return (
        <div className="space-y-3">
            <label className="block text-[13px] font-semibold text-foreground">
                Product images
            </label>

            {/* Drop zone */}
            <div
                {...getRootProps({ tabIndex: 0 })}
                className={`focus-ring relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 ${
                    isDragActive
                        ? 'border-[color:var(--color-accent)] bg-[color:color-mix(in_oklch,var(--color-accent)_7%,transparent)] scale-[1.005]'
                        : 'border-border bg-white hover:border-[color:color-mix(in_oklch,var(--color-accent)_35%,var(--color-border))] hover:bg-surface-2'
                }`}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-3 py-10 pointer-events-none">
                    <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                            isDragActive
                                ? 'bg-[color:color-mix(in_oklch,var(--color-accent)_14%,transparent)]'
                                : 'bg-surface-2 border border-border'
                        }`}
                    >
                        {isDragActive ? (
                            <Upload className="w-5 h-5 text-[color:var(--color-accent)]" />
                        ) : (
                            <ImageIcon className="w-5 h-5 text-muted" />
                        )}
                    </div>
                    <div className="text-center">
                        <p className="text-[13px] font-semibold text-foreground">
                            {isDragActive ? 'Drop to upload' : 'Drag & drop images here'}
                        </p>
                        <p className="text-[12px] text-muted mt-1">
                            or <span className="text-[color:var(--color-accent)] font-medium">browse files</span>
                            &ensp;·&ensp;JPG, PNG, WEBP
                        </p>
                    </div>
                </div>
            </div>

            {/* Preview grid */}
            {fileItems.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 animate-fade-in">
                    {fileItems.map(({ file, idx, key }) => {
                        const url = urlByKey.get(key);
                        return (
                            <div key={key} className="relative aspect-square rounded-xl overflow-hidden group bg-surface-2 border border-border">
                                {url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={url} alt={file.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-surface-2" />
                                )}
                                {/* Remove button */}
                                <button
                                    type="button"
                                    onClick={() => remove(idx)}
                                    aria-label={`Remove ${file.name}`}
                                    className="focus-ring absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-3 h-3 text-white" />
                                </button>
                                {/* Filename tooltip on hover */}
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                                    <p className="text-[10px] text-white/90 truncate leading-tight">{file.name}</p>
                                </div>
                            </div>
                        );
                    })}
                    {/* "Add more" tile */}
                    <div
                        {...getRootProps({ tabIndex: -1 })}
                        className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-[color:color-mix(in_oklch,var(--color-accent)_40%,var(--color-border))] bg-surface-2 hover:bg-[color:color-mix(in_oklch,var(--color-accent)_5%,transparent)] flex items-center justify-center cursor-pointer transition-colors"
                    >
                        <input {...getInputProps()} />
                        <Upload className="w-4 h-4 text-muted" />
                    </div>
                </div>
            )}
        </div>
    );
}
