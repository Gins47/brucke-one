import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { HelpRequestsController } from './help-requests.controller';
import { OperatorHelpRequestsController } from './operator/operator-help-requests.controller';
import { PublicHelpRequestStatusController } from './public-help-request-status.controller';
import { HelpRequestsService } from './help-requests.service';
import { ShelterAssignmentService } from './operator/shelter-assignment.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    HelpRequestsController,
    OperatorHelpRequestsController,
    PublicHelpRequestStatusController,
  ],
  providers: [HelpRequestsService, ShelterAssignmentService],
})
export class HelpRequestsModule {}
