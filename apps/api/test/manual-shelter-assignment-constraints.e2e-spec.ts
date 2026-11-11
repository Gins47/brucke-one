import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required');
const pool = new Pool({ connectionString: testDatabaseUrl });

/** Creates one operation with a request and an activated shelter. */
async function createFixture(client: PoolClient) {
  const suffix = randomUUID();
  const organization = await client.query<{ id: string }>(
    'INSERT INTO organizations (code, name) VALUES ($1, $2) RETURNING id',
    [`O-${suffix.slice(0, 20)}`, 'Test organization'],
  );
  const organizationId = organization.rows[0].id;
  const operation = await client.query<{ id: string }>(
    `INSERT INTO emergency_operations
       (organization_id, operation_code, name, country_code, type, severity, status)
     VALUES ($1, $2, 'Test operation', 'DE', 'FLOOD', 'LOW', 'ACTIVE') RETURNING id`,
    [organizationId, `OP-${suffix}`],
  );
  const operationId = operation.rows[0].id;
  const shelter = await client.query<{ id: string }>(
    `INSERT INTO shelters (organization_id, shelter_code, name, address, country_code, capacity)
     VALUES ($1, $2, 'Test shelter', 'Test address', 'DE', 10) RETURNING id`,
    [organizationId, `S-${suffix}`],
  );
  const activation = await client.query<{ id: string }>(
    `INSERT INTO shelter_activations
       (organization_id, shelter_id, emergency_operation_id, status, activated_at)
     VALUES ($1, $2, $3, 'ACTIVE', now()) RETURNING id`,
    [organizationId, shelter.rows[0].id, operationId],
  );
  const request = await client.query<{ id: string }>(
    `INSERT INTO help_requests
       (emergency_operation_id, public_reference, requester_name, requester_phone,
        group_size, location_description, can_travel_independently, medical_support_needed)
     VALUES ($1, $2, 'Test person', '123', 2, 'Test location', true, false) RETURNING id`,
    [operationId, `REF-${suffix}`],
  );
  const user = await client.query<{ id: string }>(
    'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
    [`test-${suffix}`, 'test-hash'],
  );
  return {
    operationId,
    requestId: request.rows[0].id,
    activationId: activation.rows[0].id,
    userId: user.rows[0].id,
  };
}

/** Inserts an assignment for a fixture with an optional reserved size. */
function insertAssignment(
  client: PoolClient,
  fixture: Awaited<ReturnType<typeof createFixture>>,
  size = 2,
) {
  return client.query<{ id: string }>(
    `INSERT INTO help_request_shelter_assignments
       (help_request_id, emergency_operation_id, shelter_activation_id, reserved_group_size, assigned_by_user_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      fixture.requestId,
      fixture.operationId,
      fixture.activationId,
      size,
      fixture.userId,
    ],
  );
}

describe('manual shelter assignment database constraints', () => {
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

  it('stores an assignment within one operation', async () => {
    const fixture = await createFixture(client);
    const result = await insertAssignment(client, fixture);
    expect(result.rows[0].id).toEqual(expect.any(String));
  });

  it('rejects a second assignment for the same request', async () => {
    const fixture = await createFixture(client);
    await insertAssignment(client, fixture);
    await expect(insertAssignment(client, fixture)).rejects.toMatchObject({
      code: '23505',
      constraint: 'help_request_shelter_assignments_help_request_unique',
    });
  });

  it('rejects an activation from a different operation', async () => {
    const fixture = await createFixture(client);
    const other = await createFixture(client);
    await expect(
      insertAssignment(client, {
        ...fixture,
        activationId: other.activationId,
      }),
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'help_request_shelter_assignments_activation_operation_fk',
    });
  });

  it.each([0, -1])('rejects reserved group size %i', async (size) => {
    const fixture = await createFixture(client);
    await expect(insertAssignment(client, fixture, size)).rejects.toMatchObject(
      {
        code: '23514',
        constraint:
          'help_request_shelter_assignments_group_size_positive_check',
      },
    );
  });
});
