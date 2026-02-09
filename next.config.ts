import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: [
    'genkit',
    '@genkit-ai/google-genai',
    '@genkit-ai/next',
    '@genkit-ai/core',
    '@genkit-ai/flow',
    '@opentelemetry/api',
    '@opentelemetry/context-async-hooks',
    'node-fetch',
    'wav',
    'nodemailer',
    'twilio',
    'googleapis',
    'node-quickbooks',
    'papaparse',
    'xlsx'
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;