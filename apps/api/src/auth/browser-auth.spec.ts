import { browserCookieOptions } from './browser-auth';

describe('browser cookie settings', () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it('uses Secure outside the documented localhost development setup', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.WEB_ORIGIN;
    expect(browserCookieOptions().secure).toBe(true);
    process.env.NODE_ENV = 'development';
    process.env.WEB_ORIGIN = 'http://example.test';
    expect(browserCookieOptions().secure).toBe(true);
    process.env.WEB_ORIGIN = 'http://localhost:3001';
    expect(browserCookieOptions().secure).toBe(false);
  });
});
