import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { HelpRequestsController } from './help-requests.controller';
import { OperatorHelpRequestsController } from './operator-help-requests.controller';
import { PublicHelpRequestStatusController } from './public-help-request-status.controller';
import { HelpRequestsService } from './help-requests.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    HelpRequestsController,
    OperatorHelpRequestsController,
    PublicHelpRequestStatusController,
  ],
  providers: [HelpRequestsService],
})
export class HelpRequestsModule {}
