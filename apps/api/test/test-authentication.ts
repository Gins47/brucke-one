import type { INestApplication } from '@nestjs/common';
import { AdminBootstrapService } from '../src/auth/admin-bootstrap.service';
import request from 'supertest';
import type { Test } from 'supertest';
import type { App } from 'supertest/types';

const testUsername = 'e2e-admin';
const testPassword = 'e2e-admin-password';

type LoginResponse = {
  accessToken: string;
};

type AuthenticatedRequestFactory = {
  get(path: string): Test;
  post(path: string): Test;
  patch(path: string): Test;
};

/** Creates or reuses the isolated test administrator and returns its access token. */
export async function getTestAdminAccessToken(
  app: INestApplication<App>,
): Promise<string> {
  const originalEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    bootstrapEnabled: process.env.ADMIN_BOOTSTRAP_ENABLED,
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
  };

  try {
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_BOOTSTRAP_ENABLED = 'true';
    process.env.ADMIN_USERNAME = testUsername;
    process.env.ADMIN_PASSWORD = testPassword;
    await app.get(AdminBootstrapService).bootstrap();
  } finally {
    restoreEnvironment('NODE_ENV', originalEnvironment.nodeEnv);
    restoreEnvironment(
      'ADMIN_BOOTSTRAP_ENABLED',
      originalEnvironment.bootstrapEnabled,
    );
    restoreEnvironment('ADMIN_USERNAME', originalEnvironment.username);
    restoreEnvironment('ADMIN_PASSWORD', originalEnvironment.password);
  }

  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ username: testUsername, password: testPassword })
    .expect(201);
  const body = response.body as unknown as LoginResponse;

  return body.accessToken;
}

/** Adds the test administrator bearer token to an HTTP request. */
export function authenticatedRequest(
  app: INestApplication<App>,
  accessToken: string,
): AuthenticatedRequestFactory {
  const withToken = (test: Test): Test =>
    test.set('Authorization', `Bearer ${accessToken}`);

  return {
    get: (path) => withToken(request(app.getHttpServer()).get(path)),
    post: (path) => withToken(request(app.getHttpServer()).post(path)),
    patch: (path) => withToken(request(app.getHttpServer()).patch(path)),
  };
}

/** Restores one environment value after a bootstrap helper invocation. */
function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
