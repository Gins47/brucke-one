import { SetMetadata } from '@nestjs/common';

export const isPublicRouteKey = 'isPublicRoute';

/** Marks an endpoint as intentionally accessible without authentication. */
export const Public = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(isPublicRouteKey, true);
