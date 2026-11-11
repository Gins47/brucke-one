import { ForbiddenException } from '@nestjs/common';
import type { CookieOptions } from 'express';

export const browserCookieName = 'brucke_admin';

/** Requires the configured frontend origin and a non-simple browser header. */
export function requireBrowserRequest(request: {
  headers: { origin?: string; 'x-brucke-request'?: string };
}): void {
  const origin =
    process.env.WEB_ORIGIN ??
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3001'
      : undefined);
  if (
    !origin ||
    request.headers.origin !== origin ||
    request.headers['x-brucke-request'] !== '1'
  ) {
    throw new ForbiddenException();
  }
}

/** Restricts insecure cookies to the documented localhost development setup. */
export function browserCookieOptions(): CookieOptions {
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3001';
  const localDevelopment =
    process.env.NODE_ENV === 'development' &&
    origin === 'http://localhost:3001';
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: !localDevelopment,
  };
}
