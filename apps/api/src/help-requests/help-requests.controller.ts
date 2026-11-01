import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';

import { Public } from '../auth/public-route.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import {
  countryCodeSchema,
  createPublicHelpRequestSchema,
  idempotencyKeySchema,
  type CreatePublicHelpRequestRequest,
  type PublicEmergencyOperationResponse,
  type PublicHelpRequestAcknowledgement,
} from './help-requests.dto';
import { HelpRequestsService } from './help-requests.service';

const idempotencyKeyValidationPipe = new ZodValidationPipe(
  idempotencyKeySchema,
);

@Controller('public/countries/:countryCode')
@Public()
export class HelpRequestsController {
  constructor(private readonly service: HelpRequestsService) {}

  /** Lists public-safe active operations for one normalized country code. */
  @Get('emergency-operations')
  findActiveOperations(
    @Param('countryCode', new ZodValidationPipe(countryCodeSchema))
    countryCode: string,
  ): Promise<PublicEmergencyOperationResponse[]> {
    return this.service.findActiveOperations(countryCode);
  }

  /** Records a validated public help request for an active country operation. */
  @Post('help-requests')
  create(
    @Param('countryCode', new ZodValidationPipe(countryCodeSchema))
    countryCode: string,
    @Body(new ZodValidationPipe(createPublicHelpRequestSchema))
    body: CreatePublicHelpRequestRequest,
    @Headers('idempotency-key') rawIdempotencyKey: unknown,
  ): Promise<PublicHelpRequestAcknowledgement> {
    const idempotencyKey = idempotencyKeyValidationPipe.transform(
      rawIdempotencyKey,
    ) as string;

    return this.service.createPublicRequest(countryCode, body, idempotencyKey);
  }
}
