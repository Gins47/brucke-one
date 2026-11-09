import { Controller, Get, Param } from '@nestjs/common';

import { Public } from '../auth/public-route.decorator';
import type { PublicHelpRequestStatusResponse } from './help-requests.dto';
import { HelpRequestsService } from './help-requests.service';

@Controller('public/help-requests')
@Public()
export class PublicHelpRequestStatusController {
  constructor(private readonly service: HelpRequestsService) {}

  /** Returns the minimal PoC status for one public short reference. */
  @Get(':shortReference/status')
  findStatus(
    @Param('shortReference') shortReference: string,
  ): Promise<PublicHelpRequestStatusResponse> {
    return this.service.findPublicStatus(shortReference);
  }
}
