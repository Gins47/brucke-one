import { getConnectionTimeout, getDatabaseUrl } from './database.config';

describe('database configuration', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it.each([undefined, '', '   '])(
    'rejects an empty database URL (%s)',
    (value) => {
      delete process.env.TEST_DATABASE_URL;
      if (value === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = value;
      expect(() => getDatabaseUrl()).toThrow(
        'DATABASE_URL or TEST_DATABASE_URL is required',
      );
    },
  );

  it('prefers the dedicated test database URL', () => {
    process.env.DATABASE_URL = 'postgresql://development.example/bruke_one';
    process.env.TEST_DATABASE_URL = 'postgresql://test.example/bruke_one_test';

    expect(getDatabaseUrl()).toBe(process.env.TEST_DATABASE_URL);
  });

  it('uses a bounded default connection timeout', () => {
    delete process.env.CONNECTION_TIMEOUT;
    expect(getConnectionTimeout()).toBe(5000);
  });

  it('accepts a positive timeout in milliseconds', () => {
    process.env.CONNECTION_TIMEOUT = '2500';
    expect(getConnectionTimeout()).toBe(2500);
  });

  it.each([
    '',
    ' ',
    'invalid',
    '12ms',
    '0',
    '-1',
    '1.5',
    'Infinity',
    '2147483648',
  ])('rejects invalid connection timeout %s', (value) => {
    process.env.CONNECTION_TIMEOUT = value;
    expect(() => getConnectionTimeout()).toThrow('CONNECTION_TIMEOUT must be');
  });
});
