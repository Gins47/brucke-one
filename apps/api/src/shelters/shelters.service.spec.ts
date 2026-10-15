import { ConflictException, NotFoundException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service';
import { SheltersService } from './shelters.service';

const shelter = {
  id: '4d274c61-79cc-4471-8e93-2c1bb2ec8183',
  organizationId: '74967c13-7f77-4b59-95bc-fc4590ed9821',
  shelterCode: 'MUC-001',
  name: 'Munich Community Hall',
  address: 'Example Street 10, 80331 Munich',
  countryCode: 'DE',
  latitude: 48.1351,
  longitude: 11.582,
  capacity: 250,
  contactEmail: 'shelter@example.org',
  contactPhone: '+49891234567',
  createdAt: new Date('2026-10-15T10:00:00.000Z'),
  updatedAt: new Date('2026-10-15T10:00:00.000Z'),
};

/** Creates fluent Drizzle-query mocks for focused shelter service tests. */
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
    limit,
    set,
  };
}

describe('SheltersService', () => {
  it('creates a shelter', async () => {
    const mock = createDatabaseMock();
    mock.returning.mockResolvedValueOnce([shelter]);
    const service = new SheltersService(mock.database);

    await expect(
      service.create({
        organizationId: shelter.organizationId,
        shelterCode: shelter.shelterCode,
        name: shelter.name,
        address: shelter.address,
        countryCode: shelter.countryCode,
        latitude: shelter.latitude,
        longitude: shelter.longitude,
        capacity: shelter.capacity,
        contactEmail: shelter.contactEmail,
        contactPhone: shelter.contactPhone,
      }),
    ).resolves.toEqual(shelter);
  });

  it('maps a duplicate shelter code in one organization to a conflict', async () => {
    const mock = createDatabaseMock();
    mock.returning.mockRejectedValueOnce({ code: '23505' });
    const service = new SheltersService(mock.database);

    await expect(
      service.create({
        organizationId: shelter.organizationId,
        shelterCode: shelter.shelterCode,
        name: shelter.name,
        address: shelter.address,
        countryCode: shelter.countryCode,
        capacity: shelter.capacity,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found for an unknown shelter ID', async () => {
    const mock = createDatabaseMock();
    mock.limit.mockResolvedValueOnce([]);
    const service = new SheltersService(mock.database);

    await expect(service.findOne(shelter.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('preserves omitted fields when updating a shelter', async () => {
    const mock = createDatabaseMock();
    const updatedShelter = {
      ...shelter,
      name: 'Updated Munich Community Hall',
      updatedAt: new Date('2026-10-15T11:00:00.000Z'),
    };
    mock.returning.mockResolvedValueOnce([updatedShelter]);
    const service = new SheltersService(mock.database);

    await expect(
      service.update(shelter.id, { name: updatedShelter.name }),
    ).resolves.toEqual(updatedShelter);
    expect(mock.set).toHaveBeenCalledWith({
      name: updatedShelter.name,
      updatedAt: expect.any(Date) as Date,
    });
  });

  it('updates both location coordinates together', async () => {
    const mock = createDatabaseMock();
    const updatedShelter = {
      ...shelter,
      latitude: 48.2,
      longitude: 11.6,
    };
    mock.returning.mockResolvedValueOnce([updatedShelter]);
    const service = new SheltersService(mock.database);

    await expect(
      service.update(shelter.id, {
        latitude: updatedShelter.latitude,
        longitude: updatedShelter.longitude,
      }),
    ).resolves.toEqual(updatedShelter);
    expect(mock.set).toHaveBeenCalledWith({
      latitude: updatedShelter.latitude,
      longitude: updatedShelter.longitude,
      updatedAt: expect.any(Date) as Date,
    });
  });

  it('clears both coordinates and an explicitly null contact field', async () => {
    const mock = createDatabaseMock();
    const updatedShelter = {
      ...shelter,
      latitude: null,
      longitude: null,
      contactEmail: null,
    };
    mock.returning.mockResolvedValueOnce([updatedShelter]);
    const service = new SheltersService(mock.database);

    await expect(
      service.update(shelter.id, {
        latitude: null,
        longitude: null,
        contactEmail: null,
      }),
    ).resolves.toEqual(updatedShelter);
    expect(mock.set).toHaveBeenCalledWith({
      latitude: null,
      longitude: null,
      contactEmail: null,
      updatedAt: expect.any(Date) as Date,
    });
  });
});
