import { ConflictException, NotFoundException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service';
import { OrganizationsService } from './organizations.service';

const organization = {
  id: '74967c13-7f77-4b59-95bc-fc4590ed9821',
  code: 'BAY-RELIEF',
  name: 'Bavarian Relief Organization',
  contactEmail: 'contact@example.com',
  contactPhone: '+49123456789',
  officeAddress: 'Munich, 82194',
  createdAt: new Date('2026-10-13T10:00:00.000Z'),
  updatedAt: new Date('2026-10-13T10:00:00.000Z'),
};

/** Creates the fluent query mock used by focused organization service tests. */
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
    insert,
    values,
    returning,
    select,
    from,
    where,
    limit,
    update,
    set,
    updateWhere,
  };
}

describe('OrganizationsService', () => {
  it('creates an organization', async () => {
    const mock = createDatabaseMock();
    mock.returning.mockResolvedValueOnce([organization]);
    const service = new OrganizationsService(mock.database);

    await expect(
      service.create({
        code: organization.code,
        name: organization.name,
        contactEmail: organization.contactEmail,
        contactPhone: organization.contactPhone,
        officeAddress: organization.officeAddress,
      }),
    ).resolves.toEqual(organization);
  });

  it('returns not found for an unknown organization ID', async () => {
    const mock = createDatabaseMock();
    mock.limit.mockResolvedValueOnce([]);
    const service = new OrganizationsService(mock.database);

    await expect(
      service.findOne('74967c13-7f77-4b59-95bc-fc4590ed9821'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('preserves omitted fields and clears an explicitly null contact field', async () => {
    const mock = createDatabaseMock();
    const updatedOrganization = {
      ...organization,
      name: 'Updated Bavarian Relief Organization',
      contactEmail: null,
      updatedAt: new Date('2026-10-13T11:00:00.000Z'),
    };
    mock.returning.mockResolvedValueOnce([updatedOrganization]);
    const service = new OrganizationsService(mock.database);

    await expect(
      service.update(organization.id, {
        name: updatedOrganization.name,
        contactEmail: null,
      }),
    ).resolves.toEqual(updatedOrganization);
    expect(mock.set).toHaveBeenCalledWith({
      name: updatedOrganization.name,
      contactEmail: null,
      updatedAt: expect.any(Date) as Date,
    });
  });

  it('maps a duplicate organization code to a conflict', async () => {
    const mock = createDatabaseMock();
    mock.returning.mockRejectedValueOnce({ code: '23505' });
    const service = new OrganizationsService(mock.database);

    await expect(
      service.create({ code: organization.code, name: organization.name }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
