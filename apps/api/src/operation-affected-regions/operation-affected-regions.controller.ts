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
  createAffectedRegionSchema,
  type AffectedRegionResponse,
  type CreateAffectedRegionRequest,
} from './operation-affected-regions.dto';
import { OperationAffectedRegionsService } from './operation-affected-regions.service';

@Controller('emergency-operations/:operationId/affected-regions')
export class OperationAffectedRegionsController {
  constructor(private readonly service: OperationAffectedRegionsService) {}

  /** Adds an affected region from a validated request body. */
  @Post()
  create(
    @Param('operationId', new ParseUUIDPipe()) operationId: string,
    @Body(new ZodValidationPipe(createAffectedRegionSchema))
    body: CreateAffectedRegionRequest,
  ): Promise<AffectedRegionResponse> {
    return this.service.create(operationId, body);
  }

  /** Lists current affected regions for an operation. */
  @Get()
  findAll(
    @Param('operationId', new ParseUUIDPipe()) operationId: string,
  ): Promise<AffectedRegionResponse[]> {
    return this.service.findAll(operationId);
  }

  /** Logically removes an affected region by its validated identifiers. */
  @Post(':regionId/remove')
  remove(
    @Param('operationId', new ParseUUIDPipe()) operationId: string,
    @Param('regionId', new ParseUUIDPipe()) regionId: string,
  ): Promise<AffectedRegionResponse> {
    return this.service.remove(operationId, regionId);
  }
}
