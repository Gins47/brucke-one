import { Body, Controller, Post } from '@nestjs/common';

import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { type LoginRequest, type LoginResponse, loginSchema } from './auth.dto';
import { AuthService } from './auth.service';
import { Public } from './public-route.decorator';

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
}
