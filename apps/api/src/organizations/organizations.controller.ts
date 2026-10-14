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
  createOrganizationSchema,
  type CreateOrganizationRequest,
  type OrganizationResponse,
  updateOrganizationSchema,
  type UpdateOrganizationRequest,
} from './organizations.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /** Creates an organization from a validated request body. */
  @Post()
  create(
    @Body(new ZodValidationPipe(createOrganizationSchema))
    body: CreateOrganizationRequest,
  ): Promise<OrganizationResponse> {
    return this.organizationsService.create(body);
  }

  /** Lists registered organizations. */
  @Get()
  findAll(): Promise<OrganizationResponse[]> {
    return this.organizationsService.findAll();
  }

  /** Retrieves an organization by its validated UUID. */
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrganizationResponse> {
    return this.organizationsService.findOne(id);
  }

  /** Updates only the mutable organization fields supplied in the request body. */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateOrganizationSchema))
    body: UpdateOrganizationRequest,
  ): Promise<OrganizationResponse> {
    return this.organizationsService.update(id, body);
  }
}
