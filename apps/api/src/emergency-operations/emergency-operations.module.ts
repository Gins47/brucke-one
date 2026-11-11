import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EmergencyOperationsController } from './emergency-operations.controller';
import { EmergencyOperationsService } from './emergency-operations.service';
import { OperationAffectedRegionsController } from './affected-regions/operation-affected-regions.controller';
import { OperationAffectedRegionsService } from './affected-regions/operation-affected-regions.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    EmergencyOperationsController,
    OperationAffectedRegionsController,
  ],
  providers: [EmergencyOperationsService, OperationAffectedRegionsService],
})
export class EmergencyOperationsModule {}
