import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { EmergencyOperationsModule } from './emergency-operations/emergency-operations.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { SheltersModule } from './shelters/shelters.module';
import { ShelterActivationsModule } from './shelter-activations/shelter-activations.module';

@Module({
  imports: [
    DatabaseModule,
    OrganizationsModule,
    EmergencyOperationsModule,
    SheltersModule,
    ShelterActivationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
