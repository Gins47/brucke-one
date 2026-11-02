import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for outbox constraint tests');
}

const pool = new Pool({ connectionString: testDatabaseUrl });

type DatabaseError = Error & { code?: string; constraint?: string };

/** Creates a help request that can own an isolated outbox event. */
async function createHelpRequest(client: PoolClient): Promise<string> {
  const organization = await client.query<{ id: string }>(
    `INSERT INTO organizations (code, name)
     VALUES ($1, $2)
     RETURNING id`,
    [`OUTBOX-${randomUUID().slice(0, 20)}`, 'Outbox Test Organization'],
  );
  const operation = await client.query<{ id: string }>(
    `INSERT INTO emergency_operations (
       organization_id, operation_code, name, country_code, type, severity, status
     )
     VALUES ($1, $2, $3, 'DE', 'FLOOD', 'LOW', 'PLANNED')
     RETURNING id`,
    [
      organization.rows[0].id,
      `OUTBOX-${randomUUID().slice(0, 20)}`,
      'Outbox Test Operation',
    ],
  );
  const helpRequest = await client.query<{ id: string }>(
    `INSERT INTO help_requests (
       emergency_operation_id, public_reference, requester_name, requester_phone,
       group_size, location_description, can_travel_independently,
       medical_support_needed
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      operation.rows[0].id,
      `OUTBOX-${randomUUID()}`,
      'Requesting Person',
      '+49123456789',
      1,
      'Near the community centre',
      true,
      false,
    ],
  );

  return helpRequest.rows[0].id;
}

describe('outbox event database constraints', () => {
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

  it.each([
    ['an extra requester-email key', true],
    ['a mismatched outbox event identifier', false],
  ])('rejects a payload with %s', async (_description, hasExtraKey) => {
    const eventId = randomUUID();
    const helpRequestId = await createHelpRequest(client);
    const payload = hasExtraKey
      ? {
          outboxEventId: eventId,
          helpRequestId,
          requesterEmail: 'person@example.test',
        }
      : {
          outboxEventId: randomUUID(),
          helpRequestId,
        };

    await expect(
      client.query(
        `INSERT INTO outbox_events (id, event_type, help_request_id, payload)
         VALUES ($1, 'help-request-submitted', $2, $3::jsonb)`,
        [eventId, helpRequestId, JSON.stringify(payload)],
      ),
    ).rejects.toMatchObject<Partial<DatabaseError>>({
      code: '23514',
      constraint: 'outbox_events_identifier_payload_check',
    });
  });
});
