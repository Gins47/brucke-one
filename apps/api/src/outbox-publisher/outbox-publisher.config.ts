import 'dotenv/config';

/** Defines the Redis setting used for outbox publication. */
export type RedisConfig = {
  url: string;
};

/** Returns validated Redis settings required for the outbox publisher. */
export function getRedisConfig(): RedisConfig {
  const url = process.env.REDIS_URL?.trim();

  if (!url) {
    throw new Error('REDIS_URL is required for outbox publication');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL');
  }

  if (parsedUrl.protocol !== 'redis:' && parsedUrl.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use the redis:// or rediss:// protocol');
  }

  return { url };
}
