import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import {
  createShelterActivationSchema,
  type CreateShelterActivationRequest,
  type ShelterActivationResponse,
} from './shelter-activations.dto';
import { ShelterActivationsService } from './shelter-activations.service';

@Controller('shelter-activations')
export class ShelterActivationsController {
  constructor(
    private readonly shelterActivationsService: ShelterActivationsService,
  ) {}

  /** Activates a shelter from a validated request body. */
  @Post()
  create(
    @Body(new ZodValidationPipe(createShelterActivationSchema))
    body: CreateShelterActivationRequest,
  ): Promise<ShelterActivationResponse> {
    return this.shelterActivationsService.create(body);
  }

  /** Lists the shelter-activation history. */
  @Get()
  findAll(): Promise<ShelterActivationResponse[]> {
    return this.shelterActivationsService.findAll();
  }

  /** Retrieves one shelter activation by its validated UUID. */
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ShelterActivationResponse> {
    return this.shelterActivationsService.findOne(id);
  }

  /** Deactivates an active shelter activation while retaining its history. */
  @Post(':id/deactivate')
  deactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ShelterActivationResponse> {
    return this.shelterActivationsService.deactivate(id);
  }
}
