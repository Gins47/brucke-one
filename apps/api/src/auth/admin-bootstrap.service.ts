import { Injectable, OnModuleInit } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { roles, userRoles, users } from '../database/schema';
import { getAdminBootstrapConfig } from './admin-bootstrap.config';
import { hashPassword } from './password-hash';

const adminRoleName = 'ADMIN';

/** Identifies a role that grants the complete V1 global administrator access. */
function isAdminRole(role: typeof roles.$inferSelect): boolean {
  return (
    role.type === 'GLOBAL' &&
    role.permissions.length === 1 &&
    role.permissions[0] === 'ALL'
  );
}

@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  constructor(private readonly database: DatabaseService) {}

  /** Runs the optional development bootstrap after the database module initializes. */
  async onModuleInit(): Promise<void> {
    await this.bootstrap();
  }

  /** Creates the configured admin only when it does not already exist. */
  async bootstrap(): Promise<void> {
    const config = getAdminBootstrapConfig();

    if (!config) {
      return;
    }

    const [existingUser] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, config.username))
      .limit(1);
    const passwordHash = existingUser
      ? undefined
      : await hashPassword(config.password);

    await this.database.transaction(async (tx) => {
      await tx
        .insert(roles)
        .values({
          name: adminRoleName,
          type: 'GLOBAL',
          permissions: ['ALL'],
        })
        .onConflictDoNothing();

      const [adminRole] = await tx
        .select()
        .from(roles)
        .where(eq(roles.name, adminRoleName))
        .limit(1);

      if (!adminRole || !isAdminRole(adminRole)) {
        throw new Error('Existing ADMIN role configuration is invalid');
      }

      const [currentUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, config.username))
        .limit(1);

      if (currentUser) {
        await this.assertUserHasAdminRole(tx, currentUser.id, adminRole.id);
        return;
      }

      const [createdUser] = await tx
        .insert(users)
        .values({
          username: config.username,
          passwordHash: passwordHash!,
        })
        .onConflictDoNothing()
        .returning({ id: users.id });

      if (!createdUser) {
        const [concurrentUser] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, config.username))
          .limit(1);

        if (!concurrentUser) {
          throw new Error('Admin user was not created');
        }

        await this.assertUserHasAdminRole(tx, concurrentUser.id, adminRole.id);
        return;
      }

      await tx.insert(userRoles).values({
        userId: createdUser.id,
        roleId: adminRole.id,
      });
    });
  }

  /** Rejects an existing user that was not previously assigned the ADMIN role. */
  private async assertUserHasAdminRole(
    tx: Parameters<Parameters<DatabaseService['transaction']>[0]>[0],
    userId: string,
    roleId: string,
  ): Promise<void> {
    const [assignment] = await tx
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
      .limit(1);

    if (!assignment) {
      throw new Error('Existing admin user does not have the ADMIN role');
    }
  }
}
