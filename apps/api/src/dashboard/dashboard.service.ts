import { Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, lt, or } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  emergencyOperations,
  organizations,
  shelterActivations,
  shelters,
} from '../database/schema';
import {
  encodeDashboardOperationCursor,
  type DashboardOperationCardResponse,
  type DashboardOperationsListResponse,
  type DashboardOperationsQuery,
  type OrganizationDashboardOverviewResponse,
} from './dashboard.dto';

type OperationStatus = (typeof emergencyOperations.$inferSelect)['status'];
type OperationStatusCount = { status: OperationStatus; count: number };
type DashboardOperationRow = Pick<
  typeof emergencyOperations.$inferSelect,
  | 'id'
  | 'operationCode'
  | 'name'
  | 'countryCode'
  | 'type'
  | 'severity'
  | 'status'
  | 'startedAt'
  | 'endedAt'
  | 'updatedAt'
>;

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

/** Maps an emergency-operation projection to the compact dashboard card DTO. */
function toOperationCard(
  row: DashboardOperationRow,
): DashboardOperationCardResponse {
  return {
    id: row.id,
    operationCode: row.operationCode,
    name: row.name,
    countryCode: row.countryCode,
    type: row.type,
    severity: row.severity,
    status: row.status,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    updatedAt: row.updatedAt,
  };
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

  /** Returns one organization's operations using stable cursor pagination. */
  async getOrganizationOperations(
    organizationId: string,
    query: DashboardOperationsQuery,
  ): Promise<DashboardOperationsListResponse> {
    await this.findOrganization(organizationId);

    const conditions = [eq(emergencyOperations.organizationId, organizationId)];

    if (query.status) {
      conditions.push(eq(emergencyOperations.status, query.status));
    }

    if (query.cursor) {
      conditions.push(
        or(
          lt(emergencyOperations.updatedAt, query.cursor.updatedAt),
          and(
            eq(emergencyOperations.updatedAt, query.cursor.updatedAt),
            lt(emergencyOperations.id, query.cursor.id),
          ),
        )!,
      );
    }

    const records = await this.database.db
      .select({
        id: emergencyOperations.id,
        operationCode: emergencyOperations.operationCode,
        name: emergencyOperations.name,
        countryCode: emergencyOperations.countryCode,
        type: emergencyOperations.type,
        severity: emergencyOperations.severity,
        status: emergencyOperations.status,
        startedAt: emergencyOperations.startedAt,
        endedAt: emergencyOperations.endedAt,
        updatedAt: emergencyOperations.updatedAt,
      })
      .from(emergencyOperations)
      .where(and(...conditions))
      .orderBy(
        desc(emergencyOperations.updatedAt),
        desc(emergencyOperations.id),
      )
      .limit(query.limit + 1);
    const hasNextPage = records.length > query.limit;
    const pageRecords = records.slice(0, query.limit);
    const finalRecord = pageRecords.at(-1);

    return {
      items: pageRecords.map(toOperationCard),
      nextCursor:
        hasNextPage && finalRecord
          ? encodeDashboardOperationCursor(finalRecord)
          : null,
    };
  }

  /** Finds an organization for a dashboard projection or returns not found. */
  private async findOrganization(organizationId: string): Promise<void> {
    const [organization] = await this.database.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
  }
}
