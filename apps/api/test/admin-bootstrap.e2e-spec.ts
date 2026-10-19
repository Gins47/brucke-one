import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';

import { AdminBootstrapService } from '../src/auth/admin-bootstrap.service';
import { hashPassword, verifyPassword } from '../src/auth/password-hash';
import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';
import { roles, userRoles, users } from '../src/database/schema';

const originalEnv = { ...process.env };

/** Sets explicit safe test credentials for one bootstrap scenario. */
function setBootstrapEnvironment(username = 'test-admin'): void {
  process.env.DATABASE_TARGET = 'test';
  process.env.NODE_ENV = 'development';
  process.env.ADMIN_BOOTSTRAP_ENABLED = 'true';
  process.env.ADMIN_USERNAME = username;
  process.env.ADMIN_PASSWORD = 'test-bootstrap-password';
}

/** Removes identity records from the isolated test database before each scenario. */
async function clearIdentityData(database: DatabaseService): Promise<void> {
  if (process.env.DATABASE_TARGET !== 'test') {
    throw new Error('Admin bootstrap tests require DATABASE_TARGET=test');
  }

  await database.db.delete(userRoles);
  await database.db.delete(users);
  await database.db.delete(roles);
}

describe('development admin bootstrap', () => {
  let module: TestingModule;
  let database: DatabaseService;
  let bootstrap: AdminBootstrapService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [AdminBootstrapService],
    }).compile();
    database = module.get(DatabaseService);
    bootstrap = module.get(AdminBootstrapService);
    await database.onModuleInit();
  });

  beforeEach(async () => {
    setBootstrapEnvironment();
    await clearIdentityData(database);
  });

  afterAll(async () => {
    process.env = { ...originalEnv };
    await module.close();
  });

  it('creates one ADMIN role, user, and assignment on first bootstrap', async () => {
    setBootstrapEnvironment(' Test-Admin ');

    await bootstrap.bootstrap();

    const roleRows = await database.db.select().from(roles);
    const userRows = await database.db.select().from(users);
    const assignmentRows = await database.db.select().from(userRoles);

    expect(roleRows).toEqual([
      expect.objectContaining({
        name: 'ADMIN',
        type: 'GLOBAL',
        permissions: ['ALL'],
      }),
    ]);
    expect(userRows).toHaveLength(1);
    expect(userRows[0].username).toBe('test-admin');
    expect(assignmentRows).toEqual([
      expect.objectContaining({
        userId: userRows[0].id,
        roleId: roleRows[0].id,
      }),
    ]);
  });

  it('stores hashes that can be verified with their stored salt and parameters', async () => {
    await bootstrap.bootstrap();

    const [user] = await database.db.select().from(users);
    const firstHash = await hashPassword('same-password');
    const secondHash = await hashPassword('same-password');

    await expect(
      verifyPassword('test-bootstrap-password', user.passwordHash),
    ).resolves.toBe(true);
    await expect(
      verifyPassword('wrong-password', user.passwordHash),
    ).resolves.toBe(false);
    expect(firstHash).not.toBe(secondHash);
    expect(firstHash.split('$')[3]).not.toBe(secondHash.split('$')[3]);
    await expect(verifyPassword('same-password', firstHash)).resolves.toBe(
      true,
    );
    await expect(verifyPassword('same-password', secondHash)).resolves.toBe(
      true,
    );
  });

  it('is idempotent and does not replace an existing password hash', async () => {
    await bootstrap.bootstrap();
    const [initialUser] = await database.db.select().from(users);

    process.env.ADMIN_PASSWORD = 'changed-test-bootstrap-password';
    await bootstrap.bootstrap();

    const [currentUser] = await database.db.select().from(users);
    const assignments = await database.db.select().from(userRoles);

    expect(currentUser.passwordHash).toBe(initialUser.passwordHash);
    expect(assignments).toHaveLength(1);
  });

  it('rejects an existing user without ADMIN and leaves it unchanged', async () => {
    await database.db.insert(users).values({
      username: 'test-admin',
      passwordHash: 'existing-password-hash',
    });

    await expect(bootstrap.bootstrap()).rejects.toThrow(
      'Existing admin user does not have the ADMIN role',
    );

    const [user] = await database.db
      .select()
      .from(users)
      .where(eq(users.username, 'test-admin'));
    const assignments = await database.db.select().from(userRoles);

    expect(user.passwordHash).toBe('existing-password-hash');
    expect(assignments).toHaveLength(0);
  });

  it('handles concurrent bootstrap attempts without duplicate records', async () => {
    setBootstrapEnvironment('concurrent-admin');

    await Promise.all(Array.from({ length: 4 }, () => bootstrap.bootstrap()));

    const roleRows = await database.db.select().from(roles);
    const userRows = await database.db.select().from(users);
    const assignmentRows = await database.db.select().from(userRoles);

    expect(roleRows).toHaveLength(1);
    expect(userRows).toHaveLength(1);
    expect(assignmentRows).toHaveLength(1);
  });

  it('is disabled by default', async () => {
    delete process.env.ADMIN_BOOTSTRAP_ENABLED;

    await bootstrap.bootstrap();

    await expect(database.db.select().from(roles)).resolves.toHaveLength(0);
    await expect(database.db.select().from(users)).resolves.toHaveLength(0);
  });

  it('requires a username and password when enabled', async () => {
    delete process.env.ADMIN_USERNAME;

    await expect(bootstrap.bootstrap()).rejects.toThrow(
      'ADMIN_USERNAME is required when admin bootstrap is enabled',
    );

    await expect(database.db.select().from(roles)).resolves.toHaveLength(0);
    await expect(database.db.select().from(users)).resolves.toHaveLength(0);
  });

  it('rejects enabled bootstrap outside development', async () => {
    process.env.NODE_ENV = 'production';

    await expect(bootstrap.bootstrap()).rejects.toThrow(
      'Admin bootstrap can only run in development',
    );

    await expect(database.db.select().from(roles)).resolves.toHaveLength(0);
    await expect(database.db.select().from(users)).resolves.toHaveLength(0);
  });

  it('rejects enabled bootstrap in the test environment', async () => {
    process.env.NODE_ENV = 'test';

    await expect(bootstrap.bootstrap()).rejects.toThrow(
      'Admin bootstrap can only run in development',
    );

    await expect(database.db.select().from(roles)).resolves.toHaveLength(0);
    await expect(database.db.select().from(users)).resolves.toHaveLength(0);
  });
});
