import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';

import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import {
  replaceShelterActivationAvailabilitySchema,
  type ReplaceShelterActivationAvailabilityRequest,
  type ShelterActivationAvailabilityGetResponse,
  type ShelterActivationAvailabilityResponse,
} from './shelter-activation-availability.dto';
import { ShelterActivationAvailabilityService } from './shelter-activation-availability.service';

@Controller('shelter-activations/:activationId/availability')
export class ShelterActivationAvailabilityController {
  constructor(private readonly service: ShelterActivationAvailabilityService) {}

  /** Returns the current report or an explicit not-reported result. */
  @Get()
  findOne(
    @Param('activationId', new ParseUUIDPipe()) activationId: string,
  ): Promise<ShelterActivationAvailabilityGetResponse> {
    return this.service.findOne(activationId);
  }

  /** Replaces the complete current availability report for an active activation. */
  @Put()
  replace(
    @Param('activationId', new ParseUUIDPipe()) activationId: string,
    @Body(new ZodValidationPipe(replaceShelterActivationAvailabilitySchema))
    body: ReplaceShelterActivationAvailabilityRequest,
  ): Promise<ShelterActivationAvailabilityResponse> {
    return this.service.replace(activationId, body);
  }
}
