import { ConflictException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service';
import { EmergencyOperationsService } from './emergency-operations.service';

const operation = {
  id: 'b740fd73-661c-435e-ba99-ad7b1ce807a9',
  organizationId: '74967c13-7f77-4b59-95bc-fc4590ed9821',
  operationCode: 'BAY-FLD-2026-01',
  name: 'Bayern Flood 2026',
  description: 'Operational description',
  countryCode: 'DE',
  type: 'FLOOD' as const,
  severity: 'HIGH' as const,
  status: 'PLANNED' as const,
  startedAt: null,
  endedAt: null,
  createdAt: new Date('2026-10-14T10:00:00.000Z'),
  updatedAt: new Date('2026-10-14T10:00:00.000Z'),
};

/** Creates fluent Drizzle-query mocks for focused emergency-operation tests. */
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
    values,
    returning,
    limit,
    set,
  };
}

describe('EmergencyOperationsService', () => {
  it('creates a planned operation', async () => {
    const mock = createDatabaseMock();
    mock.returning.mockResolvedValueOnce([operation]);
    const service = new EmergencyOperationsService(mock.database);

    await expect(
      service.create({
        organizationId: operation.organizationId,
        operationCode: operation.operationCode,
        name: operation.name,
        description: operation.description,
        countryCode: operation.countryCode,
        type: operation.type,
        severity: operation.severity,
      }),
    ).resolves.toEqual(operation);
    expect(mock.values).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PLANNED' }),
    );
  });

  it('maps a duplicate operation code in one organization to a conflict', async () => {
    const mock = createDatabaseMock();
    mock.returning.mockRejectedValueOnce({ code: '23505' });
    const service = new EmergencyOperationsService(mock.database);

    await expect(
      service.create({
        organizationId: operation.organizationId,
        operationCode: operation.operationCode,
        name: operation.name,
        countryCode: operation.countryCode,
        type: operation.type,
        severity: operation.severity,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('activates a planned operation', async () => {
    const mock = createDatabaseMock();
    const activeOperation = { ...operation, status: 'ACTIVE' as const };
    mock.limit.mockResolvedValueOnce([operation]);
    mock.returning.mockResolvedValueOnce([activeOperation]);
    const service = new EmergencyOperationsService(mock.database);

    await expect(service.activate(operation.id)).resolves.toEqual(
      activeOperation,
    );
    expect(mock.set).toHaveBeenCalledWith({
      status: 'ACTIVE',
      startedAt: expect.any(Date) as Date,
      updatedAt: expect.any(Date) as Date,
    });
  });

  it('rejects activation when an existing end time would precede the start time', async () => {
    const mock = createDatabaseMock();
    mock.limit.mockResolvedValueOnce([
      { ...operation, endedAt: new Date('2020-10-14T10:00:00.000Z') },
    ]);
    const service = new EmergencyOperationsService(mock.database);

    await expect(service.activate(operation.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('completes an active operation', async () => {
    const mock = createDatabaseMock();
    const activeOperation = {
      ...operation,
      status: 'ACTIVE' as const,
      startedAt: new Date('2026-10-14T10:00:00.000Z'),
    };
    const completedOperation = {
      ...activeOperation,
      status: 'COMPLETED' as const,
      endedAt: new Date('2026-10-14T11:00:00.000Z'),
    };
    mock.limit.mockResolvedValueOnce([activeOperation]);
    mock.returning.mockResolvedValueOnce([completedOperation]);
    const service = new EmergencyOperationsService(mock.database);

    await expect(service.complete(operation.id)).resolves.toEqual(
      completedOperation,
    );
    expect(mock.set).toHaveBeenCalledWith({
      status: 'COMPLETED',
      endedAt: expect.any(Date) as Date,
      updatedAt: expect.any(Date) as Date,
    });
  });

  it('does not overwrite an end time when the terminal update affects no row', async () => {
    const mock = createDatabaseMock();
    const activeOperation = {
      ...operation,
      status: 'ACTIVE' as const,
      startedAt: new Date('2026-10-14T10:00:00.000Z'),
    };
    mock.limit.mockResolvedValueOnce([activeOperation]);
    mock.returning.mockResolvedValueOnce([]);
    const service = new EmergencyOperationsService(mock.database);

    await expect(service.complete(operation.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects completing a planned operation', async () => {
    const mock = createDatabaseMock();
    mock.limit.mockResolvedValueOnce([operation]);
    const service = new EmergencyOperationsService(mock.database);

    await expect(service.complete(operation.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('preserves omitted fields and clears an explicitly null description', async () => {
    const mock = createDatabaseMock();
    const updatedOperation = {
      ...operation,
      name: 'Updated Bayern Flood 2026',
      description: null,
      updatedAt: new Date('2026-10-14T11:00:00.000Z'),
    };
    mock.limit.mockResolvedValueOnce([operation]);
    mock.returning.mockResolvedValueOnce([updatedOperation]);
    const service = new EmergencyOperationsService(mock.database);

    await expect(
      service.update(operation.id, {
        name: updatedOperation.name,
        description: null,
      }),
    ).resolves.toEqual(updatedOperation);
    expect(mock.set).toHaveBeenCalledWith({
      name: updatedOperation.name,
      description: null,
      updatedAt: expect.any(Date) as Date,
    });
  });
});
