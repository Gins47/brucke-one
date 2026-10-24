import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import {
  emergencyOperations,
  shelterActivationAvailability,
  shelterActivations,
  shelters,
} from '../database/schema';
import type {
  ReplaceShelterActivationAvailabilityRequest,
  ShelterActivationAvailabilityGetResponse,
  ShelterActivationAvailabilityResponse,
} from './shelter-activation-availability.dto';

type AvailabilityRow = typeof shelterActivationAvailability.$inferSelect;
type ActivationRow = typeof shelterActivations.$inferSelect;
type ShelterRow = typeof shelters.$inferSelect;
type OperationRow = typeof emergencyOperations.$inferSelect;

/** Maps stored availability and its activation context to an API response. */
function toAvailabilityResponse(
  availability: AvailabilityRow,
  activation: ActivationRow,
): ShelterActivationAvailabilityResponse {
  return {
    shelterActivationId: activation.id,
    shelterId: activation.shelterId,
    emergencyOperationId: activation.emergencyOperationId,
    organizationId: activation.organizationId,
    operationalCapacity: availability.operationalCapacity,
    currentOccupancy: availability.currentOccupancy,
    reservedPlaces: availability.reservedPlaces,
    availablePlaces:
      availability.operationalCapacity -
      availability.currentOccupancy -
      availability.reservedPlaces,
    acceptingArrivals: availability.acceptingArrivals,
    availabilityNote: availability.availabilityNote,
    reportedAt: availability.reportedAt,
    createdAt: availability.createdAt,
    updatedAt: availability.updatedAt,
  };
}

@Injectable()
export class ShelterActivationAvailabilityService {
  constructor(private readonly database: DatabaseService) {}

  /** Returns a report or explicitly indicates that an existing activation has none. */
  async findOne(
    activationId: string,
  ): Promise<ShelterActivationAvailabilityGetResponse> {
    const [activation] = await this.database.db
      .select()
      .from(shelterActivations)
      .where(eq(shelterActivations.id, activationId))
      .limit(1);

    if (!activation) {
      throw new NotFoundException('Shelter activation not found');
    }

    const [availability] = await this.database.db
      .select()
      .from(shelterActivationAvailability)
      .where(
        eq(shelterActivationAvailability.shelterActivationId, activationId),
      )
      .limit(1);

    if (!availability) {
      return { shelterActivationId: activation.id, availability: null };
    }

    return toAvailabilityResponse(availability, activation);
  }

  /** Creates or replaces an availability report while its active parents are locked. */
  async replace(
    activationId: string,
    input: ReplaceShelterActivationAvailabilityRequest,
  ): Promise<ShelterActivationAvailabilityResponse> {
    return this.database.transaction(async (tx) => {
      // The activation and operation locks serialize this write with deactivation
      // and terminal-operation updates before the snapshot can be persisted.
      const activation = await this.findActivationForUpdate(tx, activationId);
      const operation = await this.findOperationForUpdate(
        tx,
        activation.emergencyOperationId,
      );
      const shelter = await this.findShelterForUpdate(tx, activation.shelterId);

      if (activation.status !== 'ACTIVE' || operation.status !== 'ACTIVE') {
        throw new ConflictException(
          'Shelter activation and emergency operation must be active',
        );
      }

      if (input.operationalCapacity > shelter.capacity) {
        throw new ConflictException(
          'Operational capacity cannot exceed the shelter capacity',
        );
      }

      const [existing] = await tx
        .select()
        .from(shelterActivationAvailability)
        .where(
          eq(shelterActivationAvailability.shelterActivationId, activation.id),
        )
        .for('update')
        .limit(1);
      const now = new Date();
      const values = {
        ...input,
        availabilityNote: input.availabilityNote ?? null,
        reportedAt: now,
        updatedAt: now,
      };
      const [availability] = existing
        ? await tx
            .update(shelterActivationAvailability)
            .set(values)
            .where(
              eq(
                shelterActivationAvailability.shelterActivationId,
                activation.id,
              ),
            )
            .returning()
        : await tx
            .insert(shelterActivationAvailability)
            .values({ shelterActivationId: activation.id, ...values })
            .returning();

      return toAvailabilityResponse(availability, activation);
    });
  }

  /** Locks and loads the activation that owns the availability snapshot. */
  private async findActivationForUpdate(
    tx: Parameters<Parameters<DatabaseService['transaction']>[0]>[0],
    activationId: string,
  ): Promise<ActivationRow> {
    const [activation] = await tx
      .select()
      .from(shelterActivations)
      .where(eq(shelterActivations.id, activationId))
      .for('update')
      .limit(1);

    if (!activation) {
      throw new NotFoundException('Shelter activation not found');
    }

    return activation;
  }

  /** Locks and loads the operation whose lifecycle permits availability updates. */
  private async findOperationForUpdate(
    tx: Parameters<Parameters<DatabaseService['transaction']>[0]>[0],
    operationId: string,
  ): Promise<OperationRow> {
    const [operation] = await tx
      .select()
      .from(emergencyOperations)
      .where(eq(emergencyOperations.id, operationId))
      .for('update')
      .limit(1);

    if (!operation) {
      throw new ConflictException('Emergency operation state changed; retry');
    }

    return operation;
  }

  /** Locks and loads the shelter whose physical capacity bounds this report. */
  private async findShelterForUpdate(
    tx: Parameters<Parameters<DatabaseService['transaction']>[0]>[0],
    shelterId: string,
  ): Promise<ShelterRow> {
    const [shelter] = await tx
      .select()
      .from(shelters)
      .where(eq(shelters.id, shelterId))
      .for('update')
      .limit(1);

    if (!shelter) {
      throw new ConflictException('Shelter state changed; retry');
    }

    return shelter;
  }
}
