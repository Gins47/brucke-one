import { randomBytes } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import {
  emergencyOperations,
  helpRequests,
  operationAffectedRegions,
} from '../database/schema';
import type {
  CreatePublicHelpRequestRequest,
  PublicEmergencyOperationResponse,
  PublicHelpRequestAcknowledgement,
} from './help-requests.dto';

/** Checks PostgreSQL error codes on Drizzle errors and their underlying causes. */
function hasPostgresErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const databaseError = error as {
    code?: unknown;
    cause?: { code?: unknown };
  };

  return databaseError.code === code || databaseError.cause?.code === code;
}

/** Generates an opaque 144-bit value for a stored or acknowledgement reference. */
function createOpaqueReference(): string {
  return randomBytes(18).toString('base64url');
}

/** Builds the deliberately generic acknowledgement returned for accepted submissions. */
function toAcknowledgement(
  acknowledgementReference: string,
  acknowledgedAt: Date,
): PublicHelpRequestAcknowledgement {
  return {
    acknowledgementReference,
    status: 'PENDING_REVIEW',
    acknowledgedAt,
    message: 'Your request has been received. Emergency staff will review it.',
  };
}

@Injectable()
export class HelpRequestsService {
  constructor(private readonly database: DatabaseService) {}

  /** Lists active operations and their current affected regions without internal fields. */
  async findActiveOperations(
    countryCode: string,
  ): Promise<PublicEmergencyOperationResponse[]> {
    const operations = await this.database.db
      .select({
        id: emergencyOperations.id,
        operationCode: emergencyOperations.operationCode,
        name: emergencyOperations.name,
        countryCode: emergencyOperations.countryCode,
      })
      .from(emergencyOperations)
      .where(
        and(
          eq(emergencyOperations.countryCode, countryCode),
          eq(emergencyOperations.status, 'ACTIVE'),
        ),
      )
      .orderBy(
        asc(emergencyOperations.operationCode),
        asc(emergencyOperations.id),
      );

    if (operations.length === 0) {
      return [];
    }

    const regions = await this.database.db
      .select({
        emergencyOperationId: operationAffectedRegions.emergencyOperationId,
        countryCode: operationAffectedRegions.countryCode,
        regionCode: operationAffectedRegions.regionCode,
        regionName: operationAffectedRegions.regionName,
      })
      .from(operationAffectedRegions)
      .where(
        and(
          inArray(
            operationAffectedRegions.emergencyOperationId,
            operations.map((operation) => operation.id),
          ),
          isNull(operationAffectedRegions.removedAt),
        ),
      )
      .orderBy(
        asc(operationAffectedRegions.countryCode),
        asc(operationAffectedRegions.regionCode),
        asc(operationAffectedRegions.id),
      );
    const regionsByOperation = new Map<
      string,
      PublicEmergencyOperationResponse['affectedRegions']
    >();

    for (const region of regions) {
      const operationRegions = regionsByOperation.get(
        region.emergencyOperationId,
      );
      const publicRegion = {
        countryCode: region.countryCode,
        regionCode: region.regionCode,
        regionName: region.regionName,
      };

      if (operationRegions) {
        operationRegions.push(publicRegion);
      } else {
        regionsByOperation.set(region.emergencyOperationId, [publicRegion]);
      }
    }

    return operations.map((operation) => ({
      ...operation,
      affectedRegions: regionsByOperation.get(operation.id) ?? [],
    }));
  }

  /** Persists an active-country request or returns the same acknowledgement for duplicates. */
  async createPublicRequest(
    countryCode: string,
    input: CreatePublicHelpRequestRequest,
  ): Promise<PublicHelpRequestAcknowledgement> {
    const publicReference = createOpaqueReference();
    const acknowledgementReference = createOpaqueReference();
    const acknowledgedAt = new Date();

    try {
      return await this.database.transaction(async (tx) => {
        const [operation] = await tx
          .select({ id: emergencyOperations.id })
          .from(emergencyOperations)
          .where(
            and(
              eq(emergencyOperations.id, input.emergencyOperationId),
              eq(emergencyOperations.countryCode, countryCode),
              eq(emergencyOperations.status, 'ACTIVE'),
            ),
          )
          .for('update')
          .limit(1);

        if (!operation) {
          throw new NotFoundException('Emergency operation not found');
        }

        await tx.insert(helpRequests).values({
          ...input,
          publicReference,
          status: 'PENDING_REVIEW',
        });

        return toAcknowledgement(acknowledgementReference, acknowledgedAt);
      });
    } catch (error) {
      if (hasPostgresErrorCode(error, '23505')) {
        return toAcknowledgement(acknowledgementReference, acknowledgedAt);
      }

      throw error;
    }
  }
}
