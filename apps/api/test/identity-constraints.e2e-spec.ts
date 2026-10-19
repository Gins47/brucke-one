import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for identity constraint tests',
  );
}

const pool = new Pool({ connectionString: testDatabaseUrl });

type DatabaseError = Error & { code?: string };

/** Confirms that a database operation fails with the expected PostgreSQL code. */
async function expectDatabaseError(
  operation: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  await expect(operation).rejects.toMatchObject<Partial<DatabaseError>>({
    code: expectedCode,
  });
}

/** Inserts a normalized user for an identity constraint scenario. */
async function createUser(client: PoolClient): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO users (username, password_hash)
     VALUES ($1, $2)
     RETURNING id`,
    [`user-${randomUUID()}`, 'not-a-real-password-hash'],
  );

  return result.rows[0].id;
}

/** Inserts a global role with the ALL permission marker. */
async function createRole(client: PoolClient): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO roles (name, type, permissions)
     VALUES ($1, 'GLOBAL', ARRAY['ALL']::permission_marker[])
     RETURNING id`,
    [`ROLE-${randomUUID()}`],
  );

  return result.rows[0].id;
}

describe('identity database constraints', () => {
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

  it('rejects duplicate normalized usernames', async () => {
    const username = `admin-${randomUUID()}`;

    await client.query(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2)`,
      [username, 'not-a-real-password-hash'],
    );

    await expectDatabaseError(
      client.query(
        `INSERT INTO users (username, password_hash) VALUES ($1, $2)`,
        [username, 'another-not-a-real-password-hash'],
      ),
      '23505',
    );
  });

  it('rejects a username that is not normalized', async () => {
    await expect(
      client.query(
        `INSERT INTO users (username, password_hash) VALUES ($1, $2)`,
        ['Admin', 'not-a-real-password-hash'],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'users_username_normalized_check',
    });
  });

  it('rejects duplicate role names', async () => {
    const name = `ROLE-${randomUUID()}`;

    await client.query(
      `INSERT INTO roles (name, type, permissions)
       VALUES ($1, 'GLOBAL', ARRAY['ALL']::permission_marker[])`,
      [name],
    );

    await expectDatabaseError(
      client.query(
        `INSERT INTO roles (name, type, permissions)
         VALUES ($1, 'GLOBAL', ARRAY['ALL']::permission_marker[])`,
        [name],
      ),
      '23505',
    );
  });

  it('rejects duplicate user and role assignments', async () => {
    const userId = await createUser(client);
    const roleId = await createRole(client);

    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
      [userId, roleId],
    );

    await expectDatabaseError(
      client.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
        [userId, roleId],
      ),
      '23505',
    );
  });

  it('rejects an assignment with an invalid user reference', async () => {
    const roleId = await createRole(client);

    await expectDatabaseError(
      client.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
        [randomUUID(), roleId],
      ),
      '23503',
    );
  });

  it('rejects an assignment with an invalid role reference', async () => {
    const userId = await createUser(client);

    await expectDatabaseError(
      client.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
        [userId, randomUUID()],
      ),
      '23503',
    );
  });
});
