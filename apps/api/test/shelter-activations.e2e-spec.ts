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
type ShelterResponse = { id: string; organizationId: string };
type EmergencyOperationResponse = { id: string; organizationId: string };
type ShelterActivationResponse = {
  id: string;
  organizationId: string;
  shelterId: string;
  emergencyOperationId: string;
  status: 'ACTIVE' | 'DEACTIVATED';
  activatedAt: string;
  deactivatedAt: string | null;
};
type ValidationErrorResponse = {
  statusCode: number;
  message: string;
  errors: Array<{ field: string; code: string; message: string }>;
};

/** Creates an organization through the API for a shelter-activation test. */
async function createOrganization(
  app: INestApplication<App>,
): Promise<OrganizationResponse> {
  const response = await authenticatedRequest(app, accessToken)
    .post('/organizations')
    .send({
      code: `ORG-${randomUUID().slice(0, 26)}`,
      name: 'Shelter Activation Test Organization',
    })
    .expect(201);

  return response.body as OrganizationResponse;
}

/** Creates a shelter through the API for a shelter-activation test. */
async function createShelter(
  app: INestApplication<App>,
  organizationId: string,
): Promise<ShelterResponse> {
  const response = await authenticatedRequest(app, accessToken)
    .post('/shelters')
    .send({
      organizationId,
      shelterCode: `MUC-${randomUUID()}`,
      name: 'Munich Community Hall',
      address: 'Example Street 10, 80331 Munich',
      countryCode: 'DE',
      capacity: 250,
    })
    .expect(201);

  return response.body as ShelterResponse;
}

/** Creates an emergency operation, optionally activating it for an activation test. */
async function createOperation(
  app: INestApplication<App>,
  organizationId: string,
  active = false,
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
  const operation = response.body as EmergencyOperationResponse;

  if (active) {
    await authenticatedRequest(app, accessToken)
      .post(`/emergency-operations/${operation.id}/activate`)
      .expect(201);
  }

  return operation;
}

/** Creates an active shelter activation through the public API. */
async function createActivation(
  app: INestApplication<App>,
  shelterId: string,
  emergencyOperationId: string,
): Promise<ShelterActivationResponse> {
  const response = await authenticatedRequest(app, accessToken)
    .post('/shelter-activations')
    .send({ shelterId, emergencyOperationId })
    .expect(201);

  return response.body as ShelterActivationResponse;
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

describe('ShelterActivations API (e2e)', () => {
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

  it('activates a shelter and returns it by ID and in history', async () => {
    const organization = await createOrganization(app);
    const shelter = await createShelter(app, organization.id);
    const operation = await createOperation(app, organization.id, true);
    const activation = await createActivation(app, shelter.id, operation.id);

    expect(activation).toMatchObject({
      organizationId: organization.id,
      shelterId: shelter.id,
      emergencyOperationId: operation.id,
      status: 'ACTIVE',
      deactivatedAt: null,
    });
    expect(typeof activation.activatedAt).toBe('string');

    await authenticatedRequest(app, accessToken)
      .get(`/shelter-activations/${activation.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject(activation);
      });

    await authenticatedRequest(app, accessToken)
      .get('/shelter-activations')
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.arrayContaining([expect.objectContaining(activation)]),
        );
      });
  });

  it('returns not found for an unknown shelter or emergency operation', async () => {
    const organization = await createOrganization(app);
    const operation = await createOperation(app, organization.id, true);
    const shelter = await createShelter(app, organization.id);

    await authenticatedRequest(app, accessToken)
      .post('/shelter-activations')
      .send({ shelterId: randomUUID(), emergencyOperationId: operation.id })
      .expect(404);

    await authenticatedRequest(app, accessToken)
      .post('/shelter-activations')
      .send({ shelterId: shelter.id, emergencyOperationId: randomUUID() })
      .expect(404);
  });

  it('returns conflict when the shelter and operation belong to different organizations', async () => {
    const shelterOrganization = await createOrganization(app);
    const operationOrganization = await createOrganization(app);
    const shelter = await createShelter(app, shelterOrganization.id);
    const operation = await createOperation(
      app,
      operationOrganization.id,
      true,
    );

    await authenticatedRequest(app, accessToken)
      .post('/shelter-activations')
      .send({ shelterId: shelter.id, emergencyOperationId: operation.id })
      .expect(409);
  });

  it('returns conflict when the emergency operation is planned', async () => {
    const organization = await createOrganization(app);
    const shelter = await createShelter(app, organization.id);
    const operation = await createOperation(app, organization.id);

    await authenticatedRequest(app, accessToken)
      .post('/shelter-activations')
      .send({ shelterId: shelter.id, emergencyOperationId: operation.id })
      .expect(409);
  });

  it('returns conflict for a second active activation of the same shelter', async () => {
    const organization = await createOrganization(app);
    const shelter = await createShelter(app, organization.id);
    const firstOperation = await createOperation(app, organization.id, true);
    const secondOperation = await createOperation(app, organization.id, true);
    await createActivation(app, shelter.id, firstOperation.id);

    await authenticatedRequest(app, accessToken)
      .post('/shelter-activations')
      .send({ shelterId: shelter.id, emergencyOperationId: secondOperation.id })
      .expect(409);
  });

  it('deactivates an activation and persists its history', async () => {
    const organization = await createOrganization(app);
    const shelter = await createShelter(app, organization.id);
    const operation = await createOperation(app, organization.id, true);
    const activation = await createActivation(app, shelter.id, operation.id);

    const deactivated = await authenticatedRequest(app, accessToken)
      .post(`/shelter-activations/${activation.id}/deactivate`)
      .expect(201);
    expect(deactivated.body).toMatchObject({
      id: activation.id,
      status: 'DEACTIVATED',
    });
    expect(
      typeof (deactivated.body as ShelterActivationResponse).deactivatedAt,
    ).toBe('string');

    await authenticatedRequest(app, accessToken)
      .get(`/shelter-activations/${activation.id}`)
      .expect(200)
      .expect((response) => {
        const storedActivation = response.body as ShelterActivationResponse;

        expect(storedActivation).toMatchObject({
          status: 'DEACTIVATED',
        });
        expect(typeof storedActivation.deactivatedAt).toBe('string');
      });
  });

  it('returns conflict when deactivating an activation twice', async () => {
    const organization = await createOrganization(app);
    const shelter = await createShelter(app, organization.id);
    const operation = await createOperation(app, organization.id, true);
    const activation = await createActivation(app, shelter.id, operation.id);

    await authenticatedRequest(app, accessToken)
      .post(`/shelter-activations/${activation.id}/deactivate`)
      .expect(201);

    await authenticatedRequest(app, accessToken)
      .post(`/shelter-activations/${activation.id}/deactivate`)
      .expect(409);
  });

  it('allows a shelter to be activated again after deactivation and retains history', async () => {
    const organization = await createOrganization(app);
    const shelter = await createShelter(app, organization.id);
    const operation = await createOperation(app, organization.id, true);
    const firstActivation = await createActivation(
      app,
      shelter.id,
      operation.id,
    );

    await authenticatedRequest(app, accessToken)
      .post(`/shelter-activations/${firstActivation.id}/deactivate`)
      .expect(201);

    const secondActivation = await createActivation(
      app,
      shelter.id,
      operation.id,
    );
    expect(secondActivation).toMatchObject({ status: 'ACTIVE' });

    await authenticatedRequest(app, accessToken)
      .get('/shelter-activations')
      .expect(200)
      .expect((response) => {
        const history = response.body as ShelterActivationResponse[];
        const matchingActivations = history.filter(
          (activation) =>
            activation.shelterId === shelter.id &&
            activation.emergencyOperationId === operation.id,
        );

        expect(matchingActivations).toHaveLength(2);
        expect(matchingActivations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: firstActivation.id,
              status: 'DEACTIVATED',
            }),
            expect.objectContaining({
              id: secondActivation.id,
              status: 'ACTIVE',
            }),
          ]),
        );
      });
  });

  it('returns a structured validation error for unknown create fields', async () => {
    await authenticatedRequest(app, accessToken)
      .post('/shelter-activations')
      .send({
        shelterId: randomUUID(),
        emergencyOperationId: randomUUID(),
        status: 'ACTIVE',
      })
      .expect(400)
      .expect(expectValidationError);
  });

  it('returns a structured validation error when organizationId is supplied', async () => {
    await authenticatedRequest(app, accessToken)
      .post('/shelter-activations')
      .send({
        shelterId: randomUUID(),
        emergencyOperationId: randomUUID(),
        organizationId: randomUUID(),
      })
      .expect(400)
      .expect(expectValidationError);
  });
});
