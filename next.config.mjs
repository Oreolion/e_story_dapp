import { withSentryConfig } from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    dirs: ["app", "components", "lib", "scripts", "contracts", "__tests__", "e2e"],
  },
  // Prevent DoS via oversized request bodies
  // NOTE: Next.js App Router does not support global bodyParser config.
  // Size limits are enforced in middleware (see middleware.ts) and
  // individual API routes via content-length checks.
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-icons",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-tooltip",
      "date-fns",
      "@supabase/supabase-js",
      "@tanstack/react-query",
      "react-hook-form",
      "zod",
    ],
  },
  // Turbopack config (used by next dev --turbopack)
  turbopack: {
    resolveAlias: {
      "@react-native-async-storage/async-storage": "./lib/empty.js",
    },
  },
  // Webpack config (used by next build)
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com${isDev ? " 'unsafe-eval'" : ""}`,
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.elevenlabs.io https://api.pinata.cloud https://*.walletconnect.com wss://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.org https://sepolia.base.org https://*.alchemy.com https://*.infura.io https://*.rpc.thirdweb.com https://api.web3modal.org https://*.reown.com https://cca-lite.coinbase.com https://*.coinbase.com https://rpc.walletconnect.org https://rpc.walletconnect.com https://*.sentry.io https://*.ingest.sentry.io https://va.vercel-scripts.com https://vitals.vercel-insights.com",
              "media-src 'self' https://*.supabase.co blob:",
              "frame-src 'self' https://*.walletconnect.com https://*.walletconnect.org https://*.reown.com",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Suppress source map upload warnings when SENTRY_AUTH_TOKEN is not set
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps for better stack traces in production
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry debug logs in production
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },

  // Hide source maps from users
  hideSourceMaps: true,

  // Tunnel Sentry events through the app to avoid ad blockers
  tunnelRoute: "/monitoring",
});
