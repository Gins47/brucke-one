import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

type OrganizationResponse = { id: string };
type EmergencyOperationResponse = {
  id: string;
  organizationId: string;
  operationCode: string;
  name: string;
  description: string | null;
  countryCode: string;
  type: 'FLOOD' | 'FIRE' | 'EARTHQUAKE' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startedAt: string | null;
  endedAt: string | null;
};
type ValidationErrorResponse = {
  statusCode: number;
  message: string;
  errors: Array<{ field: string; code: string; message: string }>;
};

/** Creates an organization through the API for an emergency-operation test. */
async function createOrganization(
  app: INestApplication<App>,
): Promise<OrganizationResponse> {
  const response = await request(app.getHttpServer())
    .post('/organizations')
    .send({
      code: `ORG-${randomUUID().slice(0, 26)}`,
      name: 'Emergency Operation Test Organization',
    })
    .expect(201);

  return response.body as OrganizationResponse;
}

/** Creates an emergency operation through the API for an HTTP test case. */
async function createOperation(
  app: INestApplication<App>,
  organizationId: string,
  overrides: Partial<{
    operationCode: string;
    name: string;
    description: string;
    countryCode: string;
    type: 'FLOOD' | 'FIRE' | 'EARTHQUAKE' | 'OTHER';
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    startedAt: string;
  }> = {},
): Promise<EmergencyOperationResponse> {
  const response = await request(app.getHttpServer())
    .post('/emergency-operations')
    .send({
      organizationId,
      operationCode: `OP-${randomUUID()}`,
      name: 'Bayern Flood 2026',
      description: 'Operational description',
      countryCode: 'DE',
      type: 'FLOOD',
      severity: 'HIGH',
      ...overrides,
    })
    .expect(201);

  return response.body as EmergencyOperationResponse;
}

describe('EmergencyOperations API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates, lists, and retrieves an emergency operation', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);

    expect(operation).toMatchObject({
      organizationId: organization.id,
      status: 'PLANNED',
      type: 'FLOOD',
      severity: 'HIGH',
    });

    await request(app.getHttpServer())
      .get(`/emergency-operations/${operation.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject(operation);
      });

    await request(app.getHttpServer())
      .get('/emergency-operations')
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.arrayContaining([expect.objectContaining(operation)]),
        );
      });
  });

  it('returns not found when creating an operation for an unknown organization', async () => {
    await request(app.getHttpServer())
      .post('/emergency-operations')
      .send({
        organizationId: randomUUID(),
        operationCode: `OP-${randomUUID()}`,
        name: 'Unknown Organization Operation',
        countryCode: 'DE',
        type: 'FLOOD',
        severity: 'HIGH',
      })
      .expect(404);
  });

  it('returns structured validation errors for an invalid operation timeline', async () => {
    const organization = await createOrganization(app);

    await request(app.getHttpServer())
      .post('/emergency-operations')
      .send({
        organizationId: organization.id,
        operationCode: `OP-${randomUUID()}`,
        name: 'Invalid Timeline Operation',
        countryCode: 'DE',
        type: 'FLOOD',
        severity: 'HIGH',
        startedAt: '2026-10-14T11:00:00.000Z',
        endedAt: '2026-10-14T10:00:00.000Z',
      })
      .expect(400)
      .expect((response) => {
        const body = response.body as ValidationErrorResponse;

        expect(body).toMatchObject({
          statusCode: 400,
          message: 'Request validation failed',
        });
        expect(body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'endedAt', code: 'custom' }),
          ]),
        );
      });
  });

  it('rejects immutable and unknown PATCH fields', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);

    await request(app.getHttpServer())
      .patch(`/emergency-operations/${operation.id}`)
      .send({ organizationId: randomUUID() })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/emergency-operations/${operation.id}`)
      .send({ operationCode: 'IMMUTABLE' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/emergency-operations/${operation.id}`)
      .send({ unknown: 'value' })
      .expect(400);
  });

  it('updates mutable fields and persists transformed date values', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);
    const startedAt = '2026-10-15T10:00:00.000Z';

    const updated = await request(app.getHttpServer())
      .patch(`/emergency-operations/${operation.id}`)
      .send({ name: 'Updated Flood Operation', startedAt })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: operation.id,
      name: 'Updated Flood Operation',
      startedAt,
    });

    await request(app.getHttpServer())
      .get(`/emergency-operations/${operation.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          name: 'Updated Flood Operation',
          startedAt,
        });
      });
  });

  it('activates and completes an emergency operation', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);

    const activated = await request(app.getHttpServer())
      .post(`/emergency-operations/${operation.id}/activate`)
      .expect(201);
    expect(activated.body).toMatchObject({
      id: operation.id,
      status: 'ACTIVE',
    });
    expect(
      typeof (activated.body as EmergencyOperationResponse).startedAt,
    ).toBe('string');

    const completed = await request(app.getHttpServer())
      .post(`/emergency-operations/${operation.id}/complete`)
      .expect(201);
    expect(completed.body).toMatchObject({
      id: operation.id,
      status: 'COMPLETED',
    });
    expect(typeof (completed.body as EmergencyOperationResponse).endedAt).toBe(
      'string',
    );
  });

  it('returns conflict for an invalid status transition', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);

    await request(app.getHttpServer())
      .post(`/emergency-operations/${operation.id}/complete`)
      .expect(409);
  });

  it('returns not found for an unknown emergency operation ID', async () => {
    await request(app.getHttpServer())
      .get('/emergency-operations/b740fd73-661c-435e-ba99-ad7b1ce807a9')
      .expect(404);
  });
});
