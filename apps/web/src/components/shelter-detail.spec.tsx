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
      replaceShelterActivationAvailability: vi.fn().mockResolvedValue({ operationalCapacity: 70, currentOccupancy: 20, reservedPlaces: 10, availablePlaces: 40, acceptingArrivals: false, availabilityNote: 'Updated', reportedAt: '2026-10-25T11:00:00.000Z' }),
    } as unknown as ApiClient;
    render(<ShelterDetail accessToken="token" api={api} organizationId="organization-1" shelterId="shelter-1" />);

    expect(await screen.findByText('50')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    expect(await screen.findByText('Availability report updated.')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
  });

  it('distinguishes not reported and no active emergency operation', async () => {
    const api = { getOrganizationShelter: vi.fn().mockResolvedValue(shelter({ id: 'activation-1', activatedAt: '2026-10-25T10:00:00.000Z', operation: { id: 'operation-1', operationCode: 'OP-1', name: 'Flood response', status: 'ACTIVE' }, availability: null })) } as unknown as ApiClient;
    const view = render(<ShelterDetail accessToken="token" api={api} organizationId="organization-1" shelterId="shelter-1" />);
    expect(await screen.findByText('Not reported yet.')).toBeTruthy();
    (api.getOrganizationShelter as ReturnType<typeof vi.fn>).mockResolvedValueOnce(shelter(null));
    view.rerender(<ShelterDetail accessToken="token" api={api} organizationId="organization-1" shelterId="shelter-2" />);
    expect(await screen.findByText('No active emergency operation.')).toBeTruthy();
  });

  it('shows a clear conflict message when the server rejects an update', async () => {
    const api = { getOrganizationShelter: vi.fn().mockResolvedValue(shelter({ id: 'activation-1', activatedAt: '2026-10-25T10:00:00.000Z', operation: { id: 'operation-1', operationCode: 'OP-1', name: 'Flood response', status: 'ACTIVE' }, availability: null })), replaceShelterActivationAvailability: vi.fn().mockRejectedValue(new ApiError(409, 'conflict')) } as unknown as ApiClient;
    render(<ShelterDetail accessToken="token" api={api} organizationId="organization-1" shelterId="shelter-1" />);
    await screen.findByText('Not reported yet.');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save availability' })); });
    expect(await screen.findByText('The report could not be saved because the shelter state changed.')).toBeTruthy();
  });

  it('does not show a late shelter response after the selected organization changes', async () => {
    const first = deferred<DashboardShelter>();
    const second = deferred<DashboardShelter>();
    const api = { getOrganizationShelter: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) } as unknown as ApiClient;
    const view = render(<ShelterDetail accessToken="token" api={api} organizationId="organization-a" shelterId="shelter-1" />);
    view.rerender(<ShelterDetail accessToken="token" api={api} organizationId="organization-b" shelterId="shelter-1" />);
    await act(async () => { second.resolve({ ...shelter(null), name: 'Organization B shelter' }); });
    expect(await screen.findByRole('heading', { name: 'Organization B shelter' })).toBeTruthy();
    await act(async () => { first.resolve({ ...shelter(null), name: 'Organization A shelter' }); });
    expect(screen.queryByRole('heading', { name: 'Organization A shelter' })).toBeNull();
  });
});
