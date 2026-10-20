import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  enableDevelopmentCors,
  getDevelopmentCorsOptions,
} from './cors.config';

@Controller('cors-test')
class CorsTestController {
  /** Provides a route used only to verify configured CORS behavior. */
  @Get()
  findOne(): { ok: true } {
    return { ok: true };
  }
}

describe('getDevelopmentCorsOptions', () => {
  it('allows only the configured local frontend origin in development', () => {
    expect(
      getDevelopmentCorsOptions({
        NODE_ENV: 'development',
        WEB_ORIGIN: 'http://localhost:3001',
      }),
    ).toEqual({
      origin: 'http://localhost:3001',
      allowedHeaders: ['Content-Type', 'Authorization'],
      methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    });
  });

  it('does not enable CORS outside development', () => {
    expect(
      getDevelopmentCorsOptions({ NODE_ENV: 'production' }),
    ).toBeUndefined();
  });

  it('permits Authorization in a preflight from the configured local origin', async () => {
    const module = await Test.createTestingModule({
      controllers: [CorsTestController],
    }).compile();
    const app: INestApplication<App> = module.createNestApplication();
    enableDevelopmentCors(app, {
      NODE_ENV: 'development',
      WEB_ORIGIN: 'http://localhost:3001',
    });
    await app.init();

    try {
      const response = await request(app.getHttpServer())
        .options('/cors-test')
        .set('Origin', 'http://localhost:3001')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Authorization')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3001',
      );
      expect(response.headers['access-control-allow-headers']).toContain(
        'Authorization',
      );
    } finally {
      await app.close();
    }
  });
});
