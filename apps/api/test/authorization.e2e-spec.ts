import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';

import { hashPassword } from '../src/auth/password-hash';
import { DatabaseService } from '../src/database/database.service';
import { roles, userRoles, users } from '../src/database/schema';
import { AppModule } from '../src/app.module';
import {
  authenticatedRequest,
  getTestAdminAccessToken,
} from './test-authentication';

const adminRoleName = 'ADMIN';
const testAdminUsername = 'e2e-admin';
const testAdminPassword = 'e2e-admin-password';
const testPassword = 'authorization-test-password';

/** Returns the shared test administrator's current ADMIN role assignment. */
async function getAdminAssignment(database: DatabaseService): Promise<{
  userId: string;
  roleId: string;
}> {
  const [assignment] = await database.db
    .select({ userId: userRoles.userId, roleId: userRoles.roleId })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(eq(users.username, testAdminUsername), eq(roles.name, adminRoleName)),
    )
    .limit(1);

  if (!assignment) {
    throw new Error('Isolated test administrator assignment was not found');
  }

  return assignment;
}

/** Creates a user without an ADMIN role for an authorization test case. */
async function createUserWithoutAdminRole(
  database: DatabaseService,
): Promise<{ id: string; username: string }> {
  const username = `non-admin-${randomUUID()}`;
  const [user] = await database.db
    .insert(users)
    .values({
      username,
      passwordHash: await hashPassword(testPassword),
    })
    .returning({ id: users.id, username: users.username });

  return user;
}

/** Logs in a test user through the public endpoint and returns its access token. */
async function login(
  app: INestApplication<App>,
  username: string,
  password: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ username, password })
    .expect(201);

  return (response.body as { accessToken: string }).accessToken;
}

describe('API authorization (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let adminAccessToken: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    database = module.get(DatabaseService);
    adminAccessToken = await getTestAdminAccessToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects anonymous requests for every protected controller', async () => {
    const routes = [
      '/',
      '/organizations',
      '/emergency-operations',
      '/shelters',
      '/shelter-activations',
      `/emergency-operations/${randomUUID()}/affected-regions`,
      `/dashboard/organizations/${randomUUID()}/overview`,
      `/dashboard/organizations/${randomUUID()}/operations`,
      `/dashboard/emergency-operations/${randomUUID()}/map`,
    ];

    for (const route of routes) {
      await request(app.getHttpServer()).get(route).expect(401);
    }

    await request(app.getHttpServer())
      .post('/organizations')
      .send({ code: `ANON-${randomUUID().slice(0, 20)}`, name: 'Anonymous' })
      .expect(401);
  });

  it('allows an authenticated admin to read and perform an existing write', async () => {
    await authenticatedRequest(app, adminAccessToken)
      .post('/organizations')
      .send({
        code: `ADMIN-${randomUUID().slice(0, 20)}`,
        name: 'Authenticated Administrator Organization',
      })
      .expect(201);

    await authenticatedRequest(app, adminAccessToken)
      .get('/organizations')
      .expect(200);
  });

  it('keeps login public', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: testAdminUsername, password: testAdminPassword })
      .expect(201);
  });

  it('rejects a valid token for a user without a current ADMIN assignment', async () => {
    const user = await createUserWithoutAdminRole(database);
    const accessToken = await login(app, user.username, testPassword);

    await authenticatedRequest(app, accessToken)
      .get('/organizations')
      .expect(403);
  });

  it('rejects an admin token after its ADMIN assignment is removed', async () => {
    const assignment = await getAdminAssignment(database);
    const accessToken = await login(app, testAdminUsername, testAdminPassword);

    await database.db
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, assignment.userId),
          eq(userRoles.roleId, assignment.roleId),
        ),
      );

    await authenticatedRequest(app, accessToken)
      .get('/organizations')
      .expect(403);

    await database.db.insert(userRoles).values(assignment);
  });

  it('rejects a token after its user is removed', async () => {
    const user = await createUserWithoutAdminRole(database);
    const accessToken = await login(app, user.username, testPassword);

    await database.db.delete(users).where(eq(users.id, user.id));

    await authenticatedRequest(app, accessToken)
      .get('/organizations')
      .expect(403);
  });
});
