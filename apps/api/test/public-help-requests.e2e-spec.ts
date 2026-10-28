import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { helpRequests } from '../src/database/schema';
import {
  authenticatedRequest,
  getTestAdminAccessToken,
} from './test-authentication';

type Organization = { id: string };
type Operation = { id: string; operationCode: string; countryCode: string };
type Acknowledgement = {
  acknowledgementReference: string;
  status: 'PENDING_REVIEW';
  acknowledgedAt: string;
  message: string;
};

const validRequest = {
  requesterName: 'Requesting Person',
  requesterPhone: '+49123456789',
  requesterEmail: 'person@example.test',
  groupSize: 2,
  locationDescription: 'Near the community centre',
  canTravelIndependently: true,
  medicalSupportNeeded: false,
};

/** Creates one organization for a public help-request HTTP scenario. */
async function createOrganization(
  app: INestApplication<App>,
): Promise<Organization> {
  const response = await authenticatedRequest(app, accessToken)
    .post('/organizations')
    .send({
      code: `PUBLIC-${randomUUID().slice(0, 20)}`,
      name: 'Public Help Request Test Organization',
    })
    .expect(201);

  return response.body as Organization;
}

/** Creates an operation in the requested country and optionally activates it. */
async function createOperation(
  app: INestApplication<App>,
  organizationId: string,
  countryCode: string,
  active = false,
): Promise<Operation> {
  const operationCode = `PUBLIC-${randomUUID().slice(0, 20)}`;
  const response = await authenticatedRequest(app, accessToken)
    .post('/emergency-operations')
    .send({
      organizationId,
      operationCode,
      name: `Public Help Request ${countryCode} Operation`,
      countryCode,
      type: 'FLOOD',
      severity: 'HIGH',
    })
    .expect(201);
  const operation = response.body as Operation;

  if (active) {
    await authenticatedRequest(app, accessToken)
      .post(`/emergency-operations/${operation.id}/activate`)
      .expect(201);
  }

  return operation;
}

/** Builds a public request payload for one selected emergency operation. */
function createRequestBody(
  emergencyOperationId: string,
  overrides: Partial<typeof validRequest> = {},
) {
  return { emergencyOperationId, ...validRequest, ...overrides };
}

let accessToken: string;

describe('Public help-request API (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    database = moduleFixture.get(DatabaseService);
    accessToken = await getTestAdminAccessToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists only active operations for the requested country without authentication', async () => {
    const organization = await createOrganization(app);
    const activeGermany = await createOperation(
      app,
      organization.id,
      'DE',
      true,
    );
    const inactiveGermany = await createOperation(app, organization.id, 'DE');
    const activeFrance = await createOperation(
      app,
      organization.id,
      'FR',
      true,
    );

    await authenticatedRequest(app, accessToken)
      .post(`/emergency-operations/${activeGermany.id}/affected-regions`)
      .send({ countryCode: 'DE', regionCode: 'DE-BY', regionName: 'Bavaria' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/public/countries/de/emergency-operations')
      .expect(200)
      .expect((response) => {
        const operations = response.body as Array<Record<string, unknown>>;
        expect(operations).toEqual(
          expect.arrayContaining([
            {
              id: activeGermany.id,
              operationCode: activeGermany.operationCode,
              name: 'Public Help Request DE Operation',
              countryCode: 'DE',
              affectedRegions: [
                {
                  countryCode: 'DE',
                  regionCode: 'DE-BY',
                  regionName: 'Bavaria',
                },
              ],
            },
          ]),
        );
        expect(
          operations.every((operation) => operation.countryCode === 'DE'),
        ).toBe(true);
        expect(
          operations.every((operation) => !('organizationId' in operation)),
        ).toBe(true);
        expect(operations.map((operation) => operation.id)).not.toContain(
          inactiveGermany.id,
        );
        expect(operations.map((operation) => operation.id)).not.toContain(
          activeFrance.id,
        );
      });
  });

  it('returns an empty array when the country has no active operations', async () => {
    await request(app.getHttpServer())
      .get('/public/countries/zz/emergency-operations')
      .expect(200)
      .expect([]);
  });

  it('accepts a valid unauthenticated request for an active country operation', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id, 'DE', true);

    const response = await request(app.getHttpServer())
      .post('/public/countries/de/help-requests')
      .send(createRequestBody(operation.id))
      .expect(201);

    const acknowledgement = response.body as unknown as Acknowledgement;
    expect(acknowledgement).toMatchObject({
      status: 'PENDING_REVIEW',
      message:
        'Your request has been received. Emergency staff will review it.',
    });
    expect(acknowledgement.acknowledgementReference).toMatch(
      /^[A-Za-z0-9_-]{24}$/,
    );
    expect(typeof acknowledgement.acknowledgedAt).toBe('string');
    const [stored] = await database.db
      .select()
      .from(helpRequests)
      .where(eq(helpRequests.emergencyOperationId, operation.id));
    expect(stored).toMatchObject({
      emergencyOperationId: operation.id,
      requesterEmail: 'person@example.test',
      status: 'PENDING_REVIEW',
    });
    expect(stored.publicReference).not.toBe(
      acknowledgement.acknowledgementReference,
    );
  });

  it('returns the same public-safe not-found response for wrong-country and inactive operations', async () => {
    const organization = await createOrganization(app);
    const foreignOperation = await createOperation(
      app,
      organization.id,
      'FR',
      true,
    );
    const inactiveOperation = await createOperation(app, organization.id, 'DE');

    const wrongCountry = await request(app.getHttpServer())
      .post('/public/countries/de/help-requests')
      .send(createRequestBody(foreignOperation.id))
      .expect(404);
    const inactive = await request(app.getHttpServer())
      .post('/public/countries/de/help-requests')
      .send(createRequestBody(inactiveOperation.id))
      .expect(404);
    const missing = await request(app.getHttpServer())
      .post('/public/countries/de/help-requests')
      .send(createRequestBody(randomUUID()))
      .expect(404);

    expect(wrongCountry.body).toEqual(inactive.body);
    expect(wrongCountry.body).toEqual(missing.body);
    expect(wrongCountry.body).toMatchObject({
      statusCode: 404,
      message: 'Emergency operation not found',
    });
  });

  it('returns structured validation errors for malformed or unknown public input', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id, 'DE', true);

    await request(app.getHttpServer())
      .post('/public/countries/de/help-requests')
      .send({ ...createRequestBody(operation.id), unknown: true })
      .expect(400)
      .expect((response) => {
        expect(response.body).toMatchObject({
          statusCode: 400,
          message: 'Request validation failed',
          errors: [
            expect.objectContaining({ field: '', code: 'unrecognized_keys' }),
          ],
        });
      });

    await request(app.getHttpServer())
      .post('/public/countries/de/help-requests')
      .send(createRequestBody(operation.id, { groupSize: 0 }))
      .expect(400);
  });

  it('acknowledges duplicate normalized email without creating another request', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id, 'DE', true);

    const first = await request(app.getHttpServer())
      .post('/public/countries/de/help-requests')
      .send(createRequestBody(operation.id))
      .expect(201);
    const firstAcknowledgement = first.body as unknown as Acknowledgement;
    const [createdRequest] = await database.db
      .select()
      .from(helpRequests)
      .where(eq(helpRequests.emergencyOperationId, operation.id));
    const originalCreatedAt = new Date('2020-01-01T00:00:00.000Z');
    await database.db
      .update(helpRequests)
      .set({ createdAt: originalCreatedAt })
      .where(eq(helpRequests.id, createdRequest.id));
    const [storedBeforeDuplicate] = await database.db
      .select()
      .from(helpRequests)
      .where(eq(helpRequests.id, createdRequest.id));
    const duplicate = await request(app.getHttpServer())
      .post('/public/countries/de/help-requests')
      .send(
        createRequestBody(operation.id, {
          requesterEmail: ' PERSON@EXAMPLE.TEST ',
        }),
      )
      .expect(201);

    const duplicateAcknowledgement =
      duplicate.body as unknown as Acknowledgement;
    expect(duplicateAcknowledgement).toMatchObject({
      status: firstAcknowledgement.status,
      message: firstAcknowledgement.message,
    });
    expect(duplicateAcknowledgement.acknowledgementReference).toMatch(
      /^[A-Za-z0-9_-]{24}$/,
    );
    expect(duplicateAcknowledgement.acknowledgementReference).not.toBe(
      firstAcknowledgement.acknowledgementReference,
    );
    expect(duplicateAcknowledgement.acknowledgedAt).not.toBe(
      storedBeforeDuplicate.createdAt.toISOString(),
    );
    const stored = await database.db
      .select()
      .from(helpRequests)
      .where(eq(helpRequests.emergencyOperationId, operation.id));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual(storedBeforeDuplicate);
  });

  it('keeps existing protected routes protected', async () => {
    await request(app.getHttpServer()).get('/organizations').expect(401);
  });
});
