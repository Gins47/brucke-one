import { Injectable } from '@nestjs/common';

/**
 * Owns cross-domain read projections for the dashboard. Domain modules retain
 * ownership of commands and writes.
 */
@Injectable()
export class DashboardService {}
