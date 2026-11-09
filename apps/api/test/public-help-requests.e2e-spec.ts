import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq, sql } from 'drizzle-orm';
import * as crypto from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import {
  helpRequestIdempotency,
  helpRequests,
  outboxEvents,
} from '../src/database/schema';
import { HelpRequestsService } from '../src/help-requests/help-requests.service';
import {
  authenticatedRequest,
  getTestAdminAccessToken,
} from './test-authentication';

type Organization = { id: string };
type Operation = { id: string; operationCode: string; countryCode: string };
type Acknowledgement = {
  acknowledgementReference: string;
  shortReference?: string;
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
      code: `PUBLIC-${crypto.randomUUID().slice(0, 20)}`,
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
  const operationCode = `PUBLIC-${crypto.randomUUID().slice(0, 20)}`;
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

/** Starts a public submission with a fresh or specified idempotency key. */
function submitPublicRequest(
  app: INestApplication<App>,
  countryCode: string,
  idempotencyKey = crypto.randomUUID(),
) {
  return request(app.getHttpServer())
    .post(`/public/countries/${countryCode}/help-requests`)
    .set('Idempotency-Key', idempotencyKey);
}

/** Verifies the project-standard structured validation response. */
function expectStructuredValidationError(body: unknown): void {
  const response = body as {
    statusCode?: unknown;
    message?: unknown;
    errors?: unknown;
  };

  expect(response.statusCode).toBe(400);
  expect(response.message).toBe('Request validation failed');
  expect(Array.isArray(response.errors)).toBe(true);
}

let accessToken: string;

describe('Public help-request API (e2e)', () => {
  let app: INestApplication<App>;
  let database: DatabaseService;
  let helpRequestsService: HelpRequestsService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    database = moduleFixture.get(DatabaseService);
    helpRequestsService = moduleFixture.get(HelpRequestsService);
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
    const idempotencyKey = crypto.randomUUID();

    const response = await submitPublicRequest(app, 'de', idempotencyKey)
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
    expect(acknowledgement.shortReference).toMatch(/^[A-Z0-9]{5}$/);
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
    expect(stored.shortReference).toBe(acknowledgement.shortReference);
    const [idempotency] = await database.db
      .select()
      .from(helpRequestIdempotency)
      .where(eq(helpRequestIdempotency.idempotencyKey, idempotencyKey));
    const requestEvents = await database.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.helpRequestId, stored.id));
    expect(requestEvents).toHaveLength(1);
    const [outboxEvent] = requestEvents;
    expect(idempotency).toBeDefined();
    expect(idempotency.shortReference).toBe(acknowledgement.shortReference);
    expect(outboxEvent).toMatchObject({
      eventType: 'help-request-submitted',
      helpRequestId: stored.id,
      enqueuedAt: null,
      processedAt: null,
      attemptCount: 0,
      lastError: null,
    });
    expect(outboxEvent.payload).toEqual({
      outboxEventId: outboxEvent.id,
      helpRequestId: stored.id,
    });
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

    const wrongCountry = await submitPublicRequest(app, 'de')
      .send(createRequestBody(foreignOperation.id))
      .expect(404);
    const inactive = await submitPublicRequest(app, 'de')
      .send(createRequestBody(inactiveOperation.id))
      .expect(404);
    const missing = await submitPublicRequest(app, 'de')
      .send(createRequestBody(crypto.randomUUID()))
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

    await submitPublicRequest(app, 'de')
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

    await submitPublicRequest(app, 'de')
      .send(createRequestBody(operation.id, { groupSize: 0 }))
      .expect(400);
  });

  it('acknowledges duplicate normalized email without creating another request', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id, 'DE', true);

    const firstIdempotencyKey = crypto.randomUUID();
    const duplicateIdempotencyKey = crypto.randomUUID();
    const first = await submitPublicRequest(app, 'de', firstIdempotencyKey)
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
    const duplicate = await submitPublicRequest(
      app,
      'de',
      duplicateIdempotencyKey,
    )
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
    expect(firstAcknowledgement.shortReference).toMatch(/^[A-Z0-9]{5}$/);
    expect(duplicateAcknowledgement.shortReference).toBeUndefined();
    expect(duplicateAcknowledgement.acknowledgedAt).not.toBe(
      storedBeforeDuplicate.createdAt.toISOString(),
    );
    const stored = await database.db
      .select()
      .from(helpRequests)
      .where(eq(helpRequests.emergencyOperationId, operation.id));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual(storedBeforeDuplicate);
    const storedEvents = await database.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.helpRequestId, stored[0].id));
    expect(storedEvents).toHaveLength(1);
    const [duplicateIdempotency] = await database.db
      .select()
      .from(helpRequestIdempotency)
      .where(
        eq(helpRequestIdempotency.idempotencyKey, duplicateIdempotencyKey),
      );
    expect(duplicateIdempotency.shortReference).toBeNull();

    const duplicateReplay = await submitPublicRequest(
      app,
      'de',
      duplicateIdempotencyKey,
    )
      .send(
        createRequestBody(operation.id, {
          requesterEmail: 'person@example.test',
        }),
      )
      .expect(201);
    expect(duplicateReplay.body).toEqual(duplicateAcknowledgement);
  });

  it('rejects empty or malformed idempotency key header values', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id, 'DE', true);

    for (const idempotencyKey of ['', 'not-a-uuid']) {
      const response = await request(app.getHttpServer())
        .post('/public/countries/de/help-requests')
        .set('Idempotency-Key', idempotencyKey)
        .send(createRequestBody(operation.id))
        .expect(400);

      expectStructuredValidationError(response.body);
    }
  });

  it('rejects a missing idempotency key header', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id, 'DE', true);

    const response = await request(app.getHttpServer())
      .post('/public/countries/de/help-requests')
      .send(createRequestBody(operation.id))
      .expect(400);

    expectStructuredValidationError(response.body);
  });

  it('replays the stored acknowledgement for the same key and normalized payload', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id, 'DE', true);
    const idempotencyKey = crypto.randomUUID();

    const first = await submitPublicRequest(app, 'de', idempotencyKey)
      .send(createRequestBody(operation.id))
      .expect(201);
    const retry = await submitPublicRequest(app, 'DE', idempotencyKey)
      .send(
        createRequestBody(operation.id, {
          requesterEmail: ' PERSON@EXAMPLE.TEST ',
        }),
      )
      .expect(201);

    expect(retry.body).toEqual(first.body);
    const storedRequests = await database.db
      .select()
      .from(helpRequests)
      .where(eq(helpRequests.emergencyOperationId, operation.id));
    const storedIdempotency = await database.db
      .select()
      .from(helpRequestIdempotency)
      .where(eq(helpRequestIdempotency.idempotencyKey, idempotencyKey));
    expect(storedRequests).toHaveLength(1);
    expect(storedIdempotency).toHaveLength(1);
    const storedEvents = await database.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.helpRequestId, storedRequests[0].id));
    expect(storedEvents).toHaveLength(1);
  });

  it('retries a short-reference collision and rolls back when retries are exhausted', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id, 'DE', true);
    const occupiedShortReference = 'AAAAA';
    await database.db.insert(helpRequests).values({
      emergencyOperationId: operation.id,
      publicReference: `seed-${crypto.randomUUID()}`,
      shortReference: occupiedShortReference,
      requesterName: 'Existing Requester',
      requesterPhone: '+49123456780',
      requesterEmail: 'existing@example.test',
      groupSize: 1,
      locationDescription: 'Existing location',
      canTravelIndependently: true,
      medicalSupportNeeded: false,
      status: 'PENDING_REVIEW',
    });
    const generateShortReference = jest.spyOn(
      helpRequestsService as unknown as {
        generateShortReference: () => string;
      },
      'generateShortReference',
    );

    try {
      generateShortReference.mockReturnValueOnce(occupiedShortReference);
      generateShortReference.mockReturnValue('BBBBB');
      const collisionRetry = await submitPublicRequest(app, 'de')
        .send(
          createRequestBody(operation.id, {
            requesterEmail: 'collision-retry@example.test',
          }),
        )
        .expect(201);
      expect((collisionRetry.body as Acknowledgement).shortReference).toBe(
        'BBBBB',
      );

      generateShortReference
        .mockReset()
        .mockReturnValue(occupiedShortReference);
      const exhaustedIdempotencyKey = crypto.randomUUID();
      await submitPublicRequest(app, 'de', exhaustedIdempotencyKey)
        .send(
          createRequestBody(operation.id, {
            requesterEmail: 'collision-exhausted@example.test',
          }),
        )
        .expect(500);

      const exhaustedRequests = await database.db
        .select()
        .from(helpRequests)
        .where(
          eq(helpRequests.requesterEmail, 'collision-exhausted@example.test'),
        );
      const exhaustedIdempotency = await database.db
        .select()
        .from(helpRequestIdempotency)
        .where(
          eq(helpRequestIdempotency.idempotencyKey, exhaustedIdempotencyKey),
        );
      expect(exhaustedRequests).toHaveLength(0);
      expect(exhaustedIdempotency).toHaveLength(0);
    } finally {
      generateShortReference.mockRestore();
    }
  });

  it('rolls back a submission when the outbox event insert fails', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id, 'DE', true);
    const idempotencyKey = crypto.randomUUID();
    const eventsBefore = await database.db.select().from(outboxEvents);

    try {
      await database.db.execute(sql`
        CREATE FUNCTION reject_help_request_outbox_event()
        RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'forced outbox insert failure';
        END;
        $$ LANGUAGE plpgsql;
      `);
      await database.db.execute(sql`
        CREATE TRIGGER reject_help_request_outbox_event
        BEFORE INSERT ON outbox_events
        FOR EACH ROW EXECUTE FUNCTION reject_help_request_outbox_event();
      `);
      await submitPublicRequest(app, 'de', idempotencyKey)
        .send(
          createRequestBody(operation.id, {
            requesterEmail: 'atomic@example.test',
          }),
        )
        .expect(500);
    } finally {
      await database.db.execute(sql`
        DROP TRIGGER IF EXISTS reject_help_request_outbox_event ON outbox_events;
      `);
      await database.db.execute(sql`
        DROP FUNCTION IF EXISTS reject_help_request_outbox_event();
      `);
    }

    const requests = await database.db
      .select()
      .from(helpRequests)
      .where(eq(helpRequests.requesterEmail, 'atomic@example.test'));
    const idempotencyRecords = await database.db
      .select()
      .from(helpRequestIdempotency)
      .where(eq(helpRequestIdempotency.idempotencyKey, idempotencyKey));
    const eventsAfter = await database.db.select().from(outboxEvents);

    expect(requests).toHaveLength(0);
    expect(idempotencyRecords).toHaveLength(0);
    expect(eventsAfter).toHaveLength(eventsBefore.length);
  });

  it('rejects reuse of an idempotency key with a changed request', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id, 'DE', true);
    const idempotencyKey = crypto.randomUUID();

    await submitPublicRequest(app, 'de', idempotencyKey)
      .send(createRequestBody(operation.id))
      .expect(201);
    await submitPublicRequest(app, 'de', idempotencyKey)
      .send(createRequestBody(operation.id, { groupSize: 3 }))
      .expect(409);
  });

  it('keeps one request when concurrent submissions share an idempotency key', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id, 'DE', true);
    const idempotencyKey = crypto.randomUUID();

    const responses = await Promise.all([
      submitPublicRequest(app, 'de', idempotencyKey)
        .send(createRequestBody(operation.id))
        .expect(201),
      submitPublicRequest(app, 'de', idempotencyKey)
        .send(createRequestBody(operation.id))
        .expect(201),
    ]);

    expect(responses[0].body).toEqual(responses[1].body);
    expect((responses[0].body as Acknowledgement).shortReference).toMatch(
      /^[A-Z0-9]{5}$/,
    );
    const storedRequests = await database.db
      .select()
      .from(helpRequests)
      .where(eq(helpRequests.emergencyOperationId, operation.id));
    expect(storedRequests).toHaveLength(1);
  });

  it('keeps one request for concurrent distinct keys with the same normalized email', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id, 'DE', true);

    await Promise.all([
      submitPublicRequest(app, 'de')
        .send(createRequestBody(operation.id))
        .expect(201),
      submitPublicRequest(app, 'de')
        .send(
          createRequestBody(operation.id, {
            requesterEmail: ' PERSON@EXAMPLE.TEST ',
          }),
        )
        .expect(201),
    ]);

    const storedRequests = await database.db
      .select()
      .from(helpRequests)
      .where(eq(helpRequests.emergencyOperationId, operation.id));
    expect(storedRequests).toHaveLength(1);
  });

  it('returns only the current status for a known short reference', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id, 'DE', true);
    const submission = await submitPublicRequest(app, 'de')
      .send(createRequestBody(operation.id))
      .expect(201);
    const shortReference = (submission.body as Acknowledgement).shortReference;

    expect(shortReference).toMatch(/^[A-Z0-9]{5}$/);
    if (!shortReference) {
      throw new Error('Expected a short reference for a new public request');
    }

    await request(app.getHttpServer())
      .get(`/public/help-requests/${shortReference.toLowerCase()}/status`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({ status: 'PENDING_REVIEW' });
      });
  });

  it('returns the same generic not-found response for invalid and unknown references', async () => {
    const invalid = await request(app.getHttpServer())
      .get('/public/help-requests/ABC-1/status')
      .expect(404);
    const unknown = await request(app.getHttpServer())
      .get('/public/help-requests/ZZZZZ/status')
      .expect(404);

    expect(invalid.body).toEqual(unknown.body);
    expect(invalid.body).toMatchObject({
      statusCode: 404,
      message: 'Help request not found',
    });
  });

  it('keeps existing protected routes protected', async () => {
    await request(app.getHttpServer()).get('/organizations').expect(401);
  });
});
