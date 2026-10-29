import 'dotenv/config';

const e2eDatabaseTarget = process.env.E2E_DATABASE_TARGET ?? 'test';

if (e2eDatabaseTarget !== 'test' && e2eDatabaseTarget !== 'development') {
  throw new Error('E2E_DATABASE_TARGET must be "test" or "development"');
}

// Direct Jest and IDE E2E runs use the disposable database unless development
// is explicitly selected with E2E_DATABASE_TARGET=development.
process.env.DATABASE_TARGET = e2eDatabaseTarget;

// Keep ordinary application E2E tests independent from local bootstrap settings.
process.env.ADMIN_BOOTSTRAP_ENABLED = 'false';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-thirty-two-bytes';
process.env.JWT_EXPIRES_IN = '24h';
process.env.JWT_ISSUER = 'brucke-one-test';
process.env.JWT_AUDIENCE = 'brucke-one-test';
