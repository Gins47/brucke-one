import { ConflictException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { DatabaseService } from '../database/database.service';
import { operationAffectedRegions } from '../database/schema';
import { OperationAffectedRegionsService } from './operation-affected-regions.service';

jest.mock('drizzle-orm', () => {
  const actual =
    jest.requireActual<typeof import('drizzle-orm')>('drizzle-orm');

  return {
    ...actual,
    and: jest.fn(actual.and),
    eq: jest.fn(actual.eq),
    isNull: jest.fn(actual.isNull),
  };
});

const operationId = 'b740fd73-661c-435e-ba99-ad7b1ce807a9';
const regionId = '4c4d9ba4-cdb5-40a0-a389-45216fc1ef44';
const region = {
  id: regionId,
  emergencyOperationId: operationId,
  countryCode: 'DE',
  regionCode: 'DE-BY',
  regionName: 'Bavaria',
  addedAt: new Date('2026-10-15T10:00:00.000Z'),
  removedAt: null,
  createdAt: new Date('2026-10-15T10:00:00.000Z'),
  updatedAt: new Date('2026-10-15T10:00:00.000Z'),
};

/** Creates fluent Drizzle-query mocks for focused affected-region service tests. */
function createDatabaseMock() {
  const returning = jest.fn();
  const values = jest.fn(() => ({ returning }));
  const insert = jest.fn(() => ({ values }));
  const limit = jest.fn();
  const where = jest.fn(() => ({ limit }));
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));
  const updateWhere = jest.fn(() => ({ returning }));
  const set = jest.fn(() => ({ where: updateWhere }));
  const update = jest.fn(() => ({ set }));

  return {
    database: {
      db: { insert, select, update },
    } as unknown as DatabaseService,
    returning,
    values,
    limit,
    set,
    updateWhere,
  };
}

describe('OperationAffectedRegionsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds a region for an existing emergency operation', async () => {
    const mock = createDatabaseMock();
    mock.limit.mockResolvedValueOnce([{ id: operationId }]);
    mock.returning.mockResolvedValueOnce([region]);
    const service = new OperationAffectedRegionsService(mock.database);

    await expect(
      service.create(operationId, {
        countryCode: 'DE',
        regionCode: 'DE-BY',
        regionName: 'Bavaria',
      }),
    ).resolves.toEqual(region);
    expect(mock.values).toHaveBeenCalledWith({
      emergencyOperationId: operationId,
      countryCode: 'DE',
      regionCode: 'DE-BY',
      regionName: 'Bavaria',
      addedAt: expect.any(Date) as Date,
      removedAt: null,
    });
  });

  it('maps a duplicate current region to conflict', async () => {
    const mock = createDatabaseMock();
    mock.limit.mockResolvedValueOnce([{ id: operationId }]);
    mock.returning.mockRejectedValueOnce({ code: '23505' });
    const service = new OperationAffectedRegionsService(mock.database);

    await expect(
      service.create(operationId, {
        countryCode: 'DE',
        regionCode: 'DE-BY',
        regionName: 'Bavaria',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses the conditional ID, operation ID, and current-region update for removal', async () => {
    const mock = createDatabaseMock();
    const removedRegion = { ...region, removedAt: new Date() };
    mock.limit.mockResolvedValueOnce([region]);
    mock.returning.mockResolvedValueOnce([removedRegion]);
    const service = new OperationAffectedRegionsService(mock.database);

    await expect(service.remove(operationId, regionId)).resolves.toEqual(
      removedRegion,
    );
    expect(jest.mocked(eq)).toHaveBeenCalledWith(
      operationAffectedRegions.id,
      regionId,
    );
    expect(jest.mocked(eq)).toHaveBeenCalledWith(
      operationAffectedRegions.emergencyOperationId,
      operationId,
    );
    expect(jest.mocked(isNull)).toHaveBeenCalledWith(
      operationAffectedRegions.removedAt,
    );
    expect(jest.mocked(and)).toHaveBeenCalledTimes(2);
    expect(mock.updateWhere).toHaveBeenCalledTimes(1);
  });

  it('returns conflict when the conditional removal update affects no rows', async () => {
    const mock = createDatabaseMock();
    mock.limit.mockResolvedValueOnce([region]);
    mock.returning.mockResolvedValueOnce([]);
    const service = new OperationAffectedRegionsService(mock.database);

    await expect(service.remove(operationId, regionId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
