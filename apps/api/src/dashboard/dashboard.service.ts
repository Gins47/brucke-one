import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, isNull, lt, or } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  emergencyOperations,
  operationAffectedRegions,
  organizations,
  shelterActivationAvailability,
  shelterActivations,
  shelters,
} from '../database/schema';
import {
  encodeDashboardOperationCursor,
  type DashboardOperationCardResponse,
  type DashboardOperationMapResponse,
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
type DashboardMapOperationRow = Pick<
  typeof emergencyOperations.$inferSelect,
  | 'id'
  | 'organizationId'
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

/** Maps an emergency-operation row to the map projection's operation summary. */
function toMapOperation(
  row: DashboardMapOperationRow,
): DashboardOperationMapResponse['operation'] {
  return {
    id: row.id,
    organizationId: row.organizationId,
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

  /** Returns current regions and availability for every active shelter in one operation. */
  async getEmergencyOperationMap(
    operationId: string,
  ): Promise<DashboardOperationMapResponse> {
    const operation = await this.findOperationForMap(operationId);
    const [affectedRegions, activeShelterRows] = await Promise.all([
      this.database.db
        .select({
          id: operationAffectedRegions.id,
          countryCode: operationAffectedRegions.countryCode,
          regionCode: operationAffectedRegions.regionCode,
          regionName: operationAffectedRegions.regionName,
          addedAt: operationAffectedRegions.addedAt,
        })
        .from(operationAffectedRegions)
        .where(
          and(
            eq(operationAffectedRegions.emergencyOperationId, operationId),
            isNull(operationAffectedRegions.removedAt),
          ),
        )
        .orderBy(
          asc(operationAffectedRegions.countryCode),
          asc(operationAffectedRegions.regionCode),
          asc(operationAffectedRegions.id),
        ),
      this.database.db
        .select({
          shelterId: shelters.id,
          shelterCode: shelters.shelterCode,
          name: shelters.name,
          address: shelters.address,
          countryCode: shelters.countryCode,
          latitude: shelters.latitude,
          longitude: shelters.longitude,
          capacity: shelters.capacity,
          contactEmail: shelters.contactEmail,
          contactPhone: shelters.contactPhone,
          activatedAt: shelterActivations.activatedAt,
          shelterActivationId: shelterActivations.id,
          operationalCapacity:
            shelterActivationAvailability.operationalCapacity,
          currentOccupancy: shelterActivationAvailability.currentOccupancy,
          reservedPlaces: shelterActivationAvailability.reservedPlaces,
          acceptingArrivals: shelterActivationAvailability.acceptingArrivals,
          availabilityNote: shelterActivationAvailability.availabilityNote,
          reportedAt: shelterActivationAvailability.reportedAt,
        })
        .from(shelterActivations)
        .innerJoin(shelters, eq(shelterActivations.shelterId, shelters.id))
        .leftJoin(
          shelterActivationAvailability,
          eq(
            shelterActivationAvailability.shelterActivationId,
            shelterActivations.id,
          ),
        )
        .where(
          and(
            eq(shelterActivations.emergencyOperationId, operationId),
            eq(shelterActivations.status, 'ACTIVE'),
          ),
        )
        .orderBy(asc(shelters.shelterCode), asc(shelters.id)),
    ]);
    const activeShelterAvailability: DashboardOperationMapResponse['activeShelterAvailability'] =
      activeShelterRows.map((shelter) => {
        const shelterProjection = {
          shelterActivationId: shelter.shelterActivationId,
          shelterId: shelter.shelterId,
          shelterCode: shelter.shelterCode,
          name: shelter.name,
          address: shelter.address,
          countryCode: shelter.countryCode,
          latitude: shelter.latitude,
          longitude: shelter.longitude,
          capacity: shelter.capacity,
          contactEmail: shelter.contactEmail,
          contactPhone: shelter.contactPhone,
          activatedAt: shelter.activatedAt,
        };

        if (shelter.operationalCapacity === null) {
          return { ...shelterProjection, availability: null };
        }

        const operationalCapacity = shelter.operationalCapacity;

        return {
          ...shelterProjection,
          availability: {
            operationalCapacity,
            currentOccupancy: shelter.currentOccupancy!,
            reservedPlaces: shelter.reservedPlaces!,
            availablePlaces:
              operationalCapacity -
              shelter.currentOccupancy! -
              shelter.reservedPlaces!,
            acceptingArrivals: shelter.acceptingArrivals!,
            availabilityNote: shelter.availabilityNote,
            reportedAt: shelter.reportedAt!,
          },
        };
      });
    let availabilityReportedShelterCount = 0;
    let reportedOperationalCapacity = 0;
    let reportedCurrentOccupancy = 0;
    let reportedReservedPlaces = 0;
    let reportedAvailablePlaces = 0;
    let acceptingArrivalsShelterCount = 0;

    for (const shelter of activeShelterAvailability) {
      if (!shelter.availability) {
        continue;
      }

      availabilityReportedShelterCount += 1;
      reportedOperationalCapacity += shelter.availability.operationalCapacity;
      reportedCurrentOccupancy += shelter.availability.currentOccupancy;
      reportedReservedPlaces += shelter.availability.reservedPlaces;
      reportedAvailablePlaces += shelter.availability.availablePlaces;
      acceptingArrivalsShelterCount += shelter.availability.acceptingArrivals
        ? 1
        : 0;
    }
    const activeShelters = activeShelterAvailability.flatMap((shelter) => {
      if (shelter.latitude === null || shelter.longitude === null) {
        return [];
      }

      return [
        {
          ...shelter,
          latitude: shelter.latitude,
          longitude: shelter.longitude,
        },
      ];
    });
    const availabilitySummary = {
      activeShelterCount: activeShelterAvailability.length,
      availabilityReportedShelterCount,
      availabilityNotReportedShelterCount:
        activeShelterAvailability.length - availabilityReportedShelterCount,
      reportedOperationalCapacity,
      reportedCurrentOccupancy,
      reportedReservedPlaces,
      reportedAvailablePlaces,
      acceptingArrivalsShelterCount,
    };

    return {
      operation: toMapOperation(operation),
      affectedRegions,
      activeShelters,
      activeShelterAvailability,
      mappedActiveShelterCount: activeShelters.length,
      unmappedActiveShelterCount:
        activeShelterAvailability.length - activeShelters.length,
      availabilitySummary,
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

  /** Finds an operation for the map projection or returns not found. */
  private async findOperationForMap(
    operationId: string,
  ): Promise<DashboardMapOperationRow> {
    const [operation] = await this.database.db
      .select({
        id: emergencyOperations.id,
        organizationId: emergencyOperations.organizationId,
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
      .where(eq(emergencyOperations.id, operationId))
      .limit(1);

    if (!operation) {
      throw new NotFoundException('Emergency operation not found');
    }

    return operation;
  }
}
