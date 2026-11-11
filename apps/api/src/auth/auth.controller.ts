import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';

import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { type LoginRequest, type LoginResponse, loginSchema } from './auth.dto';
import { AuthService } from './auth.service';
import { Public } from './public-route.decorator';
import {
  browserCookieName,
  browserCookieOptions,
  requireBrowserRequest,
} from './browser-auth';
import type { AuthenticatedRequest } from './jwt-authentication.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Authenticates a username and password and returns a bearer access token. */
  @Post('login')
  @Public()
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginRequest,
  ): Promise<LoginResponse> {
    return this.authService.login(body);
  }

  /** Authenticates a browser and stores its token in an HttpOnly cookie. */
  @Post('browser/login')
  @Public()
  async browserLogin(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Body(new ZodValidationPipe(loginSchema)) body: LoginRequest,
  ) {
    requireBrowserRequest(request);
    const result = await this.authService.authenticate(body);
    response.cookie(browserCookieName, result.accessToken, {
      ...browserCookieOptions(),
      expires: result.expiresAt,
    });
    return result.identity;
  }

  /** Returns the identity authorized by the global ADMIN guard. */
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return request.authenticatedUser!;
  }

  /** Clears the browser cookie without revoking previously issued tokens. */
  @Post('browser/logout')
  @Public()
  browserLogout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    requireBrowserRequest(request);
    response.clearCookie(browserCookieName, browserCookieOptions());
    return { ok: true };
  }
}
