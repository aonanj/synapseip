/**
 * Next.js configuration with optional GlitchTip (Sentry-compatible) support.
 * If @sentry/nextjs is not installed, this falls back to the base config.
 */

import { createRequire } from "module";

const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const baseConfig = {
  async redirects() {
    return [
      // old vercel hostname → new primary
      {
        source: "/:path*",
        has: [{ type: "host", value: "patent-scout.vercel.app" }],
        destination: "https://www.synapse-ip.com/:path*",
        permanent: true,
      },

      // if moving the brand/domain
      {
        source: "/:path*",
        has: [{ type: "host", value: "patent-scout.com" }],
        destination: "https://www.synapse-ip.com/:path*",
        permanent: true,
      },

      // www → apex for new brand (currently commented out in your original)
      // {
      //   source: "/:path*",
      //   has: [{ type: "host", value: "synapse-ip.com" }],
      //   destination: "https://www.synapse-ip.com/:path*",
      //   permanent: true,
      // },
    ];
  },
};

const glitchtipUrl = process.env.GLITCHTIP_URL || process.env.SENTRY_URL;
const glitchtipOrg =
  process.env.GLITCHTIP_ORG || process.env.SENTRY_ORG || "phaethon-order-llc";
const glitchtipProject =
  process.env.GLITCHTIP_PROJECT ||
  process.env.SENTRY_PROJECT ||
  "python-fastapi";
const glitchtipAuthToken =
  process.env.GLITCHTIP_AUTH_TOKEN || process.env.SENTRY_AUTH_TOKEN;

// Start with base config
let finalConfig = baseConfig;

// Only attempt to wrap with Sentry/GlitchTip if we have the essentials
if (glitchtipUrl && glitchtipAuthToken) {
  try {
    // Optional dependency: only used if installed
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    const { withSentryConfig } = require("@sentry/nextjs");

    const sentryOptions = {
      org: glitchtipOrg,
      project: glitchtipProject,
      authToken: glitchtipAuthToken,
      sentryUrl: glitchtipUrl,
      // Delete source maps after upload so they do not ship with the client bundle
      sourcemaps: {
        deleteSourcemapsAfterUpload: true,
      },
      // Only print logs for uploading source maps in CI
      silent: !process.env.CI,
    };

    finalConfig = withSentryConfig(baseConfig, sentryOptions);
  } catch (err) {
    // @sentry/nextjs not installed or failed to load; fall back to base config
    // Intentionally swallow the error to keep builds working without Sentry.
  }
}

// Single, top-level default export (required in ESM)
export default finalConfig;
