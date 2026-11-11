import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EmergencyOperationsModule } from './emergency-operations/emergency-operations.module';
import { HelpRequestsModule } from './help-requests/help-requests.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OutboxPublisherModule } from './outbox-publisher/outbox-publisher.module';
import { SheltersModule } from './shelters/shelters.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    DashboardModule,
    OrganizationsModule,
    EmergencyOperationsModule,
    HelpRequestsModule,
    OutboxPublisherModule,
    SheltersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
