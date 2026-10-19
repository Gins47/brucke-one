import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { AdminBootstrapService } from './admin-bootstrap.service';

@Module({
  imports: [DatabaseModule],
  providers: [AdminBootstrapService],
})
export class AuthModule {}
