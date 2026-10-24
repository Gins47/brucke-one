import { ConflictException } from '@nestjs/common';

import type { DatabaseService } from '../database/database.service';
import { ShelterActivationAvailabilityService } from './shelter-activation-availability.service';

const activation = {
  id: 'b5f75211-b4fd-4b31-8b42-d25a7868013c',
  organizationId: '264533ae-fa9e-48ec-8522-a3af15c07e03',
  shelterId: 'dd6b76e6-f534-4b70-bdd0-21e4674564eb',
  emergencyOperationId: 'e53a4153-b3d2-46d7-8c1d-fbbff0385b7c',
  status: 'ACTIVE' as const,
  activatedAt: new Date('2026-10-24T09:00:00.000Z'),
  deactivatedAt: null,
  createdAt: new Date('2026-10-24T09:00:00.000Z'),
  updatedAt: new Date('2026-10-24T09:00:00.000Z'),
};
const operation = {
  id: activation.emergencyOperationId,
  organizationId: activation.organizationId,
  status: 'ACTIVE' as const,
};
const shelter = { id: activation.shelterId, capacity: 50 };
const availability = {
  shelterActivationId: activation.id,
  operationalCapacity: 40,
  currentOccupancy: 12,
  reservedPlaces: 3,
  acceptingArrivals: true,
  availabilityNote: null,
  reportedAt: new Date('2026-10-24T10:00:00.000Z'),
  createdAt: new Date('2026-10-24T10:00:00.000Z'),
  updatedAt: new Date('2026-10-24T10:00:00.000Z'),
};

/** Creates just enough fluent Drizzle mocks for availability write tests. */
function createDatabaseMock() {
  const limit = jest.fn();
  const forUpdate = jest.fn(() => ({ limit }));
  const where = jest.fn(() => ({ for: forUpdate }));
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));
  const returning = jest.fn();
  const values = jest.fn(() => ({ returning }));
  const insert = jest.fn(() => ({ values }));
  const updateWhere = jest.fn(() => ({ returning }));
  const set = jest.fn(() => ({ where: updateWhere }));
  const update = jest.fn(() => ({ set }));
  const tx = { select, insert, update };
  const transaction = jest.fn((work: (value: typeof tx) => Promise<unknown>) =>
    work(tx),
  );

  return {
    database: { transaction } as unknown as DatabaseService,
    transaction,
    limit,
    forUpdate,
    values,
    set,
    returning,
    insert,
    update,
  };
}

describe('ShelterActivationAvailabilityService', () => {
  it('creates a first report for active parents', async () => {
    const mock = createDatabaseMock();
    mock.limit
      .mockResolvedValueOnce([activation])
      .mockResolvedValueOnce([operation])
      .mockResolvedValueOnce([shelter])
      .mockResolvedValueOnce([]);
    mock.returning.mockResolvedValueOnce([availability]);
    const service = new ShelterActivationAvailabilityService(mock.database);

    await expect(
      service.replace(activation.id, {
        operationalCapacity: 40,
        currentOccupancy: 12,
        reservedPlaces: 3,
        acceptingArrivals: true,
      }),
    ).resolves.toMatchObject({
      shelterActivationId: activation.id,
      availablePlaces: 25,
    });
    expect(mock.transaction).toHaveBeenCalledTimes(1);
    expect(mock.forUpdate).toHaveBeenCalledTimes(4);
    expect(mock.values).toHaveBeenCalledWith(
      expect.objectContaining({ shelterActivationId: activation.id }),
    );
  });

  it('replaces an existing report after locking it', async () => {
    const mock = createDatabaseMock();
    const replacement = { ...availability, currentOccupancy: 15 };
    mock.limit
      .mockResolvedValueOnce([activation])
      .mockResolvedValueOnce([operation])
      .mockResolvedValueOnce([shelter])
      .mockResolvedValueOnce([availability]);
    mock.returning.mockResolvedValueOnce([replacement]);
    const service = new ShelterActivationAvailabilityService(mock.database);

    await expect(
      service.replace(activation.id, {
        operationalCapacity: 40,
        currentOccupancy: 15,
        reservedPlaces: 3,
        acceptingArrivals: false,
        availabilityNote: 'Limited access',
      }),
    ).resolves.toMatchObject({ availablePlaces: 22 });
    expect(mock.forUpdate).toHaveBeenCalledTimes(4);
    expect(mock.set).toHaveBeenCalledWith(
      expect.objectContaining({ currentOccupancy: 15 }),
    );
  });

  it('rejects operational capacity above the physical shelter capacity', async () => {
    const mock = createDatabaseMock();
    mock.limit
      .mockResolvedValueOnce([activation])
      .mockResolvedValueOnce([operation])
      .mockResolvedValueOnce([shelter]);
    const service = new ShelterActivationAvailabilityService(mock.database);

    await expect(
      service.replace(activation.id, {
        operationalCapacity: 51,
        currentOccupancy: 0,
        reservedPlaces: 0,
        acceptingArrivals: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it('rejects a terminal parent state before writing availability', async () => {
    const mock = createDatabaseMock();
    mock.limit
      .mockResolvedValueOnce([activation])
      .mockResolvedValueOnce([{ ...operation, status: 'COMPLETED' }])
      .mockResolvedValueOnce([shelter]);
    const service = new ShelterActivationAvailabilityService(mock.database);

    await expect(
      service.replace(activation.id, {
        operationalCapacity: 40,
        currentOccupancy: 0,
        reservedPlaces: 0,
        acceptingArrivals: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it('maps a missing or changed parent state after the activation lock to conflict', async () => {
    const mock = createDatabaseMock();
    mock.limit.mockResolvedValueOnce([activation]).mockResolvedValueOnce([]);
    const service = new ShelterActivationAvailabilityService(mock.database);

    await expect(
      service.replace(activation.id, {
        operationalCapacity: 40,
        currentOccupancy: 0,
        reservedPlaces: 0,
        acceptingArrivals: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mock.insert).not.toHaveBeenCalled();
  });
});
