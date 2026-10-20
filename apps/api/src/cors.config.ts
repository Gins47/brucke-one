/** Returns the narrow CORS policy needed by the local Next.js development server. */
export function getDevelopmentCorsOptions(environment: NodeJS.ProcessEnv) {
  if (environment.NODE_ENV !== 'development') {
    return undefined;
  }

  return {
    origin: environment.WEB_ORIGIN ?? 'http://localhost:3001',
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  };
}
import type { INestApplication } from '@nestjs/common';

/** Applies the local CORS policy when the application runs in development. */
export function enableDevelopmentCors(
  app: INestApplication,
  environment: NodeJS.ProcessEnv,
): void {
  const options = getDevelopmentCorsOptions(environment);
  if (options) {
    app.enableCors(options);
  }
}
