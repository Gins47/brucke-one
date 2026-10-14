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
  createEmergencyOperationSchema,
  type CreateEmergencyOperationRequest,
  type EmergencyOperationResponse,
  updateEmergencyOperationSchema,
  type UpdateEmergencyOperationRequest,
} from './emergency-operations.dto';
import { EmergencyOperationsService } from './emergency-operations.service';

@Controller('emergency-operations')
export class EmergencyOperationsController {
  constructor(
    private readonly emergencyOperationsService: EmergencyOperationsService,
  ) {}

  /** Creates a planned emergency operation from a validated request body. */
  @Post()
  create(
    @Body(new ZodValidationPipe(createEmergencyOperationSchema))
    body: CreateEmergencyOperationRequest,
  ): Promise<EmergencyOperationResponse> {
    return this.emergencyOperationsService.create(body);
  }

  /** Lists emergency operations. */
  @Get()
  findAll(): Promise<EmergencyOperationResponse[]> {
    return this.emergencyOperationsService.findAll();
  }

  /** Retrieves one emergency operation by its validated UUID. */
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<EmergencyOperationResponse> {
    return this.emergencyOperationsService.findOne(id);
  }

  /** Updates only mutable details of an emergency operation. */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateEmergencyOperationSchema))
    body: UpdateEmergencyOperationRequest,
  ): Promise<EmergencyOperationResponse> {
    return this.emergencyOperationsService.update(id, body);
  }

  /** Activates a planned emergency operation. */
  @Post(':id/activate')
  activate(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<EmergencyOperationResponse> {
    return this.emergencyOperationsService.activate(id);
  }

  /** Completes an active emergency operation. */
  @Post(':id/complete')
  complete(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<EmergencyOperationResponse> {
    return this.emergencyOperationsService.complete(id);
  }

  /** Cancels a planned or active emergency operation. */
  @Post(':id/cancel')
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<EmergencyOperationResponse> {
    return this.emergencyOperationsService.cancel(id);
  }
}
