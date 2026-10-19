import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../database/database.module';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { AdminAuthorizationGuard } from './admin-authorization.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthenticationGuard } from './jwt-authentication.guard';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AdminBootstrapService,
    AuthService,
    JwtAuthenticationGuard,
    AdminAuthorizationGuard,
    {
      provide: APP_GUARD,
      useExisting: AdminAuthorizationGuard,
    },
  ],
  exports: [JwtAuthenticationGuard, JwtModule],
})
export class AuthModule {}
