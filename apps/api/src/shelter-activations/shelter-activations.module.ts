import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ShelterActivationsController } from './shelter-activations.controller';
import { ShelterActivationsService } from './shelter-activations.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ShelterActivationsController],
  providers: [ShelterActivationsService],
})
export class ShelterActivationsModule {}
