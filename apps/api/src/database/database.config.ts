import 'dotenv/config';

export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value?.trim()) {
    throw new Error('DATABASE_URL is required for database access');
  }

  return value;
}

export function getConnectionTimeout(): number {
  const value = process.env.CONNECTION_TIMEOUT;
  if (value === undefined) {
    return 5000;
  }

  const timeout = Number(value);
  if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 2147483647) {
    throw new Error(
      'CONNECTION_TIMEOUT must be a positive integer in milliseconds (maximum 2147483647)',
    );
  }

  return timeout;
}
