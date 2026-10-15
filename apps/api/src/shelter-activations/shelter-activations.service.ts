import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  emergencyOperations,
  shelterActivations,
  shelters,
} from '../database/schema';
import type {
  CreateShelterActivationRequest,
  ShelterActivationResponse,
} from './shelter-activations.dto';

type ShelterActivationRow = typeof shelterActivations.$inferSelect;
type ShelterRow = typeof shelters.$inferSelect;

/** Maps a shelter-activation row to the response returned by the API. */
function toShelterActivationResponse(
  row: ShelterActivationRow,
): ShelterActivationResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    shelterId: row.shelterId,
    emergencyOperationId: row.emergencyOperationId,
    status: row.status,
    activatedAt: row.activatedAt,
    deactivatedAt: row.deactivatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

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

@Injectable()
export class ShelterActivationsService {
  constructor(private readonly database: DatabaseService) {}

  /** Activates a shelter for an active operation in the shelter's organization. */
  async create(
    input: CreateShelterActivationRequest,
  ): Promise<ShelterActivationResponse> {
    try {
      return await this.database.transaction(async (tx) => {
        const [operation] = await tx
          .select()
          .from(emergencyOperations)
          .where(eq(emergencyOperations.id, input.emergencyOperationId))
          .for('update')
          .limit(1);

        if (!operation) {
          throw new NotFoundException('Emergency operation not found');
        }

        if (operation.status !== 'ACTIVE') {
          throw new ConflictException('Emergency operation must be active');
        }

        const [shelter] = await tx
          .select()
          .from(shelters)
          .where(eq(shelters.id, input.shelterId))
          .limit(1);

        if (!shelter) {
          throw new NotFoundException('Shelter not found');
        }

        if (shelter.organizationId !== operation.organizationId) {
          throw new ConflictException(
            'Shelter and emergency operation must belong to the same organization',
          );
        }

        const [activation] = await tx
          .insert(shelterActivations)
          .values({
            organizationId: shelter.organizationId,
            shelterId: shelter.id,
            emergencyOperationId: operation.id,
            status: 'ACTIVE',
            activatedAt: new Date(),
          })
          .returning();

        return toShelterActivationResponse(activation);
      });
    } catch (error) {
      if (hasPostgresErrorCode(error, '23505')) {
        throw new ConflictException('Shelter already has an active activation');
      }

      if (hasPostgresErrorCode(error, '23503')) {
        throw new NotFoundException('Shelter or emergency operation not found');
      }

      throw error;
    }
  }

  /** Returns the complete shelter-activation history. */
  async findAll(): Promise<ShelterActivationResponse[]> {
    const records = await this.database.db.select().from(shelterActivations);

    return records.map(toShelterActivationResponse);
  }

  /** Returns one shelter activation or a not-found response. */
  async findOne(id: string): Promise<ShelterActivationResponse> {
    const activation = await this.findActivationRecord(id);

    return toShelterActivationResponse(activation);
  }

  /** Deactivates an active activation without deleting its historical record. */
  async deactivate(id: string): Promise<ShelterActivationResponse> {
    const current = await this.findActivationRecord(id);

    if (current.status !== 'ACTIVE') {
      throw new ConflictException('Shelter activation is not active');
    }

    const now = new Date();
    const [activation] = await this.database.db
      .update(shelterActivations)
      .set({
        status: 'DEACTIVATED',
        deactivatedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(shelterActivations.id, id),
          eq(shelterActivations.status, 'ACTIVE'),
        ),
      )
      .returning();

    if (!activation) {
      throw new ConflictException('Shelter activation status changed; retry');
    }

    return toShelterActivationResponse(activation);
  }

  /** Loads a shelter record required to derive the activation organization. */
  private async findShelterRecord(id: string): Promise<ShelterRow> {
    const [shelter] = await this.database.db
      .select()
      .from(shelters)
      .where(eq(shelters.id, id))
      .limit(1);

    if (!shelter) {
      throw new NotFoundException('Shelter not found');
    }

    return shelter;
  }

  /** Loads one activation row for retrieval and deactivation checks. */
  private async findActivationRecord(
    id: string,
  ): Promise<ShelterActivationRow> {
    const [activation] = await this.database.db
      .select()
      .from(shelterActivations)
      .where(eq(shelterActivations.id, id))
      .limit(1);

    if (!activation) {
      throw new NotFoundException('Shelter activation not found');
    }

    return activation;
  }
}
