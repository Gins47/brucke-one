// Keep ordinary application E2E tests independent from local bootstrap settings.
process.env.ADMIN_BOOTSTRAP_ENABLED = 'false';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-thirty-two-bytes';
process.env.JWT_EXPIRES_IN = '24h';
process.env.JWT_ISSUER = 'brucke-one-test';
process.env.JWT_AUDIENCE = 'brucke-one-test';
