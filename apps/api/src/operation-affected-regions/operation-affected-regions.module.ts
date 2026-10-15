import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OperationAffectedRegionsController } from './operation-affected-regions.controller';
import { OperationAffectedRegionsService } from './operation-affected-regions.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OperationAffectedRegionsController],
  providers: [OperationAffectedRegionsService],
})
export class OperationAffectedRegionsModule {}
