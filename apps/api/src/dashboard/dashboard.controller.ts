import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { OrganizationDashboardOverviewResponse } from './dashboard.dto';
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
}
