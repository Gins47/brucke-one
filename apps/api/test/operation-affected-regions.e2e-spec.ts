import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

type OrganizationResponse = { id: string };
type EmergencyOperationResponse = { id: string };
type AffectedRegionResponse = {
  id: string;
  emergencyOperationId: string;
  countryCode: string;
  regionCode: string;
  regionName: string;
  addedAt: string;
  removedAt: string | null;
};
type ValidationErrorResponse = {
  statusCode: number;
  message: string;
  errors: Array<{ field: string; code: string; message: string }>;
};

/** Creates an organization through the API for an affected-region test. */
async function createOrganization(
  app: INestApplication<App>,
): Promise<OrganizationResponse> {
  const response = await request(app.getHttpServer())
    .post('/organizations')
    .send({
      code: `ORG-${randomUUID().slice(0, 26)}`,
      name: 'Affected Region Test Organization',
    })
    .expect(201);

  return response.body as OrganizationResponse;
}

/** Creates an emergency operation through the API for an affected-region test. */
async function createOperation(
  app: INestApplication<App>,
  organizationId: string,
): Promise<EmergencyOperationResponse> {
  const response = await request(app.getHttpServer())
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

/** Adds an affected region through the public API. */
async function createAffectedRegion(
  app: INestApplication<App>,
  operationId: string,
): Promise<AffectedRegionResponse> {
  const response = await request(app.getHttpServer())
    .post(`/emergency-operations/${operationId}/affected-regions`)
    .send({ countryCode: 'DE', regionCode: 'DE-BY', regionName: 'Bavaria' })
    .expect(201);

  return response.body as AffectedRegionResponse;
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

describe('OperationAffectedRegions API (e2e)', () => {
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

  it('adds a region and lists it as current', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);
    const region = await createAffectedRegion(app, operation.id);

    expect(region).toMatchObject({
      emergencyOperationId: operation.id,
      countryCode: 'DE',
      regionCode: 'DE-BY',
      regionName: 'Bavaria',
      removedAt: null,
    });
    expect(typeof region.addedAt).toBe('string');

    await request(app.getHttpServer())
      .get(`/emergency-operations/${operation.id}/affected-regions`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.arrayContaining([expect.objectContaining(region)]),
        );
      });
  });

  it('returns not found for an unknown emergency operation', async () => {
    await request(app.getHttpServer())
      .post(`/emergency-operations/${randomUUID()}/affected-regions`)
      .send({ countryCode: 'DE', regionCode: 'DE-BY', regionName: 'Bavaria' })
      .expect(404);
  });

  it('returns conflict for a duplicate current region', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);
    await createAffectedRegion(app, operation.id);

    await request(app.getHttpServer())
      .post(`/emergency-operations/${operation.id}/affected-regions`)
      .send({ countryCode: 'DE', regionCode: 'DE-BY', regionName: 'Bavaria' })
      .expect(409);
  });

  it('logically removes a region so it no longer appears in the current list', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);
    const region = await createAffectedRegion(app, operation.id);

    const removal = await request(app.getHttpServer())
      .post(
        `/emergency-operations/${operation.id}/affected-regions/${region.id}/remove`,
      )
      .expect(201);
    expect(removal.body).toMatchObject({ id: region.id });
    expect(typeof (removal.body as AffectedRegionResponse).removedAt).toBe(
      'string',
    );

    await request(app.getHttpServer())
      .get(`/emergency-operations/${operation.id}/affected-regions`)
      .expect(200)
      .expect((response) => {
        expect(response.body).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ id: region.id })]),
        );
      });
  });

  it('returns conflict when removing a region twice', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);
    const region = await createAffectedRegion(app, operation.id);
    const endpoint = `/emergency-operations/${operation.id}/affected-regions/${region.id}/remove`;

    await request(app.getHttpServer()).post(endpoint).expect(201);
    await request(app.getHttpServer()).post(endpoint).expect(409);
  });

  it('allows the same region to be added again after logical removal', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);
    const originalRegion = await createAffectedRegion(app, operation.id);

    await request(app.getHttpServer())
      .post(
        `/emergency-operations/${operation.id}/affected-regions/${originalRegion.id}/remove`,
      )
      .expect(201);
    const replacementRegion = await createAffectedRegion(app, operation.id);

    expect(replacementRegion.id).not.toBe(originalRegion.id);
    await request(app.getHttpServer())
      .get(`/emergency-operations/${operation.id}/affected-regions`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual([
          expect.objectContaining({ id: replacementRegion.id }),
        ]);
      });
  });

  it('returns not found for an unknown or wrong-operation region', async () => {
    const organization = await createOrganization(app);
    const firstOperation = await createOperation(app, organization.id);
    const secondOperation = await createOperation(app, organization.id);
    const region = await createAffectedRegion(app, firstOperation.id);

    await request(app.getHttpServer())
      .post(
        `/emergency-operations/${firstOperation.id}/affected-regions/${randomUUID()}/remove`,
      )
      .expect(404);
    await request(app.getHttpServer())
      .post(
        `/emergency-operations/${secondOperation.id}/affected-regions/${region.id}/remove`,
      )
      .expect(404);
  });

  it('returns structured validation errors for unknown fields and client timestamps', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);
    const endpoint = `/emergency-operations/${operation.id}/affected-regions`;

    const unknownField = await request(app.getHttpServer())
      .post(endpoint)
      .send({
        countryCode: 'DE',
        regionCode: 'DE-BY',
        regionName: 'Bavaria',
        extra: 'not allowed',
      })
      .expect(400);
    expectValidationError(unknownField);

    const timestamps = await request(app.getHttpServer())
      .post(endpoint)
      .send({
        countryCode: 'DE',
        regionCode: 'DE-BY',
        regionName: 'Bavaria',
        addedAt: '2026-10-15T10:00:00.000Z',
        removedAt: null,
      })
      .expect(400);
    expectValidationError(timestamps);
  });
});
