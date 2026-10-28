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
});
