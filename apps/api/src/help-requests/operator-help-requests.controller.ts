import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import {
  helpRequestQueueQuerySchema,
  type HelpRequestQueueQuery,
  type HelpRequestQueueResponse,
} from './help-requests.dto';
import { HelpRequestsService } from './help-requests.service';

/** Exposes the protected, operation-scoped queue for ADMIN operators. */
@Controller('emergency-operations/:operationId/help-requests')
export class OperatorHelpRequestsController {
  constructor(private readonly service: HelpRequestsService) {}

  /** Returns one operation's stable, cursor-paginated help-request queue. */
  @Get()
  findQueue(
    @Param('operationId', new ParseUUIDPipe()) operationId: string,
    @Query(new ZodValidationPipe(helpRequestQueueQuerySchema))
    query: HelpRequestQueueQuery,
  ): Promise<HelpRequestQueueResponse> {
    return this.service.findOperatorQueue(operationId, query);
  }
}
