import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

type OrganizationResponse = { id: string };
type EmergencyOperationResponse = { id: string };
type ShelterResponse = { id: string };
type ShelterActivationResponse = { id: string };
type AffectedRegionResponse = { id: string };
type DashboardMapResponse = {
  operation: {
    id: string;
    organizationId: string;
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
  affectedRegions: Array<{
    id: string;
    countryCode: string;
    regionCode: string;
    regionName: string;
    addedAt: string;
  }>;
  activeShelters: Array<{
    shelterId: string;
    shelterCode: string;
    name: string;
    address: string;
    countryCode: string;
    latitude: number;
    longitude: number;
    capacity: number;
    contactEmail: string | null;
    contactPhone: string | null;
    activatedAt: string;
  }>;
  unmappedActiveShelterCount: number;
};

/** Creates an organization through the API for a dashboard map test. */
async function createOrganization(
  app: INestApplication<App>,
): Promise<OrganizationResponse> {
  const response = await request(app.getHttpServer())
    .post('/organizations')
    .send({
      code: `ORG-${randomUUID().slice(0, 26)}`,
      name: 'Dashboard Map Test Organization',
    })
    .expect(201);

  return response.body as OrganizationResponse;
}

/** Creates an emergency operation through the API for a dashboard map test. */
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

/** Creates a shelter, optionally including its complete coordinate pair. */
async function createShelter(
  app: INestApplication<App>,
  organizationId: string,
  mapped: boolean,
): Promise<ShelterResponse> {
  const response = await request(app.getHttpServer())
    .post('/shelters')
    .send({
      organizationId,
      shelterCode: `SH-${randomUUID()}`,
      name: mapped ? 'Mapped Community Hall' : 'Unmapped Community Hall',
      address: 'Example Street 10, 80331 Munich',
      countryCode: 'DE',
      capacity: 250,
      ...(mapped ? { latitude: 48.1351, longitude: 11.582 } : {}),
    })
    .expect(201);

  return response.body as ShelterResponse;
}

/** Creates an affected region through the public API. */
async function createAffectedRegion(
  app: INestApplication<App>,
  operationId: string,
  countryCode: string,
  regionCode: string,
): Promise<AffectedRegionResponse> {
  const response = await request(app.getHttpServer())
    .post(`/emergency-operations/${operationId}/affected-regions`)
    .send({ countryCode, regionCode, regionName: `Region ${regionCode}` })
    .expect(201);

  return response.body as AffectedRegionResponse;
}

/** Activates a shelter through the public API for an active operation. */
async function createActivation(
  app: INestApplication<App>,
  shelterId: string,
  operationId: string,
): Promise<ShelterActivationResponse> {
  const response = await request(app.getHttpServer())
    .post('/shelter-activations')
    .send({ shelterId, emergencyOperationId: operationId })
    .expect(201);

  return response.body as ShelterActivationResponse;
}

/** Activates an operation before shelters are associated with it. */
async function activateOperation(
  app: INestApplication<App>,
  operationId: string,
): Promise<void> {
  await request(app.getHttpServer())
    .post(`/emergency-operations/${operationId}/activate`)
    .expect(201);
}

/** Loads the dashboard map projection for an operation. */
async function getMap(
  app: INestApplication<App>,
  operationId: string,
): Promise<DashboardMapResponse> {
  const response = await request(app.getHttpServer())
    .get(`/dashboard/emergency-operations/${operationId}/map`)
    .expect(200);

  return response.body as DashboardMapResponse;
}

/** Creates an organization with one active operation for a map test. */
async function createActiveOperation(app: INestApplication<App>): Promise<{
  organization: OrganizationResponse;
  operation: EmergencyOperationResponse;
}> {
  const organization = await createOrganization(app);
  const operation = await createOperation(app, organization.id);
  await activateOperation(app, operation.id);

  return { organization, operation };
}

describe('Dashboard emergency operation map API (e2e)', () => {
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

  it('returns the requested operation summary', async () => {
    const { organization, operation } = await createActiveOperation(app);
    const map = await getMap(app, operation.id);

    expect(map.operation).toMatchObject({
      id: operation.id,
      organizationId: organization.id,
      name: 'Bayern Flood 2026',
      countryCode: 'DE',
      type: 'FLOOD',
      severity: 'HIGH',
      status: 'ACTIVE',
      endedAt: null,
    });
    expect(typeof map.operation.operationCode).toBe('string');
    expect(typeof map.operation.startedAt).toBe('string');
    expect(typeof map.operation.updatedAt).toBe('string');
  });

  it('returns current affected regions in country and region-code order', async () => {
    const { operation } = await createActiveOperation(app);
    const germanyRegion = await createAffectedRegion(
      app,
      operation.id,
      'DE',
      'DE-HE',
    );
    const bavariaRegion = await createAffectedRegion(
      app,
      operation.id,
      'DE',
      'DE-BY',
    );
    const austriaRegion = await createAffectedRegion(
      app,
      operation.id,
      'AT',
      'AT-9',
    );

    const regionIds = (await getMap(app, operation.id)).affectedRegions.map(
      (region) => region.id,
    );

    expect(regionIds).toEqual([
      austriaRegion.id,
      bavariaRegion.id,
      germanyRegion.id,
    ]);
  });

  it('excludes logically removed affected regions', async () => {
    const { operation } = await createActiveOperation(app);
    const currentRegion = await createAffectedRegion(
      app,
      operation.id,
      'DE',
      'DE-BY',
    );
    const removedRegion = await createAffectedRegion(
      app,
      operation.id,
      'DE',
      'DE-HE',
    );
    await request(app.getHttpServer())
      .post(
        `/emergency-operations/${operation.id}/affected-regions/${removedRegion.id}/remove`,
      )
      .expect(201);

    expect((await getMap(app, operation.id)).affectedRegions).toEqual([
      expect.objectContaining({ id: currentRegion.id }),
    ]);
  });

  it('returns active shelters with complete coordinates', async () => {
    const { organization, operation } = await createActiveOperation(app);
    const shelter = await createShelter(app, organization.id, true);
    await createActivation(app, shelter.id, operation.id);
    const map = await getMap(app, operation.id);

    expect(map.activeShelters).toEqual([
      expect.objectContaining({
        shelterId: shelter.id,
        name: 'Mapped Community Hall',
        address: 'Example Street 10, 80331 Munich',
        countryCode: 'DE',
        latitude: 48.1351,
        longitude: 11.582,
        capacity: 250,
        contactEmail: null,
        contactPhone: null,
      }),
    ]);
    expect(typeof map.activeShelters[0]?.activatedAt).toBe('string');
  });

  it('excludes deactivated shelter activations', async () => {
    const { organization, operation } = await createActiveOperation(app);
    const shelter = await createShelter(app, organization.id, true);
    const activation = await createActivation(app, shelter.id, operation.id);
    await request(app.getHttpServer())
      .post(`/shelter-activations/${activation.id}/deactivate`)
      .expect(201);

    expect((await getMap(app, operation.id)).activeShelters).toEqual([]);
  });

  it('excludes active shelters without coordinates and counts them as unmapped', async () => {
    const { organization, operation } = await createActiveOperation(app);
    const shelter = await createShelter(app, organization.id, false);
    await createActivation(app, shelter.id, operation.id);

    const map = await getMap(app, operation.id);

    expect(map.activeShelters).toEqual([]);
    expect(map.unmappedActiveShelterCount).toBe(1);
  });

  it('excludes active shelters belonging to another operation', async () => {
    const { organization, operation } = await createActiveOperation(app);
    const otherOperation = await createOperation(app, organization.id);
    const shelter = await createShelter(app, organization.id, true);
    await activateOperation(app, otherOperation.id);
    await createActivation(app, shelter.id, otherOperation.id);

    const map = await getMap(app, operation.id);

    expect(map.activeShelters).toEqual([]);
    expect(map.unmappedActiveShelterCount).toBe(0);
  });

  it('returns not found for a valid but unknown operation ID', async () => {
    await request(app.getHttpServer())
      .get(`/dashboard/emergency-operations/${randomUUID()}/map`)
      .expect(404);
  });
});
