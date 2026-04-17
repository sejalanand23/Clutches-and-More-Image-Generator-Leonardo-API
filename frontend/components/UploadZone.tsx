'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, ImagePlus } from 'lucide-react';

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

    // Keep a stable objectURL per file and revoke removed ones to avoid leaking memory.
    useEffect(() => {
        const nextKeys = new Set(files.map(fileKey));
        const map = urlByKeyRef.current;

        // Revoke URLs for files removed from the list.
        for (const [key, url] of map.entries()) {
            if (!nextKeys.has(key)) {
                URL.revokeObjectURL(url);
                map.delete(key);
            }
        }

        // Create URLs for newly added files.
        for (const file of files) {
            const key = fileKey(file);
            if (!map.has(key)) map.set(key, URL.createObjectURL(file));
        }

        // Trigger a re-render with a snapshot of the current map.
        setUrlByKey(new Map(map));
    }, [files]);

    // Revoke everything on unmount.
    useEffect(() => {
        return () => {
            const map = urlByKeyRef.current;
            for (const url of map.values()) URL.revokeObjectURL(url);
            map.clear();
        };
    }, []);

    const fileItems = useMemo(
        () =>
            files.map((file, idx) => ({
                file,
                idx,
                key: fileKey(file),
            })),
        [files, urlByKey]
    );

    return (
        <div className="space-y-3">
            {/* Drop zone */}
            <div
                {...getRootProps({ tabIndex: 0 })}
                className={`focus-ring relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${isDragActive
                        ? 'border-[color:color-mix(in_oklch,var(--color-accent)_55%,var(--color-border))] bg-[color:color-mix(in_oklch,var(--color-accent)_10%,transparent)] scale-[1.01]'
                        : 'border-border hover:bg-glass'
                    }`}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                    <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isDragActive ? 'bg-[color:color-mix(in_oklch,var(--color-accent)_14%,transparent)]' : 'bg-glass'
                            }`}
                    >
                        {isDragActive ? (
                            <Upload className="w-5 h-5 text-[color:color-mix(in_oklch,var(--color-accent)_70%,var(--color-foreground))]" />
                        ) : (
                            <ImagePlus className="w-5 h-5 text-faint" />
                        )}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-foreground">
                            {isDragActive ? 'Drop images here' : 'Drag & drop product images'}
                        </p>
                        <p className="text-xs text-faint mt-0.5">
                            JPG, PNG, WEBP · multiple files supported
                        </p>
                    </div>
                </div>
            </div>

            {/* Preview grid */}
            {files.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {fileItems.map(({ file, idx, key }) => {
                        const url = urlByKey.get(key);

                        return (
                        <div
                            key={key}
                            className="relative aspect-square rounded-xl overflow-hidden group bg-glass"
                        >
                            {url ? (
                                <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={url}
                                        alt={file.name}
                                        className="w-full h-full object-cover"
                                    />
                                </>
                            ) : (
                                <div className="w-full h-full bg-glass" />
                            )}
                            <button
                                type="button"
                                onClick={() => remove(idx)}
                                aria-label={`Remove ${file.name}`}
                                className="focus-ring absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="w-3 h-3 text-white" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 translate-y-full group-hover:translate-y-0 transition-transform">
                                <p className="text-[10px] text-white/90 truncate">{file.name}</p>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
