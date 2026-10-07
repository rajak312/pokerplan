/** Public runtime configuration (inlined by Next.js at build time). */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100').replace(
  /\/$/,
  '',
);
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3100').replace(
  /\/$/,
  '',
);
