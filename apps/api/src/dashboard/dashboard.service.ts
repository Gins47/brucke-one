import { Injectable, NotFoundException } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  emergencyOperations,
  organizations,
  shelterActivations,
  shelters,
} from '../database/schema';
import type { OrganizationDashboardOverviewResponse } from './dashboard.dto';

type OperationStatus = (typeof emergencyOperations.$inferSelect)['status'];
type OperationStatusCount = { status: OperationStatus; count: number };

/** Maps grouped operation counts into the overview's complete status shape. */
function toOperationCounts(rows: OperationStatusCount[]) {
  const counts = {
    planned: 0,
    active: 0,
    completed: 0,
    cancelled: 0,
  };

  for (const row of rows) {
    switch (row.status) {
      case 'PLANNED':
        counts.planned = row.count;
        break;
      case 'ACTIVE':
        counts.active = row.count;
        break;
      case 'COMPLETED':
        counts.completed = row.count;
        break;
      case 'CANCELLED':
        counts.cancelled = row.count;
        break;
    }
  }

  return counts;
}

/**
 * Owns cross-domain read projections for the dashboard. Domain modules retain
 * ownership of commands and writes.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}

  /** Returns one organization's dashboard overview using fixed aggregate queries. */
  async getOrganizationOverview(
    organizationId: string,
  ): Promise<OrganizationDashboardOverviewResponse> {
    const [organization] = await this.database.db
      .select({
        id: organizations.id,
        code: organizations.code,
        name: organizations.name,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const [operationStatusCounts, shelterCountResult, activationCountResult] =
      await Promise.all([
        this.database.db
          .select({
            status: emergencyOperations.status,
            count: count(emergencyOperations.id),
          })
          .from(emergencyOperations)
          .where(eq(emergencyOperations.organizationId, organizationId))
          .groupBy(emergencyOperations.status),
        this.database.db
          .select({ count: count(shelters.id) })
          .from(shelters)
          .where(eq(shelters.organizationId, organizationId)),
        this.database.db
          .select({ count: count(shelterActivations.id) })
          .from(shelterActivations)
          .innerJoin(shelters, eq(shelterActivations.shelterId, shelters.id))
          .where(
            and(
              eq(shelters.organizationId, organizationId),
              eq(shelterActivations.status, 'ACTIVE'),
            ),
          ),
      ]);

    return {
      organization,
      operationCounts: toOperationCounts(operationStatusCounts),
      shelterCount: shelterCountResult[0]?.count ?? 0,
      activeShelterActivationCount: activationCountResult[0]?.count ?? 0,
    };
  }
}
