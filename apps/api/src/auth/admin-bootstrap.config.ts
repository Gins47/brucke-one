/** Defines the environment values required for an enabled development bootstrap. */
export type AdminBootstrapConfig = {
  username: string;
  password: string;
};

/** Normalizes usernames before database lookup and storage. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Returns bootstrap settings or null when development bootstrap is disabled. */
export function getAdminBootstrapConfig(): AdminBootstrapConfig | null {
  const enabled = process.env.ADMIN_BOOTSTRAP_ENABLED;

  if (enabled === undefined || enabled === 'false') {
    return null;
  }

  if (enabled !== 'true') {
    throw new Error('ADMIN_BOOTSTRAP_ENABLED must be true or false');
  }

  if ((process.env.NODE_ENV ?? 'development') !== 'development') {
    throw new Error('Admin bootstrap can only run in development');
  }

  const username = normalizeUsername(process.env.ADMIN_USERNAME ?? '');
  const password = process.env.ADMIN_PASSWORD;

  if (!username) {
    throw new Error(
      'ADMIN_USERNAME is required when admin bootstrap is enabled',
    );
  }

  if (!password) {
    throw new Error(
      'ADMIN_PASSWORD is required when admin bootstrap is enabled',
    );
  }

  return { username, password };
}
