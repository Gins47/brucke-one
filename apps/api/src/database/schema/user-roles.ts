import { foreignKey, pgTable, unique, uuid } from 'drizzle-orm/pg-core';

import { roles } from './roles';
import { users } from './users';

export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    roleId: uuid('role_id').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'user_roles_user_id_users_id_fk',
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'user_roles_role_id_roles_id_fk',
      columns: [table.roleId],
      foreignColumns: [roles.id],
    }).onDelete('restrict'),
    unique('user_roles_user_role_unique').on(table.userId, table.roleId),
  ],
);
