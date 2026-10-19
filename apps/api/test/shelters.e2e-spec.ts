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

type OrganizationResponse = { id: string };
type ShelterResponse = {
  id: string;
  organizationId: string;
  shelterCode: string;
  name: string;
  address: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  capacity: number;
  contactEmail: string | null;
  contactPhone: string | null;
};
type ValidationErrorResponse = {
  statusCode: number;
  message: string;
  errors: Array<{ field: string; code: string; message: string }>;
};

/** Creates an organization through the API for a shelter HTTP test. */
async function createOrganization(
  app: INestApplication<App>,
): Promise<OrganizationResponse> {
  const response = await authenticatedRequest(app, accessToken)
    .post('/organizations')
    .send({
      code: `ORG-${randomUUID().slice(0, 26)}`,
      name: 'Shelter Test Organization',
    })
    .expect(201);

  return response.body as OrganizationResponse;
}

/** Creates a shelter through the API for an HTTP test case. */
async function createShelter(
  app: INestApplication<App>,
  organizationId: string,
  overrides: Partial<{
    shelterCode: string;
    name: string;
    address: string;
    countryCode: string;
    latitude: number;
    longitude: number;
    capacity: number;
    contactEmail: string;
    contactPhone: string;
  }> = {},
): Promise<ShelterResponse> {
  const response = await authenticatedRequest(app, accessToken)
    .post('/shelters')
    .send({
      organizationId,
      shelterCode: `MUC-${randomUUID()}`,
      name: 'Munich Community Hall',
      address: 'Example Street 10, 80331 Munich',
      countryCode: 'DE',
      latitude: 48.1351,
      longitude: 11.582,
      capacity: 250,
      contactEmail: 'shelter@example.org',
      contactPhone: '+49891234567',
      ...overrides,
    })
    .expect(201);

  return response.body as ShelterResponse;
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

describe('Shelters API (e2e)', () => {
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

  it('creates, lists, and retrieves a shelter', async () => {
    const organization = await createOrganization(app);
    const shelter = await createShelter(app, organization.id);

    expect(shelter).toMatchObject({
      organizationId: organization.id,
      name: 'Munich Community Hall',
      capacity: 250,
    });

    await authenticatedRequest(app, accessToken)
      .get(`/shelters/${shelter.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject(shelter);
      });

    await authenticatedRequest(app, accessToken)
      .get('/shelters')
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.arrayContaining([expect.objectContaining(shelter)]),
        );
      });
  });

  it('returns not found when creating a shelter for an unknown organization', async () => {
    await authenticatedRequest(app, accessToken)
      .post('/shelters')
      .send({
        organizationId: randomUUID(),
        shelterCode: `MUC-${randomUUID()}`,
        name: 'Unknown Organization Shelter',
        address: 'Example Street 10, 80331 Munich',
        countryCode: 'DE',
        capacity: 250,
      })
      .expect(404);
  });

  it('returns conflict for a duplicate shelter code in one organization', async () => {
    const organization = await createOrganization(app);
    const shelterCode = `MUC-${randomUUID()}`;
    await createShelter(app, organization.id, { shelterCode });

    await authenticatedRequest(app, accessToken)
      .post('/shelters')
      .send({
        organizationId: organization.id,
        shelterCode,
        name: 'Duplicate Shelter',
        address: 'Another Street 2, 80333 Munich',
        countryCode: 'DE',
        capacity: 100,
      })
      .expect(409);
  });

  it('persists valid PATCH fields', async () => {
    const organization = await createOrganization(app);
    const shelter = await createShelter(app, organization.id);

    const updated = await authenticatedRequest(app, accessToken)
      .patch(`/shelters/${shelter.id}`)
      .send({
        name: 'Updated Community Hall',
        capacity: 300,
        latitude: 48.14,
        longitude: 11.59,
        contactEmail: null,
      })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: shelter.id,
      name: 'Updated Community Hall',
      capacity: 300,
      latitude: 48.14,
      longitude: 11.59,
      contactEmail: null,
    });
  });

  it('returns structured validation errors when PATCH supplies one coordinate', async () => {
    const organization = await createOrganization(app);
    const shelter = await createShelter(app, organization.id);

    await authenticatedRequest(app, accessToken)
      .patch(`/shelters/${shelter.id}`)
      .send({ latitude: 48.14 })
      .expect(400)
      .expect(expectValidationError);
  });

  it('returns structured validation errors for mixed null and numeric coordinates', async () => {
    const organization = await createOrganization(app);
    const shelter = await createShelter(app, organization.id);

    await authenticatedRequest(app, accessToken)
      .patch(`/shelters/${shelter.id}`)
      .send({ latitude: null, longitude: 11.582 })
      .expect(400)
      .expect(expectValidationError);

    await authenticatedRequest(app, accessToken)
      .patch(`/shelters/${shelter.id}`)
      .send({ latitude: 48.1351, longitude: null })
      .expect(400)
      .expect(expectValidationError);
  });

  it('clears and persists both location coordinates when they are null', async () => {
    const organization = await createOrganization(app);
    const shelter = await createShelter(app, organization.id);

    await authenticatedRequest(app, accessToken)
      .patch(`/shelters/${shelter.id}`)
      .send({ latitude: null, longitude: null })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: shelter.id,
          latitude: null,
          longitude: null,
        });
      });

    await authenticatedRequest(app, accessToken)
      .get(`/shelters/${shelter.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          latitude: null,
          longitude: null,
        });
      });
  });

  it('returns a structured validation error for an empty PATCH body', async () => {
    const organization = await createOrganization(app);
    const shelter = await createShelter(app, organization.id);

    await authenticatedRequest(app, accessToken)
      .patch(`/shelters/${shelter.id}`)
      .send({})
      .expect(400)
      .expect(expectValidationError);
  });

  it('returns structured validation errors for invalid coordinates and capacity', async () => {
    const organization = await createOrganization(app);

    await authenticatedRequest(app, accessToken)
      .post('/shelters')
      .send({
        organizationId: organization.id,
        shelterCode: `MUC-${randomUUID()}`,
        name: 'Invalid Coordinate Shelter',
        address: 'Example Street 10, 80331 Munich',
        countryCode: 'DE',
        latitude: 91,
        longitude: 11.582,
        capacity: 250,
      })
      .expect(400)
      .expect(expectValidationError);

    await authenticatedRequest(app, accessToken)
      .post('/shelters')
      .send({
        organizationId: organization.id,
        shelterCode: `MUC-${randomUUID()}`,
        name: 'Invalid Capacity Shelter',
        address: 'Example Street 10, 80331 Munich',
        countryCode: 'DE',
        capacity: -1,
      })
      .expect(400)
      .expect(expectValidationError);
  });

  it('rejects immutable and unknown PATCH fields', async () => {
    const organization = await createOrganization(app);
    const shelter = await createShelter(app, organization.id);

    await authenticatedRequest(app, accessToken)
      .patch(`/shelters/${shelter.id}`)
      .send({ organizationId: randomUUID() })
      .expect(400);

    await authenticatedRequest(app, accessToken)
      .patch(`/shelters/${shelter.id}`)
      .send({ shelterCode: 'IMMUTABLE' })
      .expect(400);

    await authenticatedRequest(app, accessToken)
      .patch(`/shelters/${shelter.id}`)
      .send({ unknown: 'value' })
      .expect(400);
  });

  it('returns not found for an unknown shelter ID', async () => {
    await authenticatedRequest(app, accessToken)
      .get('/shelters/4d274c61-79cc-4471-8e93-2c1bb2ec8183')
      .expect(404);
  });
});
