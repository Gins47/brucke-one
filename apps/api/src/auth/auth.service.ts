import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { users } from '../database/schema';
import { normalizeUsername } from './admin-bootstrap.config';
import type { LoginRequest, LoginResponse } from './auth.dto';
import { getJwtConfig } from './jwt.config';
import { verifyPassword } from './password-hash';

const invalidCredentialsMessage = 'Invalid username or password';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  /** Validates JWT configuration during application startup. */
  onModuleInit(): void {
    getJwtConfig();
  }

  /** Authenticates configured credentials and returns a signed access token. */
  async login(input: LoginRequest): Promise<LoginResponse> {
    const username = normalizeUsername(input.username);
    const [user] = await this.database.db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException(invalidCredentialsMessage);
    }

    let passwordMatches = false;
    try {
      passwordMatches = await verifyPassword(input.password, user.passwordHash);
    } catch {
      throw new UnauthorizedException(invalidCredentialsMessage);
    }

    if (!passwordMatches) {
      throw new UnauthorizedException(invalidCredentialsMessage);
    }

    const config = getJwtConfig();
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        secret: config.secret,
        algorithm: 'HS256',
        expiresIn: config.expiresInSeconds,
        issuer: config.issuer,
        audience: config.audience,
      },
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: config.expiresIn,
    };
  }
}
