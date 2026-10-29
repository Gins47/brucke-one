import { NotFoundException } from '@nestjs/common';

import type { DatabaseService } from '../database/database.service';
import { HelpRequestsService } from './help-requests.service';

const operationId = 'b740fd73-661c-435e-ba99-ad7b1ce807a9';
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

/** Creates transaction mocks for focused public help-request service tests. */
function createDatabaseMock(options: {
  operation?: { id: string };
  insertError?: Error;
}) {
  const values = jest.fn(() =>
    options.insertError
      ? Promise.reject(options.insertError)
      : Promise.resolve(undefined),
  );
  const insert = jest.fn(() => ({ values }));
  const limit = jest
    .fn()
    .mockResolvedValue(options.operation ? [options.operation] : []);
  const forUpdate = jest.fn(() => ({ limit }));
  const where = jest.fn(() => ({ for: forUpdate }));
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));
  const transaction = jest.fn(async (work: (tx: unknown) => Promise<unknown>) =>
    work({ select, insert }),
  );

  return {
    database: {
      transaction,
    } as unknown as DatabaseService,
    values,
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
  it.each(['missing', 'inactive', 'country-mismatched'])(
    'returns the same public-safe not-found response for a %s operation',
    async () => {
      const mock = createDatabaseMock({});
      const service = new HelpRequestsService(mock.database);

      await expect(
        service.createPublicRequest('DE', requestInput),
      ).rejects.toEqual(new NotFoundException('Emergency operation not found'));
    },
  );

  it('stores a valid request as pending review with a server-generated reference', async () => {
    const mock = createDatabaseMock({ operation: { id: operationId } });
    const service = new HelpRequestsService(mock.database);

    const response = await service.createPublicRequest('DE', requestInput);

    expect(response).toMatchObject({
      status: 'PENDING_REVIEW',
      message:
        'Your request has been received. Emergency staff will review it.',
    });
    expect(response.acknowledgementReference).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(response.acknowledgedAt).toBeInstanceOf(Date);
    const insertedValues = mock.values.mock.calls[0]?.[0] as unknown as Record<
      string,
      unknown
    >;
    expect(insertedValues).toMatchObject({
      ...requestInput,
      status: 'PENDING_REVIEW',
    });
    expect(insertedValues.publicReference).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });

  it('returns a generic acknowledgement when the normalized email already exists', async () => {
    const mock = createDatabaseMock({
      operation: { id: operationId },
      insertError: Object.assign(new Error('duplicate email'), {
        code: '23505',
      }),
    });
    const service = new HelpRequestsService(mock.database);

    const response = await service.createPublicRequest('DE', requestInput);

    expect(response).toMatchObject({
      status: 'PENDING_REVIEW',
      message:
        'Your request has been received. Emergency staff will review it.',
    });
    expect(response.acknowledgementReference).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(response.acknowledgedAt).toBeInstanceOf(Date);
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
