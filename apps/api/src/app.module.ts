import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EmergencyOperationsModule } from './emergency-operations/emergency-operations.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OperationAffectedRegionsModule } from './operation-affected-regions/operation-affected-regions.module';
import { SheltersModule } from './shelters/shelters.module';
import { ShelterActivationAvailabilityModule } from './shelter-activation-availability/shelter-activation-availability.module';
import { ShelterActivationsModule } from './shelter-activations/shelter-activations.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    DashboardModule,
    OrganizationsModule,
    OperationAffectedRegionsModule,
    EmergencyOperationsModule,
    SheltersModule,
    ShelterActivationsModule,
    ShelterActivationAvailabilityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
