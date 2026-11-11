import * as crypto from 'node:crypto';

import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import {
  emergencyOperations,
  helpRequestIdempotency,
  helpRequestShelterAssignments,
  helpRequests,
  operationAffectedRegions,
  outboxEvents,
  shelterActivations,
  shelters,
} from '../database/schema';
import type {
  CreatePublicHelpRequestRequest,
  HelpRequestQueueQuery,
  HelpRequestQueueResponse,
  OperatorHelpRequestResponse,
  PublicEmergencyOperationResponse,
  PublicHelpRequestAcknowledgement,
  PublicHelpRequestStatusResponse,
} from './help-requests.dto';
import {
  encodeHelpRequestQueueCursor,
  publicHelpRequestShortReferenceSchema,
} from './help-requests.dto';

/** Generates an opaque 144-bit value for a stored or acknowledgement reference. */
function createOpaqueReference(): string {
  return crypto.randomBytes(18).toString('base64url');
}

const shortReferenceAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const shortReferenceLength = 5;
const shortReferenceMaximumAttempts = 5;

/** Generates one uppercase alphanumeric public identifier using Node crypto. */
export function createShortReference(): string {
  return Array.from(
    { length: shortReferenceLength },
    () =>
      shortReferenceAlphabet[crypto.randomInt(shortReferenceAlphabet.length)],
  ).join('');
}

/** Builds the identifier-only event stored for one newly created help request. */
function createHelpRequestSubmittedEvent(helpRequestId: string) {
  const outboxEventId = crypto.randomUUID();

  return {
    id: outboxEventId,
    eventType: 'help-request-submitted',
    helpRequestId,
    payload: { outboxEventId, helpRequestId },
  };
}

/** Builds the deliberately generic acknowledgement returned for accepted submissions. */
function toAcknowledgement(
  acknowledgementReference: string,
  acknowledgedAt: Date,
  shortReference?: string,
): PublicHelpRequestAcknowledgement {
  return {
    acknowledgementReference,
    ...(shortReference ? { shortReference } : {}),
    status: 'PENDING_REVIEW',
    acknowledgedAt,
    message: 'Your request has been received. Emergency staff will review it.',
  };
}

/** Replays the durable acknowledgement stored for a completed idempotent submission. */
function toStoredAcknowledgement(row: {
  acknowledgementReference: string;
  shortReference: string | null;
  acknowledgementStatus: string;
  acknowledgementMessage: string;
  acknowledgedAt: Date;
}): PublicHelpRequestAcknowledgement {
  return {
    acknowledgementReference: row.acknowledgementReference,
    ...(row.shortReference ? { shortReference: row.shortReference } : {}),
    status: row.acknowledgementStatus as 'PENDING_REVIEW',
    acknowledgedAt: row.acknowledgedAt,
    message: row.acknowledgementMessage,
  };
}

/** Produces a stable SHA-256 fingerprint for one normalized public submission. */
export function createPublicHelpRequestFingerprint(
  countryCode: string,
  input: CreatePublicHelpRequestRequest,
): string {
  const canonicalRequest = {
    countryCode,
    emergencyOperationId: input.emergencyOperationId,
    requesterName: input.requesterName,
    requesterPhone: input.requesterPhone,
    requesterEmail: input.requesterEmail ?? null,
    groupSize: input.groupSize,
    locationDescription: input.locationDescription,
    canTravelIndependently: input.canTravelIndependently,
    medicalSupportNeeded: input.medicalSupportNeeded,
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalRequest))
    .digest('hex');
}

/** Identifies a PostgreSQL constraint error without exposing database details. */
function hasPostgresConstraint(error: unknown, constraint: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const databaseError = error as {
    constraint?: unknown;
    cause?: { constraint?: unknown };
  };

  return (
    databaseError.constraint === constraint ||
    databaseError.cause?.constraint === constraint
  );
}

/** Maps an internal help-request row to the fields available to operators. */
function toOperatorHelpRequest(
  row: OperatorHelpRequestResponse,
): OperatorHelpRequestResponse {
  return {
    id: row.id,
    publicReference: row.publicReference,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    requesterEmail: row.requesterEmail,
    groupSize: row.groupSize,
    locationDescription: row.locationDescription,
    canTravelIndependently: row.canTravelIndependently,
    medicalSupportNeeded: row.medicalSupportNeeded,
    status: row.status,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class HelpRequestsService {
  private readonly generateShortReference = createShortReference;

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

  /** Persists or replays an idempotent public request without disclosing duplicate emails. */
  async createPublicRequest(
    countryCode: string,
    input: CreatePublicHelpRequestRequest,
    idempotencyKey: string,
  ): Promise<PublicHelpRequestAcknowledgement> {
    const requestFingerprint = createPublicHelpRequestFingerprint(
      countryCode,
      input,
    );
    const publicReference = createOpaqueReference();
    const acknowledgementReference = createOpaqueReference();
    const acknowledgedAt = new Date();
    const acknowledgement = toAcknowledgement(
      acknowledgementReference,
      acknowledgedAt,
    );

    return this.database.transaction(async (tx) => {
      const [createdIdempotency] = await tx
        .insert(helpRequestIdempotency)
        .values({
          idempotencyKey,
          requestFingerprint,
          acknowledgementReference,
          shortReference: null,
          acknowledgementStatus: acknowledgement.status,
          acknowledgementMessage: acknowledgement.message,
          acknowledgedAt,
        })
        .onConflictDoNothing()
        .returning({ idempotencyKey: helpRequestIdempotency.idempotencyKey });

      if (!createdIdempotency) {
        const [storedIdempotency] = await tx
          .select({
            requestFingerprint: helpRequestIdempotency.requestFingerprint,
            acknowledgementReference:
              helpRequestIdempotency.acknowledgementReference,
            shortReference: helpRequestIdempotency.shortReference,
            acknowledgementStatus: helpRequestIdempotency.acknowledgementStatus,
            acknowledgementMessage:
              helpRequestIdempotency.acknowledgementMessage,
            acknowledgedAt: helpRequestIdempotency.acknowledgedAt,
          })
          .from(helpRequestIdempotency)
          .where(eq(helpRequestIdempotency.idempotencyKey, idempotencyKey))
          .for('update')
          .limit(1);

        if (!storedIdempotency) {
          throw new ConflictException('Unable to replay the submitted request');
        }

        if (storedIdempotency.requestFingerprint !== requestFingerprint) {
          throw new ConflictException(
            'Idempotency key was used for another request',
          );
        }

        return toStoredAcknowledgement(storedIdempotency);
      }

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

      let createdHelpRequest:
        { id: string; shortReference: string } | undefined;
      let hasDuplicateEmail = false;

      for (
        let attempt = 0;
        attempt < shortReferenceMaximumAttempts;
        attempt += 1
      ) {
        const shortReference = this.generateShortReference();

        try {
          const [createdRequest] = await tx.transaction(async (savepoint) =>
            savepoint
              .insert(helpRequests)
              .values({
                ...input,
                publicReference,
                shortReference,
                status: 'PENDING_REVIEW',
              })
              .onConflictDoNothing({ target: helpRequests.shortReference })
              .returning({
                id: helpRequests.id,
                shortReference: helpRequests.shortReference,
              }),
          );

          if (createdRequest) {
            if (!createdRequest.shortReference) {
              throw new InternalServerErrorException(
                'Created help request is missing its short reference',
              );
            }

            createdHelpRequest = {
              id: createdRequest.id,
              shortReference: createdRequest.shortReference,
            };
            break;
          }
        } catch (error) {
          if (
            hasPostgresConstraint(error, 'help_requests_operation_email_unique')
          ) {
            hasDuplicateEmail = true;
            break;
          }

          throw error;
        }
      }

      if (!createdHelpRequest && !hasDuplicateEmail) {
        throw new InternalServerErrorException('Unable to create help request');
      }

      if (createdHelpRequest) {
        await tx
          .update(helpRequestIdempotency)
          .set({ shortReference: createdHelpRequest.shortReference })
          .where(eq(helpRequestIdempotency.idempotencyKey, idempotencyKey));
        await tx
          .insert(outboxEvents)
          .values(createHelpRequestSubmittedEvent(createdHelpRequest.id));

        return toAcknowledgement(
          acknowledgementReference,
          acknowledgedAt,
          createdHelpRequest.shortReference,
        );
      }

      return acknowledgement;
    });
  }

  /** Returns only a public request's status for a valid short reference. */
  async findPublicStatus(
    rawShortReference: string,
  ): Promise<PublicHelpRequestStatusResponse> {
    const parsedReference =
      publicHelpRequestShortReferenceSchema.safeParse(rawShortReference);

    if (!parsedReference.success) {
      throw new NotFoundException('Help request not found');
    }

    const [request] = await this.database.db
      .select({ status: helpRequests.status })
      .from(helpRequests)
      .where(eq(helpRequests.shortReference, parsedReference.data))
      .limit(1);

    if (!request) {
      throw new NotFoundException('Help request not found');
    }

    return { status: request.status };
  }

  /** Returns one operation's pending-by-default queue with stable cursor pagination. */
  async findOperatorQueue(
    operationId: string,
    query: HelpRequestQueueQuery,
  ): Promise<HelpRequestQueueResponse> {
    await this.findOperation(operationId);

    const conditions = [
      eq(helpRequests.emergencyOperationId, operationId),
      eq(helpRequests.status, query.status),
    ];

    if (query.cursor) {
      conditions.push(
        or(
          lt(helpRequests.createdAt, query.cursor.createdAt),
          and(
            eq(helpRequests.createdAt, query.cursor.createdAt),
            lt(helpRequests.id, query.cursor.id),
          ),
        )!,
      );
    }

    const records = await this.database.db
      .select({
        id: helpRequests.id,
        publicReference: helpRequests.publicReference,
        requesterName: helpRequests.requesterName,
        requesterPhone: helpRequests.requesterPhone,
        requesterEmail: helpRequests.requesterEmail,
        groupSize: helpRequests.groupSize,
        locationDescription: helpRequests.locationDescription,
        canTravelIndependently: helpRequests.canTravelIndependently,
        medicalSupportNeeded: helpRequests.medicalSupportNeeded,
        status: helpRequests.status,
        createdAt: helpRequests.createdAt,
      })
      .from(helpRequests)
      .where(and(...conditions))
      .orderBy(desc(helpRequests.createdAt), desc(helpRequests.id))
      .limit(query.limit + 1);
    const hasNextPage = records.length > query.limit;
    const pageRecords = records.slice(0, query.limit);
    const finalRecord = pageRecords.at(-1);

    const assignments =
      query.status === 'RESERVED' && pageRecords.length
        ? await this.database.db
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
            .where(
              inArray(
                helpRequestShelterAssignments.helpRequestId,
                pageRecords.map((record) => record.id),
              ),
            )
        : [];
    const assignmentByRequest = new Map(
      assignments.map(({ assignment, shelterId, shelterName }) => [
        assignment.helpRequestId,
        { ...assignment, shelterId, shelterName },
      ]),
    );

    return {
      items: pageRecords.map((record) => ({
        ...toOperatorHelpRequest(record),
        ...(query.status === 'RESERVED'
          ? { assignment: assignmentByRequest.get(record.id) ?? null }
          : {}),
      })),
      nextCursor:
        hasNextPage && finalRecord
          ? encodeHelpRequestQueueCursor(finalRecord)
          : null,
    };
  }

  /** Confirms the requested operation exists before exposing its queue. */
  private async findOperation(operationId: string): Promise<void> {
    const [operation] = await this.database.db
      .select({ id: emergencyOperations.id })
      .from(emergencyOperations)
      .where(eq(emergencyOperations.id, operationId))
      .limit(1);

    if (!operation) {
      throw new NotFoundException('Emergency operation not found');
    }
  }
}
