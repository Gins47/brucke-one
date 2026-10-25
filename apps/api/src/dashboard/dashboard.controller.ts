import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import {
  dashboardOperationsQuerySchema,
  type DashboardOperationsListResponse,
  type DashboardOperationsQuery,
  type DashboardOperationMapResponse,
  type DashboardShelterReadModel,
  type OrganizationDashboardOverviewResponse,
} from './dashboard.dto';
import { DashboardService } from './dashboard.service';

/** Hosts read-only dashboard routes as later checkpoints introduce them. */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  /** Returns the read-only overview projection for one organization. */
  @Get('organizations/:organizationId/overview')
  getOrganizationOverview(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
  ): Promise<OrganizationDashboardOverviewResponse> {
    return this.service.getOrganizationOverview(organizationId);
  }

  /** Returns a cursor-paginated, read-only operation list for one organization. */
  @Get('organizations/:organizationId/operations')
  getOrganizationOperations(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Query(new ZodValidationPipe(dashboardOperationsQuerySchema))
    query: DashboardOperationsQuery,
  ): Promise<DashboardOperationsListResponse> {
    return this.service.getOrganizationOperations(organizationId, query);
  }

  /** Returns the selected organization's shelters and their current active context. */
  @Get('organizations/:organizationId/shelters')
  getOrganizationShelters(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
  ): Promise<DashboardShelterReadModel[]> {
    return this.service.getOrganizationShelters(organizationId);
  }

  /** Returns one selected-organization shelter and its current active context. */
  @Get('organizations/:organizationId/shelters/:shelterId')
  getOrganizationShelter(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('shelterId', new ParseUUIDPipe()) shelterId: string,
  ): Promise<DashboardShelterReadModel> {
    return this.service.getOrganizationShelter(organizationId, shelterId);
  }

  /** Returns the read-only map projection for one emergency operation. */
  @Get('emergency-operations/:operationId/map')
  getEmergencyOperationMap(
    @Param('operationId', new ParseUUIDPipe()) operationId: string,
  ): Promise<DashboardOperationMapResponse> {
    return this.service.getEmergencyOperationMap(operationId);
  }
}
