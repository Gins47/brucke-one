import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  emergencyOperations,
  helpRequests,
  helpRequestShelterAssignments,
  shelterActivationAvailability,
  shelterActivations,
  shelters,
} from '../../database/schema';
import type { ShelterAssignmentResponse } from '../help-requests.dto';

@Injectable()
export class ShelterAssignmentService {
  constructor(private readonly database: DatabaseService) {}

  /** Reserves the group's places atomically or replays its existing assignment. */
  async assign(
    operationId: string,
    requestId: string,
    activationId: string,
    userId: string,
  ): Promise<{ created: boolean; assignment: ShelterAssignmentResponse }> {
    return this.database.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(helpRequests)
        .where(
          and(
            eq(helpRequests.id, requestId),
            eq(helpRequests.emergencyOperationId, operationId),
          ),
        )
        .for('update')
        .limit(1);
      if (!request) throw new NotFoundException('Help request not found');

      const [existing] = await tx
        .select({
          assignment: helpRequestShelterAssignments,
          shelterId: shelters.id,
          shelterName: shelters.name,
        })
        .from(helpRequestShelterAssignments)
        .innerJoin(
          shelterActivations,
          eq(
            shelterActivations.id,
            helpRequestShelterAssignments.shelterActivationId,
          ),
        )
        .innerJoin(shelters, eq(shelters.id, shelterActivations.shelterId))
        .where(eq(helpRequestShelterAssignments.helpRequestId, requestId))
        .limit(1);
      if (existing) {
        if (existing.assignment.shelterActivationId !== activationId)
          throw new ConflictException('Help request already has an assignment');
        return {
          created: false,
          assignment: {
            ...existing.assignment,
            shelterId: existing.shelterId,
            shelterName: existing.shelterName,
          },
        };
      }
      if (request.status !== 'PENDING_REVIEW')
        throw new ConflictException('Help request must be pending review');

      const [activation] = await tx
        .select()
        .from(shelterActivations)
        .where(
          and(
            eq(shelterActivations.id, activationId),
            eq(shelterActivations.emergencyOperationId, operationId),
          ),
        )
        .for('update')
        .limit(1);
      if (!activation)
        throw new NotFoundException('Shelter activation not found');
      const [operation] = await tx
        .select()
        .from(emergencyOperations)
        .where(eq(emergencyOperations.id, operationId))
        .for('update')
        .limit(1);
      const [shelter] = await tx
        .select()
        .from(shelters)
        .where(eq(shelters.id, activation.shelterId))
        .for('update')
        .limit(1);
      const [availability] = await tx
        .select()
        .from(shelterActivationAvailability)
        .where(
          eq(shelterActivationAvailability.shelterActivationId, activationId),
        )
        .for('update')
        .limit(1);
      if (
        !operation ||
        !shelter ||
        activation.status !== 'ACTIVE' ||
        operation.status !== 'ACTIVE'
      )
        throw new ConflictException(
          'Shelter activation and emergency operation must be active',
        );
      if (!availability || !availability.acceptingArrivals)
        throw new ConflictException(
          'Shelter is not accepting arrivals or availability is not reported',
        );
      if (
        availability.operationalCapacity > shelter.capacity ||
        availability.operationalCapacity -
          availability.currentOccupancy -
          availability.reservedPlaces <
          request.groupSize
      )
        throw new ConflictException(
          'Shelter capacity is insufficient or inconsistent',
        );

      const [assignment] = await tx
        .insert(helpRequestShelterAssignments)
        .values({
          helpRequestId: request.id,
          emergencyOperationId: operationId,
          shelterActivationId: activationId,
          reservedGroupSize: request.groupSize,
          assignedByUserId: userId,
        })
        .returning();
      await tx
        .update(shelterActivationAvailability)
        .set({
          reservedPlaces: availability.reservedPlaces + request.groupSize,
        })
        .where(
          eq(shelterActivationAvailability.shelterActivationId, activationId),
        );
      await tx
        .update(helpRequests)
        .set({ status: 'RESERVED', updatedAt: new Date() })
        .where(eq(helpRequests.id, requestId));
      return {
        created: true,
        assignment: {
          ...assignment,
          shelterId: shelter.id,
          shelterName: shelter.name,
        },
      };
    });
  }
}
