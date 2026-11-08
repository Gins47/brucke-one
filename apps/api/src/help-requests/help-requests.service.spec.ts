import { ConflictException, NotFoundException } from '@nestjs/common';

import type { DatabaseService } from '../database/database.service';
import { createPublicHelpRequestSchema } from './help-requests.dto';
import {
  createPublicHelpRequestFingerprint,
  HelpRequestsService,
} from './help-requests.service';

const operationId = 'b740fd73-661c-435e-ba99-ad7b1ce807a9';
const idempotencyKey = 'c5fa605d-4e42-4b78-9b9e-bfa8333d48bf';
const requestInput = {
  emergencyOperationId: operationId,
  requesterName: 'Requesting Person',
  requesterPhone: '+49123456789',
  requesterEmail: 'person@example.test',
  groupSize: 2,
  locationDescription: 'Near the community centre',
  canTravelIndependently: true,
  medicalSupportNeeded: false,
};

type StoredAcknowledgement = {
  requestFingerprint: string;
  acknowledgementReference: string;
  shortReference: string | null;
  acknowledgementStatus: string;
  acknowledgementMessage: string;
  acknowledgedAt: Date;
};

/** Creates transaction mocks for focused idempotent public-submission tests. */
function createPublicRequestDatabaseMock(options: {
  createdIdempotency?: boolean;
  operation?: { id: string };
  storedAcknowledgement?: StoredAcknowledgement;
}) {
  const helpRequestReturning = jest
    .fn()
    .mockResolvedValue([{ id: operationId, shortReference: 'ABCDE' }]);
  const requestOnConflictDoNothing = jest.fn(() => ({
    returning: helpRequestReturning,
  }));
  const requestValues = jest.fn(() => ({
    onConflictDoNothing: requestOnConflictDoNothing,
  }));
  const idempotencyUpdateWhere = jest.fn().mockResolvedValue(undefined);
  const idempotencyUpdateSet = jest.fn(() => ({
    where: idempotencyUpdateWhere,
  }));
  const update = jest.fn(() => ({ set: idempotencyUpdateSet }));
  const outboxValues = jest.fn().mockResolvedValue(undefined);
  const idempotencyReturning = jest
    .fn()
    .mockResolvedValue(
      options.createdIdempotency === false ? [] : [{ idempotencyKey }],
    );
  const idempotencyOnConflictDoNothing = jest.fn(() => ({
    returning: idempotencyReturning,
  }));
  const idempotencyValues = jest.fn(() => ({
    onConflictDoNothing: idempotencyOnConflictDoNothing,
  }));
  const insert = jest
    .fn()
    .mockReturnValueOnce({ values: idempotencyValues })
    .mockReturnValueOnce({ values: outboxValues });
  const limit = jest
    .fn()
    .mockResolvedValue(
      options.createdIdempotency === false
        ? options.storedAcknowledgement
          ? [options.storedAcknowledgement]
          : []
        : options.operation
          ? [options.operation]
          : [],
    );
  const forUpdate = jest.fn(() => ({ limit }));
  const where = jest.fn(() => ({ for: forUpdate }));
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));
  const savepointInsert = jest.fn(() => ({ values: requestValues }));
  const savepointTransaction = jest.fn(
    async (work: (tx: unknown) => Promise<unknown>) =>
      work({ insert: savepointInsert }),
  );
  const transaction = jest.fn(async (work: (tx: unknown) => Promise<unknown>) =>
    work({ insert, select, transaction: savepointTransaction, update }),
  );

  return {
    database: { transaction } as unknown as DatabaseService,
    requestOnConflictDoNothing,
  };
}

/** Creates database read mocks for one operator queue response-mapping test. */
function createQueueDatabaseMock(records: Array<Record<string, unknown>>) {
  const operationLimit = jest.fn().mockResolvedValue([{ id: operationId }]);
  const operationWhere = jest.fn(() => ({ limit: operationLimit }));
  const operationFrom = jest.fn(() => ({ where: operationWhere }));
  const queueLimit = jest.fn().mockResolvedValue(records);
  const queueOrderBy = jest.fn(() => ({ limit: queueLimit }));
  const queueWhere = jest.fn(() => ({ orderBy: queueOrderBy }));
  const queueFrom = jest.fn(() => ({ where: queueWhere }));
  const select = jest
    .fn()
    .mockReturnValueOnce({ from: operationFrom })
    .mockReturnValueOnce({ from: queueFrom });

  return {
    database: { db: { select } } as unknown as DatabaseService,
  };
}

describe('HelpRequestsService', () => {
  it('creates a pending request and durable acknowledgement for a new key', async () => {
    const mock = createPublicRequestDatabaseMock({
      operation: { id: operationId },
    });
    const service = new HelpRequestsService(mock.database);

    const response = await service.createPublicRequest(
      'DE',
      requestInput,
      idempotencyKey,
    );

    expect(response).toMatchObject({
      status: 'PENDING_REVIEW',
      message:
        'Your request has been received. Emergency staff will review it.',
    });
    expect(response.acknowledgementReference).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(response.shortReference).toMatch(/^[A-Z0-9]{5}$/);
    expect(mock.requestOnConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it('returns the public-safe not-found response when a new key targets an unavailable operation', async () => {
    const mock = createPublicRequestDatabaseMock({});
    const service = new HelpRequestsService(mock.database);

    await expect(
      service.createPublicRequest('DE', requestInput, idempotencyKey),
    ).rejects.toEqual(new NotFoundException('Emergency operation not found'));
  });

  it('replays the exact stored acknowledgement for a matching key and fingerprint', async () => {
    const acknowledgedAt = new Date('2026-11-01T10:00:00.000Z');
    const storedAcknowledgement: StoredAcknowledgement = {
      requestFingerprint: createPublicHelpRequestFingerprint(
        'DE',
        requestInput,
      ),
      acknowledgementReference: 'stored-acknowledgement',
      shortReference: 'ABCDE',
      acknowledgementStatus: 'PENDING_REVIEW',
      acknowledgementMessage:
        'Your request has been received. Emergency staff will review it.',
      acknowledgedAt,
    };
    const mock = createPublicRequestDatabaseMock({
      createdIdempotency: false,
      storedAcknowledgement,
    });
    const service = new HelpRequestsService(mock.database);

    await expect(
      service.createPublicRequest('DE', requestInput, idempotencyKey),
    ).resolves.toEqual({
      acknowledgementReference: storedAcknowledgement.acknowledgementReference,
      shortReference: storedAcknowledgement.shortReference,
      status: 'PENDING_REVIEW',
      acknowledgedAt,
      message: storedAcknowledgement.acknowledgementMessage,
    });
  });

  it('rejects a reused key with a different request fingerprint', async () => {
    const mock = createPublicRequestDatabaseMock({
      createdIdempotency: false,
      storedAcknowledgement: {
        requestFingerprint: 'different-fingerprint',
        acknowledgementReference: 'stored-acknowledgement',
        shortReference: 'ABCDE',
        acknowledgementStatus: 'PENDING_REVIEW',
        acknowledgementMessage:
          'Your request has been received. Emergency staff will review it.',
        acknowledgedAt: new Date('2026-11-01T10:00:00.000Z'),
      },
    });
    const service = new HelpRequestsService(mock.database);

    await expect(
      service.createPublicRequest('DE', requestInput, idempotencyKey),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates equal fingerprints for normalized-equivalent requests', () => {
    const normalizedInput = createPublicHelpRequestSchema.parse({
      ...requestInput,
      requesterEmail: ' PERSON@EXAMPLE.TEST ',
    });

    expect(createPublicHelpRequestFingerprint('DE', requestInput)).toBe(
      createPublicHelpRequestFingerprint('DE', normalizedInput),
    );
  });

  it('changes the fingerprint when a logical request field changes', () => {
    expect(createPublicHelpRequestFingerprint('DE', requestInput)).not.toBe(
      createPublicHelpRequestFingerprint('DE', {
        ...requestInput,
        groupSize: 3,
      }),
    );
  });

  it('maps a limited queue result and returns a cursor for the next page', async () => {
    const createdAt = new Date('2026-10-03T10:00:00.000Z');
    const mock = createQueueDatabaseMock([
      {
        id: 'b740fd73-661c-435e-ba99-ad7b1ce807a9',
        publicReference: 'internal-reference',
        requesterName: 'Requesting Person',
        requesterPhone: '+49123456789',
        requesterEmail: 'person@example.test',
        groupSize: 2,
        locationDescription: 'Near the community centre',
        canTravelIndependently: true,
        medicalSupportNeeded: false,
        status: 'MATCHING',
        createdAt,
      },
      {
        id: 'ad8b7ce8-0731-435e-ba99-b740fd73661c',
        publicReference: 'later-reference',
        requesterName: 'Another Person',
        requesterPhone: '+49123456780',
        requesterEmail: null,
        groupSize: 1,
        locationDescription: 'Town hall',
        canTravelIndependently: false,
        medicalSupportNeeded: false,
        status: 'MATCHING',
        createdAt,
      },
    ]);
    const service = new HelpRequestsService(mock.database);

    const response = await service.findOperatorQueue(operationId, {
      limit: 1,
      status: 'MATCHING',
      cursor: undefined,
    });

    expect(response.items).toEqual([
      expect.objectContaining({
        id: 'b740fd73-661c-435e-ba99-ad7b1ce807a9',
        status: 'MATCHING',
      }),
    ]);
    expect(response.nextCursor).toEqual(expect.any(String));
  });
});
