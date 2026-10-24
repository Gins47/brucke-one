import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import {
  authenticatedRequest,
  getTestAdminAccessToken,
} from './test-authentication';

type Organization = { id: string };
type Shelter = { id: string };
type Operation = { id: string };
type Activation = { id: string };

/** Creates an organization for one availability HTTP scenario. */
async function createOrganization(
  app: INestApplication<App>,
): Promise<Organization> {
  const response = await authenticatedRequest(app, accessToken)
    .post('/organizations')
    .send({
      code: `AVL-${randomUUID().slice(0, 20)}`,
      name: 'Availability Test Organization',
    })
    .expect(201);
  return response.body as Organization;
}

/** Creates a shelter with the physical capacity used by availability checks. */
async function createShelter(
  app: INestApplication<App>,
  organizationId: string,
  capacity = 50,
): Promise<Shelter> {
  const response = await authenticatedRequest(app, accessToken)
    .post('/shelters')
    .send({
      organizationId,
      shelterCode: `AVL-${randomUUID().slice(0, 20)}`,
      name: 'Availability Test Shelter',
      address: 'Example street 1',
      countryCode: 'DE',
      capacity,
    })
    .expect(201);
  return response.body as Shelter;
}

/** Creates and activates an emergency operation for an availability report. */
async function createActiveOperation(
  app: INestApplication<App>,
  organizationId: string,
): Promise<Operation> {
  const created = await authenticatedRequest(app, accessToken)
    .post('/emergency-operations')
    .send({
      organizationId,
      operationCode: `AVL-${randomUUID().slice(0, 20)}`,
      name: 'Availability Test Operation',
      countryCode: 'DE',
      type: 'FLOOD',
      severity: 'HIGH',
    })
    .expect(201);
  const operation = created.body as Operation;

  await authenticatedRequest(app, accessToken)
    .post(`/emergency-operations/${operation.id}/activate`)
    .expect(201);
  return operation;
}

/** Creates an active activation for the supplied shelter and operation. */
async function createActivation(
  app: INestApplication<App>,
  shelterId: string,
  emergencyOperationId: string,
): Promise<Activation> {
  const response = await authenticatedRequest(app, accessToken)
    .post('/shelter-activations')
    .send({ shelterId, emergencyOperationId })
    .expect(201);
  return response.body as Activation;
}

/** Creates a complete active availability context for one HTTP test. */
async function createAvailabilityContext(app: INestApplication<App>) {
  const organization = await createOrganization(app);
  const shelter = await createShelter(app, organization.id);
  const operation = await createActiveOperation(app, organization.id);
  const activation = await createActivation(app, shelter.id, operation.id);
  return { organization, shelter, operation, activation };
}

let accessToken: string;

describe('Shelter activation availability API (e2e)', () => {
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

  it('returns an explicit not-reported response for an existing activation', async () => {
    const { activation } = await createAvailabilityContext(app);

    await authenticatedRequest(app, accessToken)
      .get(`/shelter-activations/${activation.id}/availability`)
      .expect(200)
      .expect({ shelterActivationId: activation.id, availability: null });
  });

  it('creates, retrieves, and replaces an availability report with derived places', async () => {
    const { activation, shelter, operation, organization } =
      await createAvailabilityContext(app);
    const path = `/shelter-activations/${activation.id}/availability`;

    await authenticatedRequest(app, accessToken)
      .put(path)
      .send({
        operationalCapacity: 40,
        currentOccupancy: 12,
        reservedPlaces: 3,
        acceptingArrivals: true,
        availabilityNote: '  Main hall open  ',
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          shelterActivationId: activation.id,
          shelterId: shelter.id,
          emergencyOperationId: operation.id,
          organizationId: organization.id,
          operationalCapacity: 40,
          currentOccupancy: 12,
          reservedPlaces: 3,
          availablePlaces: 25,
          availabilityNote: 'Main hall open',
        });
      });

    await authenticatedRequest(app, accessToken)
      .get(path)
      .expect(200)
      .expect((response) => {
        const body = response.body as { availablePlaces: number };
        expect(body.availablePlaces).toBe(25);
      });

    await authenticatedRequest(app, accessToken)
      .put(path)
      .send({
        operationalCapacity: 40,
        currentOccupancy: 20,
        reservedPlaces: 5,
        acceptingArrivals: false,
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          currentOccupancy: 20,
          reservedPlaces: 5,
          availablePlaces: 15,
          acceptingArrivals: false,
          availabilityNote: null,
        });
      });
  });

  it('returns not found for an unknown activation', async () => {
    await authenticatedRequest(app, accessToken)
      .get(`/shelter-activations/${randomUUID()}/availability`)
      .expect(404);
  });

  it('returns structured validation errors for malformed or unknown input', async () => {
    const { activation } = await createAvailabilityContext(app);

    await authenticatedRequest(app, accessToken)
      .put(`/shelter-activations/${activation.id}/availability`)
      .send({
        operationalCapacity: 10,
        currentOccupancy: 8,
        reservedPlaces: 3,
        acceptingArrivals: true,
      })
      .expect(400)
      .expect((response) => {
        const body = response.body as {
          statusCode: number;
          message: string;
          errors: unknown;
        };
        expect(body).toMatchObject({
          statusCode: 400,
          message: 'Request validation failed',
        });
        expect(Array.isArray(body.errors)).toBe(true);
      });

    await authenticatedRequest(app, accessToken)
      .put(`/shelter-activations/${activation.id}/availability`)
      .send({
        operationalCapacity: 10,
        currentOccupancy: 1,
        reservedPlaces: 1,
        acceptingArrivals: true,
        availablePlaces: 8,
      })
      .expect(400);
  });

  it('returns conflict when capacity exceeds the physical shelter capacity', async () => {
    const { activation } = await createAvailabilityContext(app);

    await authenticatedRequest(app, accessToken)
      .put(`/shelter-activations/${activation.id}/availability`)
      .send({
        operationalCapacity: 51,
        currentOccupancy: 0,
        reservedPlaces: 0,
        acceptingArrivals: true,
      })
      .expect(409);
  });

  it('returns conflict for inactive or terminal parents', async () => {
    const inactive = await createAvailabilityContext(app);
    await authenticatedRequest(app, accessToken)
      .post(`/shelter-activations/${inactive.activation.id}/deactivate`)
      .expect(201);

    await authenticatedRequest(app, accessToken)
      .put(`/shelter-activations/${inactive.activation.id}/availability`)
      .send({
        operationalCapacity: 20,
        currentOccupancy: 0,
        reservedPlaces: 0,
        acceptingArrivals: true,
      })
      .expect(409);

    const terminal = await createAvailabilityContext(app);
    await authenticatedRequest(app, accessToken)
      .post(`/emergency-operations/${terminal.operation.id}/complete`)
      .expect(201);

    await authenticatedRequest(app, accessToken)
      .put(`/shelter-activations/${terminal.activation.id}/availability`)
      .send({
        operationalCapacity: 20,
        currentOccupancy: 0,
        reservedPlaces: 0,
        acceptingArrivals: true,
      })
      .expect(409);
  });
});
