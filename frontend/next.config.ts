/** @type {import('next').NextConfig} */
import path from 'path';

const nextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'cdn.leonardo.ai',
      },
    ],
  },
};

export default nextConfig;
