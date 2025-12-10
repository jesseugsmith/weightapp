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
      const originalExternals = config.externals;
      
      config.externals = (context, request, callback) => {
        // Don't externalize @novu packages or zod
        if (request && (request.includes('@novu') || request === 'zod' || request.startsWith('zod/'))) {
          return callback();
        }
        
        // Apply default externalization for other packages
        if (typeof originalExternals === 'function') {
          return originalExternals(context, request, callback);
        }
        if (Array.isArray(originalExternals)) {
          for (const external of originalExternals) {
            if (typeof external === 'function') {
              const result = external(context, request, callback);
              if (result !== undefined) return result;
            } else if (typeof external === 'string' && request === external) {
              return callback();
            }
          }
        }
        return callback();
      };

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
