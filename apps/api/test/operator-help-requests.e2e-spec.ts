import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
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
type Operation = { id: string };
type HelpRequestQueue = {
  items: Array<{ id: string; status: string; createdAt: string }>;
  nextCursor: string | null;
};

/** Checks the project's structured Zod validation response contract. */
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

/** Creates one organization for an operator queue HTTP scenario. */
async function createOrganization(
  app: INestApplication<App>,
): Promise<Organization> {
  const response = await authenticatedRequest(app, accessToken)
    .post('/organizations')
    .send({
      code: `QUEUE-${randomUUID().slice(0, 20)}`,
      name: 'Operator Queue Test Organization',
    })
    .expect(201);

  return response.body as Organization;
}

/** Creates one operation to which queue requests can be scoped. */
async function createOperation(
  app: INestApplication<App>,
  organizationId: string,
): Promise<Operation> {
  const response = await authenticatedRequest(app, accessToken)
    .post('/emergency-operations')
    .send({
      organizationId,
      operationCode: `QUEUE-${randomUUID().slice(0, 20)}`,
      name: 'Operator Queue Test Operation',
      countryCode: 'DE',
      type: 'FLOOD',
      severity: 'HIGH',
    })
    .expect(201);

  return response.body as Operation;
}

/** Inserts one help request with a supplied queue timestamp and status. */
async function createHelpRequest(
  database: DatabaseService,
  operationId: string,
  createdAt: Date,
  status: 'PENDING_REVIEW' | 'MATCHING' = 'PENDING_REVIEW',
): Promise<string> {
  const [record] = await database.db
    .insert(helpRequests)
    .values({
      emergencyOperationId: operationId,
      publicReference: `request-${randomUUID()}`,
      requesterName: 'Requesting Person',
      requesterPhone: '+49123456789',
      requesterEmail: `${randomUUID()}@example.test`,
      groupSize: 2,
      locationDescription: 'Near the community centre',
      canTravelIndependently: true,
      medicalSupportNeeded: false,
      status,
      createdAt,
      updatedAt: createdAt,
    })
    .returning({ id: helpRequests.id });

  return record.id;
}

describe('Operator help-request queue API (e2e)', () => {
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

  it('returns only pending requests for the requested operation in stable order', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);
    const otherOrganization = await createOrganization(app);
    const otherOperation = await createOperation(app, otherOrganization.id);
    const oldestId = await createHelpRequest(
      database,
      operation.id,
      new Date('2026-10-01T10:00:00.000Z'),
    );
    const newestId = await createHelpRequest(
      database,
      operation.id,
      new Date('2026-10-03T10:00:00.000Z'),
    );
    await createHelpRequest(
      database,
      operation.id,
      new Date('2026-10-02T10:00:00.000Z'),
      'MATCHING',
    );
    const otherOperationId = await createHelpRequest(
      database,
      otherOperation.id,
      new Date('2026-10-04T10:00:00.000Z'),
    );

    const response = await authenticatedRequest(app, accessToken)
      .get(`/emergency-operations/${operation.id}/help-requests`)
      .query({ status: 'PENDING_REVIEW' })
      .expect(200);
    const body = response.body as HelpRequestQueue;

    expect(body.items.map((item) => item.id)).toEqual([newestId, oldestId]);
    expect(body.items.every((item) => item.status === 'PENDING_REVIEW')).toBe(
      true,
    );
    expect(body.items.map((item) => item.id)).not.toContain(otherOperationId);
    expect(body.nextCursor).toBeNull();
  });

  it('returns an empty queue when the operation has no pending requests', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);
    await createHelpRequest(
      database,
      operation.id,
      new Date('2026-10-01T10:00:00.000Z'),
      'MATCHING',
    );

    await authenticatedRequest(app, accessToken)
      .get(`/emergency-operations/${operation.id}/help-requests`)
      .expect(200)
      .expect({ items: [], nextCursor: null });
  });

  it('filters by status and paginates tied timestamps without duplicate or skipped requests', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);
    const firstTiedId = await createHelpRequest(
      database,
      operation.id,
      new Date('2026-10-03T10:00:00.000Z'),
    );
    const secondTiedId = await createHelpRequest(
      database,
      operation.id,
      new Date('2026-10-03T10:00:00.000Z'),
    );
    const oldestId = await createHelpRequest(
      database,
      operation.id,
      new Date('2026-10-01T10:00:00.000Z'),
    );
    const matchingId = await createHelpRequest(
      database,
      operation.id,
      new Date('2026-10-04T10:00:00.000Z'),
      'MATCHING',
    );

    const firstPage = (
      await authenticatedRequest(app, accessToken)
        .get(`/emergency-operations/${operation.id}/help-requests`)
        .query({ limit: '1' })
        .expect(200)
    ).body as HelpRequestQueue;
    const secondPage = (
      await authenticatedRequest(app, accessToken)
        .get(`/emergency-operations/${operation.id}/help-requests`)
        .query({ limit: '1', cursor: firstPage.nextCursor })
        .expect(200)
    ).body as HelpRequestQueue;
    const finalPage = (
      await authenticatedRequest(app, accessToken)
        .get(`/emergency-operations/${operation.id}/help-requests`)
        .query({ limit: '1', cursor: secondPage.nextCursor })
        .expect(200)
    ).body as HelpRequestQueue;
    const matching = (
      await authenticatedRequest(app, accessToken)
        .get(`/emergency-operations/${operation.id}/help-requests`)
        .query({ status: 'MATCHING' })
        .expect(200)
    ).body as HelpRequestQueue;

    const tiedIds = [firstTiedId, secondTiedId].sort().reverse();

    expect(firstPage.items.map((item) => item.id)).toEqual([tiedIds[0]]);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    expect(secondPage.items.map((item) => item.id)).toEqual([tiedIds[1]]);
    expect(secondPage.nextCursor).toEqual(expect.any(String));
    expect(finalPage.items.map((item) => item.id)).toEqual([oldestId]);
    expect(finalPage.nextCursor).toBeNull();
    expect(matching.items.map((item) => item.id)).toEqual([matchingId]);
  });

  it('rejects anonymous access, invalid query values, and unknown operations', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);

    await request(app.getHttpServer())
      .get(`/emergency-operations/${operation.id}/help-requests`)
      .expect(401);
    const invalidLimit = await authenticatedRequest(app, accessToken)
      .get(`/emergency-operations/${operation.id}/help-requests`)
      .query({ limit: '0' })
      .expect(400);
    expectStructuredValidationError(invalidLimit.body);
    const invalidStatus = await authenticatedRequest(app, accessToken)
      .get(`/emergency-operations/${operation.id}/help-requests`)
      .query({ status: 'UNKNOWN' })
      .expect(400);
    expectStructuredValidationError(invalidStatus.body);
    const malformedCursor = await authenticatedRequest(app, accessToken)
      .get(`/emergency-operations/${operation.id}/help-requests`)
      .query({ cursor: 'not-a-cursor' })
      .expect(400);
    expectStructuredValidationError(malformedCursor.body);
    const unknownQuery = await authenticatedRequest(app, accessToken)
      .get(`/emergency-operations/${operation.id}/help-requests`)
      .query({ unexpected: 'value' })
      .expect(400);
    expectStructuredValidationError(unknownQuery.body);
    await authenticatedRequest(app, accessToken)
      .get(`/emergency-operations/${randomUUID()}/help-requests`)
      .expect(404);
    await authenticatedRequest(app, accessToken)
      .get('/emergency-operations/not-a-uuid/help-requests')
      .expect(400);
  });
});
