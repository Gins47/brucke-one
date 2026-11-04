// Jest maps BullMQ to a test double, so this URL cannot reach local Redis.
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
