import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for database constraint tests',
  );
}

const pool = new Pool({ connectionString: testDatabaseUrl });

type DatabaseError = Error & { code?: string };

/** Returns the PostgreSQL error code from a rejected database operation. */
async function expectDatabaseError(
  operation: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  await expect(operation).rejects.toMatchObject<Partial<DatabaseError>>({
    code: expectedCode,
  });
}

/** Inserts an organization and returns its UUID for a constraint scenario. */
async function createOrganization(client: PoolClient): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO organizations (code, name)
     VALUES ($1, $2)
     RETURNING id`,
    [`O-${randomUUID().slice(0, 27)}`, 'Constraint Test Organization'],
  );

  return result.rows[0].id;
}

/** Inserts an active emergency operation for the supplied organization. */
async function createEmergencyOperation(
  client: PoolClient,
  organizationId: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO emergency_operations (
       organization_id, operation_code, name, country_code, type, severity, status
     )
     VALUES ($1, $2, $3, $4, 'FLOOD', 'LOW', 'ACTIVE')
     RETURNING id`,
    [organizationId, `OP-${randomUUID()}`, 'Constraint Test Operation', 'DE'],
  );

  return result.rows[0].id;
}

/** Inserts a shelter for the supplied organization. */
async function createShelter(
  client: PoolClient,
  organizationId: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO shelters (
       organization_id, shelter_code, name, address, country_code, capacity
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      organizationId,
      `SHELTER-${randomUUID()}`,
      'Constraint Test Shelter',
      'Test Address',
      'DE',
      10,
    ],
  );

  return result.rows[0].id;
}

describe('core domain database constraints', () => {
  let client: PoolClient;

  beforeAll(async () => {
    client = await pool.connect();
  });

  beforeEach(async () => {
    await client.query('BEGIN');
  });

  afterEach(async () => {
    await client.query('ROLLBACK');
  });

  afterAll(async () => {
    client.release();
    await pool.end();
  });

  it('rejects an activation whose shelter and operation have different organizations', async () => {
    const shelterOrganizationId = await createOrganization(client);
    const operationOrganizationId = await createOrganization(client);
    const shelterId = await createShelter(client, shelterOrganizationId);
    const operationId = await createEmergencyOperation(
      client,
      operationOrganizationId,
    );

    await expectDatabaseError(
      client.query(
        `INSERT INTO shelter_activations (
           organization_id, shelter_id, emergency_operation_id, status, activated_at
         )
         VALUES ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP)`,
        [shelterOrganizationId, shelterId, operationId],
      ),
      '23503',
    );
  });

  it('rejects a second active activation for the same shelter', async () => {
    const organizationId = await createOrganization(client);
    const shelterId = await createShelter(client, organizationId);
    const operationId = await createEmergencyOperation(client, organizationId);

    await client.query(
      `INSERT INTO shelter_activations (
         organization_id, shelter_id, emergency_operation_id, status, activated_at
       )
       VALUES ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP)`,
      [organizationId, shelterId, operationId],
    );

    await expectDatabaseError(
      client.query(
        `INSERT INTO shelter_activations (
           organization_id, shelter_id, emergency_operation_id, status, activated_at
         )
         VALUES ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP)`,
        [organizationId, shelterId, operationId],
      ),
      '23505',
    );
  });

  it('rejects duplicate current affected-region assignments', async () => {
    const organizationId = await createOrganization(client);
    const operationId = await createEmergencyOperation(client, organizationId);

    await client.query(
      `INSERT INTO operation_affected_regions (
         emergency_operation_id, country_code, region_code, region_name, added_at
       )
       VALUES ($1, 'DE', 'DE-BY', 'Bavaria', CURRENT_TIMESTAMP)`,
      [operationId],
    );

    await expectDatabaseError(
      client.query(
        `INSERT INTO operation_affected_regions (
           emergency_operation_id, country_code, region_code, region_name, added_at
         )
         VALUES ($1, 'DE', 'DE-BY', 'Bavaria', CURRENT_TIMESTAMP)`,
        [operationId],
      ),
      '23505',
    );
  });

  it('allows a region to be added again after logical removal', async () => {
    const organizationId = await createOrganization(client);
    const operationId = await createEmergencyOperation(client, organizationId);

    const firstRegion = await client.query<{ id: string }>(
      `INSERT INTO operation_affected_regions (
         emergency_operation_id, country_code, region_code, region_name, added_at
       )
       VALUES ($1, 'DE', 'DE-BY', 'Bavaria', CURRENT_TIMESTAMP)
       RETURNING id`,
      [operationId],
    );

    await client.query(
      `UPDATE operation_affected_regions
       SET removed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [firstRegion.rows[0].id],
    );

    await expect(
      client.query(
        `INSERT INTO operation_affected_regions (
           emergency_operation_id, country_code, region_code, region_name, added_at
         )
         VALUES ($1, 'DE', 'DE-BY', 'Bavaria', CURRENT_TIMESTAMP)`,
        [operationId],
      ),
    ).resolves.toBeDefined();
  });

  it('rejects an emergency operation ending before it starts', async () => {
    const organizationId = await createOrganization(client);

    await expectDatabaseError(
      client.query(
        `INSERT INTO emergency_operations (
           organization_id, operation_code, name, country_code, type, severity,
           status, started_at, ended_at
         )
         VALUES ($1, $2, $3, $4, 'FLOOD', 'LOW', 'PLANNED',
                 '2026-10-13T10:00:00Z', '2026-10-13T09:00:00Z')`,
        [
          organizationId,
          `OP-${randomUUID()}`,
          'Invalid Timestamp Operation',
          'DE',
        ],
      ),
      '23514',
    );
  });
});
