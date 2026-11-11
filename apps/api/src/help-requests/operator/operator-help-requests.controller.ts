import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../auth/jwt-authentication.guard';

import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import {
  helpRequestQueueQuerySchema,
  type HelpRequestQueueQuery,
  type HelpRequestQueueResponse,
  createShelterAssignmentSchema,
} from '../help-requests.dto';
import { HelpRequestsService } from '../help-requests.service';
import { ShelterAssignmentService } from './shelter-assignment.service';

/** Exposes the protected, operation-scoped queue for ADMIN operators. */
@Controller('emergency-operations/:operationId/help-requests')
export class OperatorHelpRequestsController {
  constructor(
    private readonly service: HelpRequestsService,
    private readonly assignments: ShelterAssignmentService,
  ) {}

  /** Creates an assignment or returns the existing assignment on replay. */
  @Post(':requestId/assignment')
  async assign(
    @Param('operationId', new ParseUUIDPipe()) operationId: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @Body(new ZodValidationPipe(createShelterAssignmentSchema))
    body: { shelterActivationId: string },
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.assignments.assign(
      operationId,
      requestId,
      body.shelterActivationId,
      request.authenticatedUserId!,
    );
    response.status(result.created ? 201 : 200);
    return result.assignment;
  }

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
