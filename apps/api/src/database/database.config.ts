import 'dotenv/config';

export function getDatabaseUrl(): string {
  const isTestDatabase = process.env.DATABASE_TARGET === 'test';
  const value = isTestDatabase
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

  if (!value?.trim()) {
    const variableName = isTestDatabase ? 'TEST_DATABASE_URL' : 'DATABASE_URL';
    throw new Error(`${variableName} is required for database access`);
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
