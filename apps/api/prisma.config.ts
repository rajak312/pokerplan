import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// `PRISMA_ENV_FILE=.env.test` points the CLI at the test database. Real env vars always win.
config({ path: process.env.PRISMA_ENV_FILE ?? '.env', quiet: true });

/**
 * Prisma CLI configuration.
 * `DIRECT_URL` (non-pooled) is preferred for migrations on Neon; the app itself
 * connects with `DATABASE_URL` (pooled) through the `@prisma/adapter-pg` driver adapter.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5433/pokerplan',
  },
});
