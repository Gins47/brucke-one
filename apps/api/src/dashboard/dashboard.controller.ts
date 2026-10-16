import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import {
  dashboardOperationsQuerySchema,
  type DashboardOperationsListResponse,
  type DashboardOperationsQuery,
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
}
