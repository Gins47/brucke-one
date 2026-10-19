import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { roles, userRoles, users } from '../database/schema';
import {
  JwtAuthenticationGuard,
  type AuthenticatedRequest,
} from './jwt-authentication.guard';
import { isPublicRouteKey } from './public-route.decorator';

const adminRoleName = 'ADMIN';

/** Requires a valid token and a current ADMIN database assignment for API routes. */
@Injectable()
export class AdminAuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtAuthenticationGuard: JwtAuthenticationGuard,
    private readonly database: DatabaseService,
  ) {}

  /** Allows explicit public endpoints or confirms the caller still has ADMIN. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      isPublicRouteKey,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    await this.jwtAuthenticationGuard.canActivate(context);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const hasAdminRole = await this.hasCurrentAdminRole(
      request.authenticatedUserId!,
    );

    if (!hasAdminRole) {
      throw new ForbiddenException();
    }

    return true;
  }

  /** Checks the current user-role relationship instead of trusting a token role claim. */
  private async hasCurrentAdminRole(userId: string): Promise<boolean> {
    const [assignment] = await this.database.db
      .select({ id: userRoles.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(users.id, userId), eq(roles.name, adminRoleName)))
      .limit(1);

    return Boolean(assignment);
  }
}
