import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { emergencyOperations } from '../database/schema';
import type {
  CreateEmergencyOperationRequest,
  EmergencyOperationResponse,
  UpdateEmergencyOperationRequest,
} from './emergency-operations.dto';

type EmergencyOperationRow = typeof emergencyOperations.$inferSelect;

/** Maps an emergency-operation row to the response returned by the API. */
function toEmergencyOperationResponse(
  row: EmergencyOperationRow,
): EmergencyOperationResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    operationCode: row.operationCode,
    name: row.name,
    description: row.description,
    countryCode: row.countryCode,
    type: row.type,
    severity: row.severity,
    status: row.status,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
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

/** Throws the project's structured validation response for an invalid timeline. */
function throwInvalidTimeline(): never {
  throw new BadRequestException({
    statusCode: 400,
    message: 'Request validation failed',
    errors: [
      {
        field: 'endedAt',
        code: 'custom',
        message: 'endedAt must not be earlier than startedAt',
      },
    ],
  });
}

@Injectable()
export class EmergencyOperationsService {
  constructor(private readonly database: DatabaseService) {}

  /** Creates a planned operation and maps duplicate codes or unknown organizations. */
  async create(
    input: CreateEmergencyOperationRequest,
  ): Promise<EmergencyOperationResponse> {
    try {
      const [operation] = await this.database.db
        .insert(emergencyOperations)
        .values({ ...input, status: 'PLANNED' })
        .returning();

      return toEmergencyOperationResponse(operation);
    } catch (error) {
      if (hasPostgresErrorCode(error, '23505')) {
        throw new ConflictException(
          'Operation code already exists for this organization',
        );
      }

      if (hasPostgresErrorCode(error, '23503')) {
        throw new NotFoundException('Organization not found');
      }

      throw error;
    }
  }

  /** Returns all emergency operations. */
  async findAll(): Promise<EmergencyOperationResponse[]> {
    const records = await this.database.db.select().from(emergencyOperations);

    return records.map(toEmergencyOperationResponse);
  }

  /** Returns an operation by ID or a not-found response. */
  async findOne(id: string): Promise<EmergencyOperationResponse> {
    const operation = await this.findOperationRecord(id);

    return toEmergencyOperationResponse(operation);
  }

  /** Updates supplied mutable fields without changing an operation's status. */
  async update(
    id: string,
    input: UpdateEmergencyOperationRequest,
  ): Promise<EmergencyOperationResponse> {
    const current = await this.findOperationRecord(id);
    const startedAt = input.startedAt ?? current.startedAt;
    const endedAt = input.endedAt ?? current.endedAt;

    if (startedAt && endedAt && endedAt < startedAt) {
      throwInvalidTimeline();
    }

    const [operation] = await this.database.db
      .update(emergencyOperations)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(emergencyOperations.id, id))
      .returning();

    if (!operation) {
      throw new NotFoundException('Emergency operation not found');
    }

    return toEmergencyOperationResponse(operation);
  }

  /** Activates a planned operation and sets its start time when it is absent. */
  async activate(id: string): Promise<EmergencyOperationResponse> {
    return this.transition(id, 'ACTIVE');
  }

  /** Completes an active operation and records its completion time. */
  async complete(id: string): Promise<EmergencyOperationResponse> {
    return this.transition(id, 'COMPLETED');
  }

  /** Cancels a planned or active operation and records its cancellation time. */
  async cancel(id: string): Promise<EmergencyOperationResponse> {
    return this.transition(id, 'CANCELLED');
  }

  /** Loads an operation row because status commands need its current state. */
  private async findOperationRecord(
    id: string,
  ): Promise<EmergencyOperationRow> {
    const [operation] = await this.database.db
      .select()
      .from(emergencyOperations)
      .where(eq(emergencyOperations.id, id))
      .limit(1);

    if (!operation) {
      throw new NotFoundException('Emergency operation not found');
    }

    return operation;
  }

  /** Applies an allowed status command without overwriting an existing end time. */
  private async transition(
    id: string,
    nextStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
  ): Promise<EmergencyOperationResponse> {
    const current = await this.findOperationRecord(id);
    const isAllowed =
      (nextStatus === 'ACTIVE' && current.status === 'PLANNED') ||
      (nextStatus === 'COMPLETED' && current.status === 'ACTIVE') ||
      (nextStatus === 'CANCELLED' &&
        (current.status === 'PLANNED' || current.status === 'ACTIVE'));

    if (!isAllowed) {
      throw new ConflictException(
        'Invalid emergency operation status transition',
      );
    }

    const now = new Date();
    const startedAt = current.startedAt ?? now;
    if (nextStatus === 'ACTIVE') {
      if (current.endedAt && current.endedAt < startedAt) {
        throw new ConflictException(
          'Emergency operation cannot start after it ends',
        );
      }
    } else {
      if (current.endedAt) {
        throw new ConflictException(
          'Emergency operation already has an end time',
        );
      }

      if (now < startedAt) {
        throw new ConflictException(
          'Emergency operation cannot end before it starts',
        );
      }
    }

    const values =
      nextStatus === 'ACTIVE'
        ? {
            status: nextStatus,
            startedAt,
            updatedAt: now,
          }
        : {
            status: nextStatus,
            endedAt: now,
            updatedAt: now,
          };
    const transitionCondition =
      nextStatus === 'ACTIVE'
        ? and(
            eq(emergencyOperations.id, id),
            eq(emergencyOperations.status, current.status),
          )
        : and(
            eq(emergencyOperations.id, id),
            eq(emergencyOperations.status, current.status),
            isNull(emergencyOperations.endedAt),
          );
    const [operation] = await this.database.db
      .update(emergencyOperations)
      .set(values)
      .where(transitionCondition)
      .returning();

    if (!operation) {
      throw new ConflictException('Emergency operation status changed; retry');
    }

    return toEmergencyOperationResponse(operation);
  }
}
