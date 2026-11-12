// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient, type DashboardShelter } from '../lib/api-client';
import { ShelterDetail } from './shelter-detail';

function shelter(active: DashboardShelter['activeActivation']): DashboardShelter {
  return {
    id: 'shelter-1', shelterCode: 'MUC-001', name: 'Munich Hall', address: 'Example Street 1', countryCode: 'DE', latitude: null, longitude: null, capacity: 100, contactEmail: null, contactPhone: null, activeActivation: active,
  };
}

afterEach(cleanup);

/** Creates a promise whose response can be completed after a selection changes. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('ShelterDetail', () => {
  it('renders a reported active shelter and uses the server result after an update', async () => {
    const api = {
      getOrganizationShelter: vi.fn().mockResolvedValue(shelter({
        id: 'activation-1', activatedAt: '2026-10-25T10:00:00.000Z', operation: { id: 'operation-1', operationCode: 'OP-1', name: 'Flood response', status: 'ACTIVE' },
        availability: { operationalCapacity: 80, currentOccupancy: 20, reservedPlaces: 10, availablePlaces: 50, acceptingArrivals: true, availabilityNote: null, reportedAt: '2026-10-25T10:00:00.000Z' },
      })),
      getOperatorHelpRequests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      replaceShelterActivationAvailability: vi.fn().mockResolvedValue({ operationalCapacity: 70, currentOccupancy: 20, reservedPlaces: 10, availablePlaces: 40, acceptingArrivals: false, availabilityNote: 'Updated', reportedAt: '2026-10-25T11:00:00.000Z' }),
    } as unknown as ApiClient;
    render(<ShelterDetail sessionKey="token" api={api} organizationId="organization-1" shelterId="shelter-1" />);

    expect(await screen.findByText('50')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    expect(await screen.findByText('Availability report updated.')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
  });

  it('keeps assigned reserved places read-only', async () => {
    const api = {
      getOrganizationShelter: vi.fn().mockResolvedValue(shelter({ id: 'activation-1', activatedAt: '2026-10-25T10:00:00.000Z', operation: { id: 'operation-1', operationCode: 'OP-1', name: 'Flood response', status: 'ACTIVE' }, availability: { operationalCapacity: 80, currentOccupancy: 20, reservedPlaces: 2, availablePlaces: 58, acceptingArrivals: true, availabilityNote: null, reportedAt: '2026-10-25T10:00:00.000Z' } })),
      getOperatorHelpRequests: vi.fn().mockResolvedValue({ items: [{ assignment: { shelterActivationId: 'activation-1' } }], nextCursor: null }),
    } as unknown as ApiClient;
    render(<ShelterDetail sessionKey="token" api={api} organizationId="organization-1" shelterId="shelter-1" />);
    expect(await screen.findByText(/Reserved places are read-only/)).toBeTruthy();
    expect((screen.getByLabelText('Reserved places') as HTMLInputElement).readOnly).toBe(true);
  });

  it('distinguishes not reported and no active emergency operation', async () => {
    const api = { getOrganizationShelter: vi.fn().mockResolvedValue(shelter({ id: 'activation-1', activatedAt: '2026-10-25T10:00:00.000Z', operation: { id: 'operation-1', operationCode: 'OP-1', name: 'Flood response', status: 'ACTIVE' }, availability: null })) } as unknown as ApiClient;
    const view = render(<ShelterDetail sessionKey="token" api={api} organizationId="organization-1" shelterId="shelter-1" />);
    expect(await screen.findByText('Not reported yet.')).toBeTruthy();
    (api.getOrganizationShelter as ReturnType<typeof vi.fn>).mockResolvedValueOnce(shelter(null));
    view.rerender(<ShelterDetail sessionKey="token" api={api} organizationId="organization-1" shelterId="shelter-2" />);
    expect(await screen.findByText('No active emergency operation.')).toBeTruthy();
  });

  it('reloads the latest reservation and discards unsaved edits after a conflict', async () => {
    const active = { id: 'activation-1', activatedAt: '2026-10-25T10:00:00.000Z', operation: { id: 'operation-1', operationCode: 'OP-1', name: 'Flood response', status: 'ACTIVE' as const }, availability: { operationalCapacity: 80, currentOccupancy: 20, reservedPlaces: 0, availablePlaces: 60, acceptingArrivals: true, availabilityNote: null, reportedAt: '2026-10-25T10:00:00.000Z' } };
    const latest = { ...active, availability: { ...active.availability, reservedPlaces: 3, availablePlaces: 57 } };
    const api = {
      getOrganizationShelter: vi.fn().mockResolvedValueOnce(shelter(active)).mockResolvedValue(shelter(latest)),
      getOperatorHelpRequests: vi.fn().mockResolvedValueOnce({ items: [], nextCursor: null }).mockResolvedValue({ items: [{ assignment: { shelterActivationId: 'activation-1' } }], nextCursor: null }),
      replaceShelterActivationAvailability: vi.fn().mockRejectedValue(new ApiError(409, 'conflict')),
    } as unknown as ApiClient;
    render(<ShelterDetail sessionKey="token" api={api} organizationId="organization-1" shelterId="shelter-1" />);
    const capacity = await screen.findByLabelText('Operational capacity');
    fireEvent.change(capacity, { target: { value: '70' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    expect(await screen.findByText(/Your edits were not saved; review the latest report/)).toBeTruthy();
    const reserved = await screen.findByDisplayValue('3') as HTMLInputElement;
    expect(reserved.readOnly).toBe(true);
    expect((screen.getByLabelText('Operational capacity') as HTMLInputElement).value).toBe('80');
    expect(api.replaceShelterActivationAvailability).toHaveBeenCalledTimes(1);
  });

  it('does not show a late shelter response after the selected organization changes', async () => {
    const first = deferred<DashboardShelter>();
    const second = deferred<DashboardShelter>();
    const api = { getOrganizationShelter: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) } as unknown as ApiClient;
    const view = render(<ShelterDetail sessionKey="token" api={api} organizationId="organization-a" shelterId="shelter-1" />);
    view.rerender(<ShelterDetail sessionKey="token" api={api} organizationId="organization-b" shelterId="shelter-1" />);
    await act(async () => { second.resolve({ ...shelter(null), name: 'Organization B shelter' }); });
    expect(await screen.findByRole('heading', { name: 'Organization B shelter' })).toBeTruthy();
    await act(async () => { first.resolve({ ...shelter(null), name: 'Organization A shelter' }); });
    expect(screen.queryByRole('heading', { name: 'Organization A shelter' })).toBeNull();
  });
});
