import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { ShelterActivationAvailabilityController } from './shelter-activation-availability.controller';
import { ShelterActivationAvailabilityService } from './shelter-activation-availability.service';

/** Groups shelter-activation availability reports and their write rules. */
@Module({
  imports: [DatabaseModule],
  controllers: [ShelterActivationAvailabilityController],
  providers: [ShelterActivationAvailabilityService],
})
export class ShelterActivationAvailabilityModule {}
