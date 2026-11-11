import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { getJwtConfig } from './jwt.config';
import { browserCookieName, requireBrowserRequest } from './browser-auth';

/** Represents a request after a verified JWT subject has been attached. */
export type AuthenticatedRequest = {
  headers: {
    authorization?: string;
    cookie?: string;
    origin?: string;
    'x-brucke-request'?: string;
  };
  method: string;
  authenticatedUserId?: string;
  authenticatedUser?: { id: string; username: string };
};

type AccessTokenPayload = {
  sub?: unknown;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Validates bearer access tokens and exposes their subject on the request. */
@Injectable()
export class JwtAuthenticationGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  /** Rejects invalid bearer tokens before a protected controller handler runs. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const bearerSupplied = authorization !== undefined;
    const cookie =
      request.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .filter((part) => part.startsWith(`${browserCookieName}=`)) ?? [];
    const token = bearerSupplied
      ? this.extractBearerToken(authorization)
      : cookie.length === 1
        ? cookie[0].slice(browserCookieName.length + 1)
        : null;

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const config = getJwtConfig();
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: config.secret,
          algorithms: ['HS256'],
          issuer: config.issuer,
          audience: config.audience,
        },
      );

      if (typeof payload.sub !== 'string' || !uuidPattern.test(payload.sub)) {
        throw new UnauthorizedException();
      }

      request.authenticatedUserId = payload.sub;
    } catch {
      throw new UnauthorizedException();
    }
    if (
      !bearerSupplied &&
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
    ) {
      requireBrowserRequest(request);
    }
    return true;
  }

  /** Extracts a single bearer token from the request authorization header. */
  private extractBearerToken(value: string | undefined): string | null {
    const match = /^Bearer ([^\s]+)$/.exec(value ?? '');

    return match?.[1] ?? null;
  }
}
