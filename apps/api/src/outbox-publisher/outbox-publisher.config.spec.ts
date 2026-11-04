import { getRedisConfig } from './outbox-publisher.config';

describe('getRedisConfig', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
      return;
    }

    process.env.REDIS_URL = originalRedisUrl;
  });

  it('requires Redis configuration for the outbox publisher', () => {
    delete process.env.REDIS_URL;

    expect(() => getRedisConfig()).toThrow(
      'REDIS_URL is required for outbox publication',
    );
  });
});
