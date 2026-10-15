import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SheltersController } from './shelters.controller';
import { SheltersService } from './shelters.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SheltersController],
  providers: [SheltersService],
})
export class SheltersModule {}
