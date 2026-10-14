import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EmergencyOperationsController } from './emergency-operations.controller';
import { EmergencyOperationsService } from './emergency-operations.service';

@Module({
  imports: [DatabaseModule],
  controllers: [EmergencyOperationsController],
  providers: [EmergencyOperationsService],
})
export class EmergencyOperationsModule {}
