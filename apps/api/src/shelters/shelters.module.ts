import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SheltersController } from './shelters.controller';
import { SheltersService } from './shelters.service';
import { ShelterActivationsController } from './activations/shelter-activations.controller';
import { ShelterActivationsService } from './activations/shelter-activations.service';
import { ShelterActivationAvailabilityController } from './availability/shelter-activation-availability.controller';
import { ShelterActivationAvailabilityService } from './availability/shelter-activation-availability.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    SheltersController,
    ShelterActivationsController,
    ShelterActivationAvailabilityController,
  ],
  providers: [
    SheltersService,
    ShelterActivationsService,
    ShelterActivationAvailabilityService,
  ],
})
export class SheltersModule {}
