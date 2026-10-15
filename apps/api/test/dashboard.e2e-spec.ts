import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

type OrganizationResponse = { id: string; code: string; name: string };
type EmergencyOperationResponse = { id: string };
type ShelterResponse = { id: string };
type ShelterActivationResponse = { id: string };
type DashboardOverviewResponse = {
  organization: OrganizationResponse;
  operationCounts: {
    planned: number;
    active: number;
    completed: number;
    cancelled: number;
  };
  shelterCount: number;
  activeShelterActivationCount: number;
};

/** Creates an organization through the API for a dashboard overview test. */
async function createOrganization(
  app: INestApplication<App>,
): Promise<OrganizationResponse> {
  const response = await request(app.getHttpServer())
    .post('/organizations')
    .send({
      code: `ORG-${randomUUID().slice(0, 26)}`,
      name: 'Dashboard Test Organization',
    })
    .expect(201);

  const organization = response.body as OrganizationResponse;

  return {
    id: organization.id,
    code: organization.code,
    name: organization.name,
  };
}

/** Creates an operation through the API for a dashboard overview test. */
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

/** Transitions an operation through one of its supported command endpoints. */
async function transitionOperation(
  app: INestApplication<App>,
  operationId: string,
  command: 'activate' | 'complete' | 'cancel',
): Promise<void> {
  await request(app.getHttpServer())
    .post(`/emergency-operations/${operationId}/${command}`)
    .expect(201);
}

/** Creates a shelter through the API for a dashboard overview test. */
async function createShelter(
  app: INestApplication<App>,
  organizationId: string,
): Promise<ShelterResponse> {
  const response = await request(app.getHttpServer())
    .post('/shelters')
    .send({
      organizationId,
      shelterCode: `SH-${randomUUID()}`,
      name: 'Munich Community Hall',
      address: 'Example Street 10, 80331 Munich',
      countryCode: 'DE',
      capacity: 250,
    })
    .expect(201);

  return response.body as ShelterResponse;
}

/** Creates an active shelter activation through the API for a dashboard test. */
async function createActivation(
  app: INestApplication<App>,
  shelterId: string,
  emergencyOperationId: string,
): Promise<ShelterActivationResponse> {
  const response = await request(app.getHttpServer())
    .post('/shelter-activations')
    .send({ shelterId, emergencyOperationId })
    .expect(201);

  return response.body as ShelterActivationResponse;
}

describe('Dashboard API (e2e)', () => {
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

  it('returns exact counts for operations, shelters, and active activations', async () => {
    const organization = await createOrganization(app);
    await createOperation(app, organization.id);
    const activeOperation = await createOperation(app, organization.id);
    const completedOperation = await createOperation(app, organization.id);
    const cancelledOperation = await createOperation(app, organization.id);

    await transitionOperation(app, activeOperation.id, 'activate');
    await transitionOperation(app, completedOperation.id, 'activate');
    await transitionOperation(app, completedOperation.id, 'complete');
    await transitionOperation(app, cancelledOperation.id, 'cancel');

    const activeShelter = await createShelter(app, organization.id);
    const inactiveShelter = await createShelter(app, organization.id);
    await createShelter(app, organization.id);
    await createActivation(app, activeShelter.id, activeOperation.id);
    const inactiveActivation = await createActivation(
      app,
      inactiveShelter.id,
      activeOperation.id,
    );
    await request(app.getHttpServer())
      .post(`/shelter-activations/${inactiveActivation.id}/deactivate`)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/dashboard/organizations/${organization.id}/overview`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual<DashboardOverviewResponse>({
          organization,
          operationCounts: {
            planned: 1,
            active: 1,
            completed: 1,
            cancelled: 1,
          },
          shelterCount: 3,
          activeShelterActivationCount: 1,
        });
      });
  });

  it('returns zero counts when an organization has no operational data', async () => {
    const organization = await createOrganization(app);

    await request(app.getHttpServer())
      .get(`/dashboard/organizations/${organization.id}/overview`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual<DashboardOverviewResponse>({
          organization,
          operationCounts: {
            planned: 0,
            active: 0,
            completed: 0,
            cancelled: 0,
          },
          shelterCount: 0,
          activeShelterActivationCount: 0,
        });
      });
  });

  it('returns not found for a valid but unknown organization ID', async () => {
    await request(app.getHttpServer())
      .get(`/dashboard/organizations/${randomUUID()}/overview`)
      .expect(404);
  });
});
