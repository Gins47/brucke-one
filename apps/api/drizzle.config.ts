import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const databaseUrl =
  process.env.DATABASE_TARGET === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl!,
  },
});
