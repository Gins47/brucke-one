import { ConflictException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { DatabaseService } from '../database/database.service';
import { shelterActivations } from '../database/schema';
import { ShelterActivationsService } from './shelter-activations.service';

jest.mock('drizzle-orm', () => {
  const actual =
    jest.requireActual<typeof import('drizzle-orm')>('drizzle-orm');

  return {
    ...actual,
    and: jest.fn(actual.and),
    eq: jest.fn(actual.eq),
  };
});

const shelter = {
  id: '4d274c61-79cc-4471-8e93-2c1bb2ec8183',
  organizationId: '74967c13-7f77-4b59-95bc-fc4590ed9821',
  shelterCode: 'MUC-001',
  name: 'Munich Community Hall',
  address: 'Example Street 10, 80331 Munich',
  countryCode: 'DE',
  latitude: null,
  longitude: null,
  capacity: 250,
  contactEmail: null,
  contactPhone: null,
  createdAt: new Date('2026-10-15T10:00:00.000Z'),
  updatedAt: new Date('2026-10-15T10:00:00.000Z'),
};

const operation = {
  id: 'b740fd73-661c-435e-ba99-ad7b1ce807a9',
  organizationId: shelter.organizationId,
  operationCode: 'BAY-FLD-2026-01',
  name: 'Bayern Flood 2026',
  description: null,
  countryCode: 'DE',
  type: 'FLOOD' as const,
  severity: 'HIGH' as const,
  status: 'ACTIVE' as const,
  startedAt: new Date('2026-10-15T09:00:00.000Z'),
  endedAt: null,
  createdAt: new Date('2026-10-15T09:00:00.000Z'),
  updatedAt: new Date('2026-10-15T09:00:00.000Z'),
};

const activation = {
  id: '4c4d9ba4-cdb5-40a0-a389-45216fc1ef44',
  organizationId: shelter.organizationId,
  shelterId: shelter.id,
  emergencyOperationId: operation.id,
  status: 'ACTIVE' as const,
  activatedAt: new Date('2026-10-15T10:00:00.000Z'),
  deactivatedAt: null,
  createdAt: new Date('2026-10-15T10:00:00.000Z'),
  updatedAt: new Date('2026-10-15T10:00:00.000Z'),
};

/** Creates fluent Drizzle-query mocks for focused activation service tests. */
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
  const transactionReturning = jest.fn();
  const transactionValues = jest.fn(() => ({
    returning: transactionReturning,
  }));
  const transactionInsert = jest.fn(() => ({ values: transactionValues }));
  const transactionLimit = jest.fn();
  const transactionFor = jest.fn(() => ({ limit: transactionLimit }));
  const transactionWhere = jest.fn(() => ({
    for: transactionFor,
    limit: transactionLimit,
  }));
  const transactionFrom = jest.fn(() => ({ where: transactionWhere }));
  const transactionSelect = jest.fn(() => ({ from: transactionFrom }));
  const transactionDb = {
    select: transactionSelect,
    insert: transactionInsert,
  };
  const transaction = jest.fn(
    (work: (tx: typeof transactionDb) => Promise<unknown>) =>
      work(transactionDb),
  );

  return {
    database: {
      db: { insert, select, update },
      transaction,
    } as unknown as DatabaseService,
    transaction,
    transactionInsert,
    transactionValues,
    transactionReturning,
    transactionLimit,
    transactionFor,
    returning,
    limit,
    set,
    updateWhere,
  };
}

describe('ShelterActivationsService', () => {
  it('creates an active activation and derives the organization ID from the shelter', async () => {
    const mock = createDatabaseMock();
    mock.transactionLimit
      .mockResolvedValueOnce([operation])
      .mockResolvedValueOnce([shelter]);
    mock.transactionReturning.mockResolvedValueOnce([activation]);
    const service = new ShelterActivationsService(mock.database);

    await expect(
      service.create({
        shelterId: shelter.id,
        emergencyOperationId: operation.id,
      }),
    ).resolves.toEqual(activation);
    expect(mock.transaction).toHaveBeenCalledTimes(1);
    expect(mock.transactionFor).toHaveBeenCalledWith('update');
    expect(mock.transactionValues).toHaveBeenCalledWith({
      organizationId: shelter.organizationId,
      shelterId: shelter.id,
      emergencyOperationId: operation.id,
      status: 'ACTIVE',
      activatedAt: expect.any(Date) as Date,
    });
  });

  it('locks a terminal operation and rejects activation without inserting', async () => {
    const mock = createDatabaseMock();
    mock.transactionLimit.mockResolvedValueOnce([
      { ...operation, status: 'COMPLETED' as const },
    ]);
    const service = new ShelterActivationsService(mock.database);

    await expect(
      service.create({
        shelterId: shelter.id,
        emergencyOperationId: operation.id,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mock.transactionFor).toHaveBeenCalledWith('update');
    expect(mock.transactionInsert).not.toHaveBeenCalled();
  });

  it('rejects shelter and operation organization mismatches', async () => {
    const mock = createDatabaseMock();
    mock.transactionLimit
      .mockResolvedValueOnce([operation])
      .mockResolvedValueOnce([
        {
          ...shelter,
          organizationId: '728d322b-77ce-427c-a824-810dfc6535cd',
        },
      ]);
    const service = new ShelterActivationsService(mock.database);

    await expect(
      service.create({
        shelterId: shelter.id,
        emergencyOperationId: operation.id,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deactivates an active activation', async () => {
    const mock = createDatabaseMock();
    const deactivatedActivation = {
      ...activation,
      status: 'DEACTIVATED' as const,
      deactivatedAt: new Date('2026-10-15T11:00:00.000Z'),
    };
    mock.limit.mockResolvedValueOnce([activation]);
    mock.returning.mockResolvedValueOnce([deactivatedActivation]);
    const service = new ShelterActivationsService(mock.database);

    await expect(service.deactivate(activation.id)).resolves.toEqual(
      deactivatedActivation,
    );
    expect(mock.set).toHaveBeenCalledWith({
      status: 'DEACTIVATED',
      deactivatedAt: expect.any(Date) as Date,
      updatedAt: expect.any(Date) as Date,
    });
    const mockedAnd = jest.mocked(and);
    const mockedEq = jest.mocked(eq);

    expect(mockedEq).toHaveBeenCalledWith(shelterActivations.id, activation.id);
    expect(mockedEq).toHaveBeenCalledWith(shelterActivations.status, 'ACTIVE');
    expect(mockedAnd).toHaveBeenCalledTimes(1);
    expect(mock.updateWhere).toHaveBeenCalledTimes(1);
  });

  it('returns conflict when the deactivation conditional update affects no rows', async () => {
    const mock = createDatabaseMock();
    mock.limit.mockResolvedValueOnce([activation]);
    mock.returning.mockResolvedValueOnce([]);
    const service = new ShelterActivationsService(mock.database);

    await expect(service.deactivate(activation.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
