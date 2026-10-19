import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  authenticatedRequest,
  getTestAdminAccessToken,
} from './test-authentication';

let accessToken: string;

type OrganizationResponse = { id: string };
type EmergencyOperationResponse = {
  id: string;
  operationCode: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
};
type DashboardOperationCard = {
  id: string;
  operationCode: string;
  name: string;
  countryCode: string;
  type: string;
  severity: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  updatedAt: string;
};
type DashboardOperationsResponse = {
  items: DashboardOperationCard[];
  nextCursor: string | null;
};
type ValidationErrorResponse = {
  statusCode: number;
  message: string;
  errors: Array<{ field: string; code: string; message: string }>;
};

/** Creates an organization through the API for a dashboard operations test. */
async function createOrganization(
  app: INestApplication<App>,
): Promise<OrganizationResponse> {
  const response = await authenticatedRequest(app, accessToken)
    .post('/organizations')
    .send({
      code: `ORG-${randomUUID().slice(0, 26)}`,
      name: 'Dashboard Operations Test Organization',
    })
    .expect(201);

  return response.body as OrganizationResponse;
}

/** Creates an operation through the API for a dashboard operations test. */
async function createOperation(
  app: INestApplication<App>,
  organizationId: string,
): Promise<EmergencyOperationResponse> {
  const response = await authenticatedRequest(app, accessToken)
    .post('/emergency-operations')
    .send({
      organizationId,
      operationCode: `OP-${randomUUID()}`,
      name: 'Bayern Flood 2026',
      countryCode: 'DE',
      type: 'FLOOD',
      severity: 'HIGH',
    })
    .expect(201);

  return response.body as EmergencyOperationResponse;
}

/** Updates a test operation timestamp to make cursor ordering deterministic. */
async function setUpdatedAt(
  database: Pool,
  operationId: string,
  updatedAt: string,
): Promise<void> {
  await database.query(
    'UPDATE emergency_operations SET updated_at = $1 WHERE id = $2',
    [updatedAt, operationId],
  );
}

/** Verifies the standard structured validation response returned by the API. */
function expectValidationError(response: { body: unknown }): void {
  const body = response.body as ValidationErrorResponse;

  expect(body).toMatchObject({
    statusCode: 400,
    message: 'Request validation failed',
  });
  expect(body.errors.length).toBeGreaterThan(0);
}

describe('Dashboard operations API (e2e)', () => {
  let app: INestApplication<App>;
  let testDatabase: Pool;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    accessToken = await getTestAdminAccessToken(app);
    testDatabase = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
    });
  });

  afterAll(async () => {
    await Promise.all([app.close(), testDatabase.end()]);
  });

  it('uses the default limit and orders by updatedAt descending then ID descending', async () => {
    const organization = await createOrganization(app);
    const operations: EmergencyOperationResponse[] = [];

    for (let index = 0; index < 26; index += 1) {
      operations.push(await createOperation(app, organization.id));
    }

    const timestamps = operations.map(
      (_, index) => `2026-01-01T00:${String(index).padStart(2, '0')}:00.000Z`,
    );
    timestamps[25] = timestamps[24];

    for (const [index, operation] of operations.entries()) {
      await setUpdatedAt(testDatabase, operation.id, timestamps[index]);
    }

    const response = await authenticatedRequest(app, accessToken)
      .get(`/dashboard/organizations/${organization.id}/operations`)
      .expect(200);
    const body = response.body as DashboardOperationsResponse;
    const expectedIds = operations
      .map((operation, index) => ({
        id: operation.id,
        updatedAt: timestamps[index],
      }))
      .sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) ||
          right.id.localeCompare(left.id),
      )
      .map((operation) => operation.id);

    expect(body.items).toHaveLength(25);
    expect(body.items.map((operation) => operation.id)).toEqual(
      expectedIds.slice(0, 25),
    );
    expect(body.nextCursor).toEqual(expect.any(String));
  });

  it('paginates without duplicate or skipped IDs and ends with a null cursor', async () => {
    const organization = await createOrganization(app);
    const operations: EmergencyOperationResponse[] = [];

    for (let index = 0; index < 5; index += 1) {
      operations.push(await createOperation(app, organization.id));
    }

    const timestamps = operations.map(
      (_, index) => `2026-02-01T00:0${index}:00.000Z`,
    );

    for (const [index, operation] of operations.entries()) {
      await setUpdatedAt(testDatabase, operation.id, timestamps[index]);
    }

    const firstPage = (
      await authenticatedRequest(app, accessToken)
        .get(`/dashboard/organizations/${organization.id}/operations`)
        .query({ limit: '2' })
        .expect(200)
    ).body as DashboardOperationsResponse;
    const secondPage = (
      await authenticatedRequest(app, accessToken)
        .get(`/dashboard/organizations/${organization.id}/operations`)
        .query({ limit: '2', cursor: firstPage.nextCursor })
        .expect(200)
    ).body as DashboardOperationsResponse;
    const finalPage = (
      await authenticatedRequest(app, accessToken)
        .get(`/dashboard/organizations/${organization.id}/operations`)
        .query({ limit: '2', cursor: secondPage.nextCursor })
        .expect(200)
    ).body as DashboardOperationsResponse;
    const receivedIds = [
      ...firstPage.items,
      ...secondPage.items,
      ...finalPage.items,
    ].map((operation) => operation.id);

    expect(firstPage.nextCursor).toEqual(expect.any(String));
    expect(secondPage.nextCursor).toEqual(expect.any(String));
    expect(finalPage.nextCursor).toBeNull();
    expect(receivedIds).toHaveLength(5);
    expect(new Set(receivedIds).size).toBe(5);
    expect(receivedIds).toEqual(
      operations
        .map((operation, index) => ({
          id: operation.id,
          updatedAt: timestamps[index],
        }))
        .sort(
          (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            right.id.localeCompare(left.id),
        )
        .map((operation) => operation.id),
    );
  });

  it('filters operations by status', async () => {
    const organization = await createOrganization(app);
    const plannedOperation = await createOperation(app, organization.id);
    const activeOperation = await createOperation(app, organization.id);

    await authenticatedRequest(app, accessToken)
      .post(`/emergency-operations/${activeOperation.id}/activate`)
      .expect(201);

    const response = await authenticatedRequest(app, accessToken)
      .get(`/dashboard/organizations/${organization.id}/operations`)
      .query({ status: 'ACTIVE' })
      .expect(200);
    const body = response.body as DashboardOperationsResponse;

    expect(body.items).toEqual([
      expect.objectContaining({ id: activeOperation.id, status: 'ACTIVE' }),
    ]);
    expect(body.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: plannedOperation.id }),
      ]),
    );
  });

  it('returns not found for a valid but unknown organization ID', async () => {
    await authenticatedRequest(app, accessToken)
      .get(`/dashboard/organizations/${randomUUID()}/operations`)
      .expect(404);
  });

  it('returns structured validation errors for invalid query parameters', async () => {
    const organization = await createOrganization(app);
    const endpoint = `/dashboard/organizations/${organization.id}/operations`;
    const invalidQueries = [
      { limit: '0' },
      { limit: '101' },
      { status: 'UNKNOWN' },
      { cursor: 'not-a-cursor' },
      { unknown: 'value' },
    ];

    for (const query of invalidQueries) {
      const response = await authenticatedRequest(app, accessToken)
        .get(endpoint)
        .query(query)
        .expect(400);

      expectValidationError(response);
    }
  });
});
