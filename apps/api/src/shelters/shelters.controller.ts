import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import {
  createShelterSchema,
  type CreateShelterRequest,
  type ShelterResponse,
  updateShelterSchema,
  type UpdateShelterRequest,
} from './shelters.dto';
import { SheltersService } from './shelters.service';

@Controller('shelters')
export class SheltersController {
  constructor(private readonly sheltersService: SheltersService) {}

  /** Creates a shelter from a validated request body. */
  @Post()
  create(
    @Body(new ZodValidationPipe(createShelterSchema))
    body: CreateShelterRequest,
  ): Promise<ShelterResponse> {
    return this.sheltersService.create(body);
  }

  /** Lists shelters. */
  @Get()
  findAll(): Promise<ShelterResponse[]> {
    return this.sheltersService.findAll();
  }

  /** Retrieves one shelter by its validated UUID. */
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ShelterResponse> {
    return this.sheltersService.findOne(id);
  }

  /** Updates only the mutable shelter fields supplied in the request body. */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateShelterSchema))
    body: UpdateShelterRequest,
  ): Promise<ShelterResponse> {
    return this.sheltersService.update(id, body);
  }
}
