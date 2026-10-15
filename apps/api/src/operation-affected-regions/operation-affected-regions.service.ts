import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  emergencyOperations,
  operationAffectedRegions,
} from '../database/schema';
import type {
  AffectedRegionResponse,
  CreateAffectedRegionRequest,
} from './operation-affected-regions.dto';

type AffectedRegionRow = typeof operationAffectedRegions.$inferSelect;

/** Maps an affected-region row to the response returned by the API. */
function toAffectedRegionResponse(
  row: AffectedRegionRow,
): AffectedRegionResponse {
  return {
    id: row.id,
    emergencyOperationId: row.emergencyOperationId,
    countryCode: row.countryCode,
    regionCode: row.regionCode,
    regionName: row.regionName,
    addedAt: row.addedAt,
    removedAt: row.removedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Checks PostgreSQL error codes on Drizzle errors and their underlying causes. */
function hasPostgresErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const databaseError = error as { code?: unknown; cause?: { code?: unknown } };

  return databaseError.code === code || databaseError.cause?.code === code;
}

@Injectable()
export class OperationAffectedRegionsService {
  constructor(private readonly database: DatabaseService) {}

  /** Adds a current affected region to an existing emergency operation. */
  async create(
    operationId: string,
    input: CreateAffectedRegionRequest,
  ): Promise<AffectedRegionResponse> {
    await this.findOperation(operationId);
    try {
      const [region] = await this.database.db
        .insert(operationAffectedRegions)
        .values({
          ...input,
          emergencyOperationId: operationId,
          addedAt: new Date(),
          removedAt: null,
        })
        .returning();

      return toAffectedRegionResponse(region);
    } catch (error) {
      if (hasPostgresErrorCode(error, '23505')) {
        throw new ConflictException('Affected region is already current');
      }
      if (hasPostgresErrorCode(error, '23503')) {
        throw new NotFoundException('Emergency operation not found');
      }
      throw error;
    }
  }

  /** Returns current affected regions for an existing operation in a stable order. */
  async findAll(operationId: string): Promise<AffectedRegionResponse[]> {
    await this.findOperation(operationId);
    const records = await this.database.db
      .select()
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
      );
    return records.map(toAffectedRegionResponse);
  }

  /** Logically removes a current affected region while retaining its history. */
  async remove(
    operationId: string,
    regionId: string,
  ): Promise<AffectedRegionResponse> {
    const [existing] = await this.database.db
      .select()
      .from(operationAffectedRegions)
      .where(
        and(
          eq(operationAffectedRegions.id, regionId),
          eq(operationAffectedRegions.emergencyOperationId, operationId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Affected region not found');
    }

    const now = new Date();
    const [region] = await this.database.db
      .update(operationAffectedRegions)
      .set({ removedAt: now, updatedAt: now })
      .where(
        and(
          eq(operationAffectedRegions.id, regionId),
          eq(operationAffectedRegions.emergencyOperationId, operationId),
          isNull(operationAffectedRegions.removedAt),
        ),
      )
      .returning();

    if (!region) {
      throw new ConflictException('Affected region was already removed');
    }

    return toAffectedRegionResponse(region);
  }

  /** Ensures the operation exists before its regions are read or changed. */
  private async findOperation(id: string): Promise<void> {
    const [operation] = await this.database.db
      .select({ id: emergencyOperations.id })
      .from(emergencyOperations)
      .where(eq(emergencyOperations.id, id))
      .limit(1);

    if (!operation) {
      throw new NotFoundException('Emergency operation not found');
    }
  }
}
