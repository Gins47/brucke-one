import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for help-request constraint tests',
  );
}

const pool = new Pool({ connectionString: testDatabaseUrl });

type DatabaseError = Error & { code?: string; constraint?: string };
type HelpRequestInput = {
  emergencyOperationId?: string | null;
  publicReference?: string | null;
  requesterName?: string | null;
  requesterPhone?: string | null;
  requesterEmail?: string | null;
  groupSize?: number | null;
  locationDescription?: string | null;
  canTravelIndependently?: boolean | null;
  medicalSupportNeeded?: boolean | null;
  status?: string | null;
};

/** Uses the supplied value unless it is omitted, preserving explicit nulls. */
function valueOrDefault<T>(value: T | undefined, defaultValue: T): T {
  return value === undefined ? defaultValue : value;
}

/** Confirms that PostgreSQL rejects an invalid help-request operation. */
async function expectDatabaseError(
  operation: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  await expect(operation).rejects.toMatchObject<Partial<DatabaseError>>({
    code: expectedCode,
  });
}

/** Creates one emergency operation for an isolated help-request scenario. */
async function createOperation(client: PoolClient): Promise<string> {
  const organization = await client.query<{ id: string }>(
    `INSERT INTO organizations (code, name)
     VALUES ($1, $2)
     RETURNING id`,
    [`HR-${randomUUID().slice(0, 20)}`, 'Help Request Test Organization'],
  );
  const operation = await client.query<{ id: string }>(
    `INSERT INTO emergency_operations (
       organization_id, operation_code, name, country_code, type, severity, status
     )
     VALUES ($1, $2, $3, $4, 'FLOOD', 'LOW', 'PLANNED')
     RETURNING id`,
    [
      organization.rows[0].id,
      `HR-${randomUUID().slice(0, 20)}`,
      'Help Request Test Operation',
      'DE',
    ],
  );

  return operation.rows[0].id;
}

/** Inserts one structurally valid help request with optional constraint-test overrides. */
async function createHelpRequest(
  client: PoolClient,
  operationId: string,
  input: HelpRequestInput = {},
): Promise<{ status: string }> {
  const includesStatus = input.status !== undefined;
  const result = await client.query<{ status: string }>(
    `INSERT INTO help_requests (
       emergency_operation_id, public_reference, requester_name, requester_phone,
       requester_email, group_size, location_description,
       can_travel_independently, medical_support_needed${includesStatus ? ', status' : ''}
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9${includesStatus ? ', $10' : ''})
     RETURNING status`,
    [
      valueOrDefault(input.emergencyOperationId, operationId),
      valueOrDefault(input.publicReference, `REF-${randomUUID()}`),
      valueOrDefault(input.requesterName, 'Requesting Person'),
      valueOrDefault(input.requesterPhone, '+49123456789'),
      valueOrDefault(input.requesterEmail, null),
      valueOrDefault(input.groupSize, 1),
      valueOrDefault(input.locationDescription, 'Near the community centre'),
      valueOrDefault(input.canTravelIndependently, true),
      valueOrDefault(input.medicalSupportNeeded, false),
      ...(includesStatus ? [input.status] : []),
    ],
  );

  return result.rows[0];
}

describe('help request database constraints', () => {
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

  it('persists a valid request with the default pending-review status', async () => {
    const operationId = await createOperation(client);

    await expect(createHelpRequest(client, operationId)).resolves.toEqual({
      status: 'PENDING_REVIEW',
    });
  });

  it.each([
    'emergencyOperationId',
    'publicReference',
    'requesterName',
    'requesterPhone',
    'groupSize',
    'locationDescription',
    'canTravelIndependently',
    'medicalSupportNeeded',
    'status',
  ] as const)('rejects an explicit null %s field', async (field) => {
    const operationId = await createOperation(client);

    await expectDatabaseError(
      createHelpRequest(client, operationId, { [field]: null }),
      '23502',
    );
  });

  it.each([0, -1])('rejects a group size of %i', async (groupSize) => {
    const operationId = await createOperation(client);

    await expectDatabaseError(
      createHelpRequest(client, operationId, { groupSize }),
      '23514',
    );
  });

  it('rejects an email that is not lowercased and trimmed', async () => {
    const operationId = await createOperation(client);

    await expect(
      createHelpRequest(client, operationId, {
        requesterEmail: 'Person@Example.test ',
      }),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'help_requests_requester_email_normalized_check',
    });
  });

  it('rejects a duplicate normalized email for one operation', async () => {
    const operationId = await createOperation(client);
    const requesterEmail = `person-${randomUUID()}@example.test`;

    await createHelpRequest(client, operationId, { requesterEmail });

    await expectDatabaseError(
      createHelpRequest(client, operationId, { requesterEmail }),
      '23505',
    );
  });

  it('allows the same normalized email for different operations', async () => {
    const requesterEmail = `person-${randomUUID()}@example.test`;
    const firstOperationId = await createOperation(client);
    const secondOperationId = await createOperation(client);

    await createHelpRequest(client, firstOperationId, { requesterEmail });

    await expect(
      createHelpRequest(client, secondOperationId, { requesterEmail }),
    ).resolves.toEqual({ status: 'PENDING_REVIEW' });
  });

  it('allows multiple requests without an email for one operation', async () => {
    const operationId = await createOperation(client);

    await createHelpRequest(client, operationId);

    await expect(createHelpRequest(client, operationId)).resolves.toEqual({
      status: 'PENDING_REVIEW',
    });
  });

  it('rejects a duplicate public reference', async () => {
    const operationId = await createOperation(client);
    const publicReference = `REF-${randomUUID()}`;

    await createHelpRequest(client, operationId, { publicReference });

    await expectDatabaseError(
      createHelpRequest(client, operationId, { publicReference }),
      '23505',
    );
  });

  it('rejects a request for an unknown operation', async () => {
    await expectDatabaseError(createHelpRequest(client, randomUUID()), '23503');
  });

  it('restricts deleting an operation while a request references it', async () => {
    const operationId = await createOperation(client);
    await createHelpRequest(client, operationId);

    await expectDatabaseError(
      client.query('DELETE FROM emergency_operations WHERE id = $1', [
        operationId,
      ]),
      '23001',
    );
  });
});
