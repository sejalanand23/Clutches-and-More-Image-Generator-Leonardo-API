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
        <div className="paper-card p-6 space-y-4">
            <label className="block eyebrow mb-1">
                Product images
            </label>

            {/* Drop zone */}
            <div
                {...getRootProps({ tabIndex: 0 })}
                className={`group/dropzone focus-ring relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-300 ${
                    isDragActive
                        ? 'border-primary bg-primary/5 scale-[1.005]'
                        : 'border-border bg-background hover:border-primary/40 hover:bg-card'
                }`}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-4 py-10 pointer-events-none">
                    <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover/dropzone:rotate-[4deg] ${
                            isDragActive
                                ? 'bg-primary/10 border border-primary/20 scale-110'
                                : 'bg-card border border-border shadow-xs group-hover/dropzone:shadow-sm group-hover/dropzone:bg-white'
                        }`}
                    >
                        {isDragActive ? (
                            <Upload className="w-5 h-5 text-primary" />
                        ) : (
                            <ImageIcon className="w-5 h-5 text-muted-foreground" />
                        )}
                    </div>
                    <div className="text-center">
                        <p className="text-[13.5px] font-semibold text-foreground">
                            {isDragActive ? 'Drop to upload' : 'Drag & drop images here'}
                        </p>
                        <p className="text-[12px] text-muted-foreground mt-1">
                            or <span className="text-accent font-medium hover:underline underline-offset-2">browse files</span>
                            &ensp;·&ensp;JPG, PNG, WEBP
                        </p>
                    </div>
                </div>
            </div>

            {/* Preview grid */}
            {fileItems.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 animate-fade-in pt-1">
                    {fileItems.map(({ file, idx, key }) => {
                        const url = urlByKey.get(key);
                        return (
                            <div key={key} className="relative aspect-square rounded-xl overflow-hidden group bg-muted border border-border shadow-xs">
                                {url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={url} alt={file.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-muted" />
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
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1.5 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                                    <p className="text-[10px] text-white/90 truncate leading-tight font-medium">{file.name}</p>
                                </div>
                            </div>
                        );
                    })}
                    {/* "Add more" tile */}
                    <div
                        {...getRootProps({ tabIndex: -1 })}
                        className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/40 bg-card hover:bg-primary/5 flex items-center justify-center cursor-pointer transition-colors shadow-none hover:shadow-sm"
                    >
                        <input {...getInputProps()} />
                        <Upload className="w-4 h-4 text-muted-foreground" />
                    </div>
                </div>
            )}
        </div>
    );
}
