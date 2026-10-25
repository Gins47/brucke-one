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

/** Creates one organization for a dashboard shelter read-model test. */
async function createOrganization(app: INestApplication<App>) {
  const response = await authenticatedRequest(app, accessToken)
    .post('/organizations')
    .send({ code: `ORG-${randomUUID().slice(0, 26)}`, name: 'Shelter reads' })
    .expect(201);

  return response.body as { id: string };
}

/** Creates an operation and optionally makes it active. */
async function createOperation(
  app: INestApplication<App>,
  organizationId: string,
  active = true,
) {
  const response = await authenticatedRequest(app, accessToken)
    .post('/emergency-operations')
    .send({
      organizationId,
      operationCode: `OP-${randomUUID()}`,
      name: 'Shelter test operation',
      countryCode: 'DE',
      type: 'FLOOD',
      severity: 'HIGH',
    })
    .expect(201);
  const operation = response.body as { id: string };

  if (active) {
    await authenticatedRequest(app, accessToken)
      .post(`/emergency-operations/${operation.id}/activate`)
      .expect(201);
  }

  return operation;
}

/** Creates one physical shelter in the selected organization. */
async function createShelter(
  app: INestApplication<App>,
  organizationId: string,
  shelterCode: string,
) {
  const response = await authenticatedRequest(app, accessToken)
    .post('/shelters')
    .send({
      organizationId,
      shelterCode,
      name: `Shelter ${shelterCode}`,
      address: 'Example Street 1',
      countryCode: 'DE',
      capacity: 50,
    })
    .expect(201);

  return response.body as { id: string };
}

/** Activates a shelter for an active operation. */
async function activateShelter(
  app: INestApplication<App>,
  shelterId: string,
  operationId: string,
) {
  const response = await authenticatedRequest(app, accessToken)
    .post('/shelter-activations')
    .send({ shelterId, emergencyOperationId: operationId })
    .expect(201);

  return response.body as { id: string };
}

describe('Dashboard organization shelters API (e2e)', () => {
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

  it('returns organization shelters with active reported and inactive contexts', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);
    const activeShelter = await createShelter(app, organization.id, 'SH-02');
    const inactiveShelter = await createShelter(app, organization.id, 'SH-01');
    const activation = await activateShelter(
      app,
      activeShelter.id,
      operation.id,
    );

    await authenticatedRequest(app, accessToken)
      .put(`/shelter-activations/${activation.id}/availability`)
      .send({
        operationalCapacity: 40,
        currentOccupancy: 10,
        reservedPlaces: 5,
        acceptingArrivals: true,
      })
      .expect(200);

    const response = await authenticatedRequest(app, accessToken)
      .get(`/dashboard/organizations/${organization.id}/shelters`)
      .expect(200);

    const shelters = response.body as Array<{
      id: string;
      activeActivation: unknown;
    }>;

    expect(shelters.map((shelter) => shelter.id)).toEqual([
      inactiveShelter.id,
      activeShelter.id,
    ]);
    expect(shelters[0].activeActivation).toBeNull();
    expect(shelters[1]).toMatchObject({
      id: activeShelter.id,
      activeActivation: {
        id: activation.id,
        operation: { id: operation.id, status: 'ACTIVE' },
        availability: {
          operationalCapacity: 40,
          currentOccupancy: 10,
          reservedPlaces: 5,
          availablePlaces: 25,
          acceptingArrivals: true,
        },
      },
    });
  });

  it('returns an explicit not-reported active context and scopes shelter detail', async () => {
    const organization = await createOrganization(app);
    const otherOrganization = await createOrganization(app);
    const operation = await createOperation(app, organization.id);
    const shelter = await createShelter(app, organization.id, 'SH-01');
    const activation = await activateShelter(app, shelter.id, operation.id);

    await authenticatedRequest(app, accessToken)
      .get(`/dashboard/organizations/${organization.id}/shelters/${shelter.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: shelter.id,
          activeActivation: {
            id: activation.id,
            availability: null,
          },
        });
      });

    await authenticatedRequest(app, accessToken)
      .get(
        `/dashboard/organizations/${otherOrganization.id}/shelters/${shelter.id}`,
      )
      .expect(404);
  });
});
