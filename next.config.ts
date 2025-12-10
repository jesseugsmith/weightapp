import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable ESLint during builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript type checking during builds
  typescript: {
    ignoreBuildErrors: true,
  },
  
  output: 'standalone',
  
  // Explicitly set the output file tracing root to prevent lockfile confusion
  outputFileTracingRoot: __dirname,

  // Fix Novu SDK bundling issues on Vercel
  // Ensure @novu/api and Zod are properly bundled for serverless functions
  serverComponentsExternalPackages: [],

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent externalizing @novu/api and zod - they must be bundled
      // This preserves Zod's internal structure (_zod) in serverless functions
      
      // Filter out @novu and zod from externals array
      if (Array.isArray(config.externals)) {
        config.externals = config.externals.filter((external: any) => {
          if (typeof external === 'string') {
            return !external.includes('@novu') && 
                   !external.includes('zod');
          }
          return true;
        });
      }

      // If externals is a function, wrap it to exclude @novu and zod
      if (typeof config.externals === 'function') {
        const originalExternals = config.externals;
        config.externals = [
          // First check: don't externalize @novu or zod
          ({ request }: { request?: string }, callback: Function) => {
            if (request && (request.includes('@novu') || request === 'zod' || request.startsWith('zod/'))) {
              return; // Don't externalize - bundle it
            }
            callback(); // Continue to next check
          },
          // Then apply original externals
          originalExternals,
        ];
      }

      // Ensure Zod resolves to a single instance
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...config.resolve.alias,
        'zod': require.resolve('zod'),
      };
    }
    return config;
  },
  
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8090',
        pathname: '/api/files/**',
      },
      {
        protocol: 'https',
        hostname: 'apifit.absenthome.com',
        pathname: '/api/files/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },

  reactStrictMode: true,

  // Make environment variables available at build time
  env: {
    NEXT_PUBLIC_VERCEL_URL: process.env.VERCEL_URL,
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ];
  }
};

export default nextConfig;
