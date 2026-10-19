import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  authenticatedRequest,
  getTestAdminAccessToken,
} from './test-authentication';

let accessToken: string;

type OrganizationResponse = {
  id: string;
  code: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  officeAddress: string | null;
};

/** Creates one organization through the public API for an HTTP test case. */
async function createOrganization(
  app: INestApplication<App>,
  overrides: Partial<{
    code: string;
    name: string;
    contactEmail: string;
    contactPhone: string;
    officeAddress: string;
  }> = {},
): Promise<OrganizationResponse> {
  const response = await authenticatedRequest(app, accessToken)
    .post('/organizations')
    .send({
      code: `ORG-${randomUUID().slice(0, 26)}`,
      name: 'Test Relief Organization',
      contactEmail: 'contact@example.com',
      contactPhone: '+49123456789',
      officeAddress: 'Munich, 82194',
      ...overrides,
    })
    .expect(201);

  return response.body as OrganizationResponse;
}

describe('Organizations API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    accessToken = await getTestAdminAccessToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates an organization', async () => {
    const organization = await createOrganization(app, {
      code: 'BAY-RELIEF',
      name: 'Bavarian Relief Organization',
      contactEmail: 'test@gmail.com',
    });

    expect(typeof organization.id).toBe('string');
    expect(organization).toMatchObject({
      code: 'BAY-RELIEF',
      name: 'Bavarian Relief Organization',
      contactEmail: 'test@gmail.com',
    });
  });

  it('returns a persisted organization by ID and in the list', async () => {
    const organization = await createOrganization(app);

    await authenticatedRequest(app, accessToken)
      .get(`/organizations/${organization.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject(organization);
      });

    await authenticatedRequest(app, accessToken)
      .get('/organizations')
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.arrayContaining([expect.objectContaining(organization)]),
        );
      });
  });

  it('updates only supplied fields', async () => {
    const organization = await createOrganization(app);

    await authenticatedRequest(app, accessToken)
      .patch(`/organizations/${organization.id}`)
      .send({ name: 'Updated Relief Organization' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: organization.id,
          code: organization.code,
          name: 'Updated Relief Organization',
          contactEmail: organization.contactEmail,
          contactPhone: organization.contactPhone,
          officeAddress: organization.officeAddress,
        });
      });
  });

  it('rejects code, unknown fields, and an empty body on PATCH', async () => {
    const organization = await createOrganization(app);

    await authenticatedRequest(app, accessToken)
      .patch(`/organizations/${organization.id}`)
      .send({ code: 'IMMUTABLE' })
      .expect(400);

    await authenticatedRequest(app, accessToken)
      .patch(`/organizations/${organization.id}`)
      .send({ unknown: 'value' })
      .expect(400);

    await authenticatedRequest(app, accessToken)
      .patch(`/organizations/${organization.id}`)
      .send({})
      .expect(400);
  });

  it('returns not found for an unknown organization ID', async () => {
    await authenticatedRequest(app, accessToken)
      .get('/organizations/74967c13-7f77-4b59-95bc-fc4590ed9821')
      .expect(404);
  });

  it('returns conflict for a duplicate organization code', async () => {
    const code = `DUP-${randomUUID().slice(0, 26)}`;
    await createOrganization(app, { code });

    await authenticatedRequest(app, accessToken)
      .post('/organizations')
      .send({ code, name: 'Duplicate Organization' })
      .expect(409);
  });
});
