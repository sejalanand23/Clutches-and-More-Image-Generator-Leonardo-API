// Types for all API responses

export interface Job {
    id: string;
    prompt: string;
    category: 'bags' | 'jewelry';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: string;
    num_images: number;
    status_message?: string;
    input_images: string[];
    output_images: string[];
}

export interface CreateJobResponse {
    job_id: string;
    status: string;
}

export interface UploadResponse {
    job_id: string;
    uploaded: number;
    urls: string[];
}
