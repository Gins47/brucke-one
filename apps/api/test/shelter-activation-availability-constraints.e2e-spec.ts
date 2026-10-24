import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for shelter availability constraint tests',
  );
}

const pool = new Pool({ connectionString: testDatabaseUrl });

type DatabaseError = Error & { code?: string };

/** Confirms that a PostgreSQL constraint rejects an invalid database operation. */
async function expectDatabaseError(
  operation: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  await expect(operation).rejects.toMatchObject<Partial<DatabaseError>>({
    code: expectedCode,
  });
}

/** Creates an active shelter activation for one isolated constraint scenario. */
async function createActivation(client: PoolClient): Promise<string> {
  const organization = await client.query<{ id: string }>(
    `INSERT INTO organizations (code, name)
     VALUES ($1, $2)
     RETURNING id`,
    [`O-${randomUUID().slice(0, 27)}`, 'Availability Constraint Organization'],
  );
  const organizationId = organization.rows[0].id;
  const shelter = await client.query<{ id: string }>(
    `INSERT INTO shelters (
       organization_id, shelter_code, name, address, country_code, capacity
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      organizationId,
      `SHELTER-${randomUUID()}`,
      'Availability Constraint Shelter',
      'Test Address',
      'DE',
      10,
    ],
  );
  const operation = await client.query<{ id: string }>(
    `INSERT INTO emergency_operations (
       organization_id, operation_code, name, country_code, type, severity, status
     )
     VALUES ($1, $2, $3, $4, 'FLOOD', 'LOW', 'ACTIVE')
     RETURNING id`,
    [
      organizationId,
      `OP-${randomUUID()}`,
      'Availability Constraint Operation',
      'DE',
    ],
  );
  const activation = await client.query<{ id: string }>(
    `INSERT INTO shelter_activations (
       organization_id, shelter_id, emergency_operation_id, status, activated_at
     )
     VALUES ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP)
     RETURNING id`,
    [organizationId, shelter.rows[0].id, operation.rows[0].id],
  );

  return activation.rows[0].id;
}

/** Inserts one availability row using values that satisfy every availability constraint. */
async function createAvailability(
  client: PoolClient,
  activationId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO shelter_activation_availability (
       shelter_activation_id, operational_capacity, current_occupancy,
       reserved_places, accepting_arrivals, reported_at
     )
     VALUES ($1, 10, 4, 2, TRUE, CURRENT_TIMESTAMP)`,
    [activationId],
  );
}

describe('shelter activation availability database constraints', () => {
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

  it('allows only one availability record for a shelter activation', async () => {
    const activationId = await createActivation(client);
    await createAvailability(client, activationId);

    await expectDatabaseError(
      createAvailability(client, activationId),
      '23505',
    );
  });

  it('rejects availability for an unknown shelter activation', async () => {
    await expectDatabaseError(
      createAvailability(client, randomUUID()),
      '23503',
    );
  });

  it.each([
    ['operational capacity', -1, 0, 0],
    ['current occupancy', 1, -1, 0],
    ['reserved places', 1, 0, -1],
  ])('rejects negative %s', async (_label, capacity, occupancy, reserved) => {
    const activationId = await createActivation(client);

    await expectDatabaseError(
      client.query(
        `INSERT INTO shelter_activation_availability (
           shelter_activation_id, operational_capacity, current_occupancy,
           reserved_places, accepting_arrivals, reported_at
         )
         VALUES ($1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP)`,
        [activationId, capacity, occupancy, reserved],
      ),
      '23514',
    );
  });

  it('rejects occupancy and reservations above operational capacity', async () => {
    const activationId = await createActivation(client);

    await expectDatabaseError(
      client.query(
        `INSERT INTO shelter_activation_availability (
           shelter_activation_id, operational_capacity, current_occupancy,
           reserved_places, accepting_arrivals, reported_at
         )
         VALUES ($1, 10, 7, 4, TRUE, CURRENT_TIMESTAMP)`,
        [activationId],
      ),
      '23514',
    );
  });

  it('restricts deletion of an activation with availability', async () => {
    const activationId = await createActivation(client);
    await createAvailability(client, activationId);

    await expectDatabaseError(
      client.query('DELETE FROM shelter_activations WHERE id = $1', [
        activationId,
      ]),
      '23001',
    );
  });
});
