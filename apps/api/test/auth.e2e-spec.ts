import {
  Controller,
  Get,
  INestApplication,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AdminBootstrapService } from '../src/auth/admin-bootstrap.service';
import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthenticationGuard } from '../src/auth/jwt-authentication.guard';
import { getJwtConfig } from '../src/auth/jwt.config';
import { DatabaseService } from '../src/database/database.service';
import { roles, userRoles, users } from '../src/database/schema';

const originalEnv = { ...process.env };
const testUsername = 'auth-test-admin';
const testPassword = 'test-auth-password';

type AuthenticatedRequest = {
  authenticatedUserId?: string;
};

type LoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
};

/** Exposes the guard's authenticated subject only for focused HTTP tests. */
@Controller('auth-test')
class AuthenticatedTestController {
  /** Returns the request identity that the authentication guard verified. */
  @Get('protected')
  @UseGuards(JwtAuthenticationGuard)
  protected(@Req() request: AuthenticatedRequest): { userId?: string } {
    return { userId: request.authenticatedUserId };
  }
}

/** Sets isolated development settings used to create one test administrator. */
function setBootstrapEnvironment(): void {
  process.env.DATABASE_TARGET = 'test';
  process.env.NODE_ENV = 'development';
  process.env.ADMIN_BOOTSTRAP_ENABLED = 'true';
  process.env.ADMIN_USERNAME = testUsername;
  process.env.ADMIN_PASSWORD = testPassword;
}

/** Prevents automatic bootstrap in the ordinary application test setup. */
function disableBootstrap(): void {
  process.env.ADMIN_BOOTSTRAP_ENABLED = 'false';
  process.env.NODE_ENV = 'test';
}

/** Deletes only identity test records after confirming the isolated database target. */
async function clearIdentityData(database: DatabaseService): Promise<void> {
  if (process.env.DATABASE_TARGET !== 'test') {
    throw new Error('Authentication tests require DATABASE_TARGET=test');
  }

  await database.db.delete(userRoles);
  await database.db.delete(users);
  await database.db.delete(roles);
}

describe('Auth API (e2e)', () => {
  let module: TestingModule;
  let app: INestApplication<App>;
  let database: DatabaseService;
  let bootstrap: AdminBootstrapService;
  let jwtService: JwtService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [AuthenticatedTestController],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    database = module.get(DatabaseService);
    bootstrap = module.get(AdminBootstrapService);
    jwtService = module.get(JwtService);
  });

  beforeEach(async () => {
    await clearIdentityData(database);
    setBootstrapEnvironment();
    await bootstrap.bootstrap();
    disableBootstrap();
  });

  afterAll(async () => {
    process.env = { ...originalEnv };
    if (app) {
      await app.close();
    }
  });

  it('logs in a bootstrapped admin and exposes its user ID to the guard', async () => {
    const [user] = await database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, testUsername));

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: ` ${testUsername.toUpperCase()} `,
        password: testPassword,
      })
      .expect(201);
    const loginBody = login.body as unknown as LoginResponse;

    expect(typeof loginBody.accessToken).toBe('string');
    expect(loginBody).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: '24h',
    });

    await request(app.getHttpServer())
      .get('/auth-test/protected')
      .set('Authorization', `Bearer ${loginBody.accessToken}`)
      .expect(200)
      .expect({ userId: user.id });
  });

  it('returns the same generic response for unknown and incorrect credentials', async () => {
    const unknown = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'unknown-admin', password: testPassword })
      .expect(401);
    const incorrect = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: testUsername, password: 'incorrect-password' })
      .expect(401);

    expect(unknown.body).toEqual(incorrect.body);
    expect(unknown.body).toMatchObject({
      statusCode: 401,
      message: 'Invalid username or password',
    });
  });

  it('rejects unknown login fields with the project validation response', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: testUsername,
        password: testPassword,
        unexpected: true,
      })
      .expect(400)
      .expect((response) => {
        expect(response.body).toMatchObject({
          statusCode: 400,
          message: 'Request validation failed',
          errors: [
            expect.objectContaining({
              field: '',
              code: 'unrecognized_keys',
            }),
          ],
        });
      });
  });

  it('rejects malformed and unsupported stored password hashes safely', async () => {
    const malformedHash =
      'argon2id$v1$m=999999999,t=3,p=2,l=32$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const unsupportedHash =
      'argon2i$v1$m=65536,t=3,p=2,l=32$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    await database.db
      .update(users)
      .set({ passwordHash: malformedHash })
      .where(eq(users.username, testUsername));

    const malformed = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: testUsername, password: testPassword })
      .expect(401);

    await database.db
      .update(users)
      .set({ passwordHash: unsupportedHash })
      .where(eq(users.username, testUsername));

    const unsupported = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: testUsername, password: testPassword })
      .expect(401);

    expect(malformed.body).toEqual(unsupported.body);
  });

  it('rejects missing, invalid, and expired bearer tokens', async () => {
    await request(app.getHttpServer()).get('/auth-test/protected').expect(401);
    await request(app.getHttpServer())
      .get('/auth-test/protected')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    const [user] = await database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, testUsername));
    const config = getJwtConfig();
    const expiredToken = await jwtService.signAsync(
      { sub: user.id },
      {
        secret: config.secret,
        algorithm: 'HS256',
        expiresIn: -1,
        issuer: config.issuer,
        audience: config.audience,
      },
    );

    await request(app.getHttpServer())
      .get('/auth-test/protected')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });

  it('rejects signed tokens with invalid claims or a disallowed algorithm', async () => {
    const [user] = await database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, testUsername));
    const config = getJwtConfig();
    const tokens = await Promise.all([
      jwtService.signAsync(
        { sub: user.id },
        {
          secret: config.secret,
          algorithm: 'HS256',
          issuer: 'unexpected-issuer',
          audience: config.audience,
        },
      ),
      jwtService.signAsync(
        { sub: user.id },
        {
          secret: config.secret,
          algorithm: 'HS256',
          issuer: config.issuer,
          audience: 'unexpected-audience',
        },
      ),
      jwtService.signAsync(
        { sub: user.id },
        {
          secret: config.secret,
          algorithm: 'HS384',
          issuer: config.issuer,
          audience: config.audience,
        },
      ),
      jwtService.signAsync(
        { sub: 'not-a-uuid' },
        {
          secret: config.secret,
          algorithm: 'HS256',
          issuer: config.issuer,
          audience: config.audience,
        },
      ),
    ]);

    for (const token of tokens) {
      await request(app.getHttpServer())
        .get('/auth-test/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    }
  });

  it('fails clearly when JWT configuration is missing or invalid', () => {
    delete process.env.JWT_SECRET;
    expect(() => getJwtConfig()).toThrow(
      'JWT_SECRET is required for JWT authentication',
    );

    process.env.JWT_SECRET = 'too-short';
    expect(() => getJwtConfig()).toThrow(
      'JWT_SECRET must be at least 32 bytes long',
    );

    process.env.JWT_SECRET =
      'test-jwt-secret-that-is-at-least-thirty-two-bytes';
    process.env.JWT_EXPIRES_IN = 'tomorrow';
    expect(() => getJwtConfig()).toThrow(
      'JWT_EXPIRES_IN must be a positive duration such as 24h',
    );

    process.env.JWT_EXPIRES_IN = '24h';
  });
});
