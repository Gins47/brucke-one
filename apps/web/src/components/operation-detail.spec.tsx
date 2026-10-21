// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./maps/operation-map-panel', () => ({
  OperationMapPanel: ({ shelters }: { shelters: unknown[] }) => (
    <p>Map contains {shelters.length} shelter markers.</p>
  ),
}));

import { OperationDetail } from './operation-detail';
import type { ApiClient, DashboardOperationMap } from '@/lib/api-client';

function mapResponse(organizationId: string): DashboardOperationMap {
  return {
    operation: {
      id: 'operation-1',
      organizationId,
      operationCode: 'BAY-FLD-01',
      name: 'Bavaria flood response',
      countryCode: 'DE',
      type: 'FLOOD',
      severity: 'HIGH',
      status: 'ACTIVE',
      startedAt: '2026-10-20T10:00:00.000Z',
      endedAt: null,
      updatedAt: '2026-10-20T11:00:00.000Z',
    },
    affectedRegions: [
      {
        id: 'region-1',
        countryCode: 'DE',
        regionCode: 'DE-BY',
        regionName: 'Bavaria',
        addedAt: '2026-10-20T10:00:00.000Z',
      },
    ],
    activeShelters: [
      {
        shelterId: 'shelter-1',
        shelterCode: 'MUC-001',
        name: 'Munich Hall',
        address: 'Example Street 1',
        countryCode: 'DE',
        latitude: 48.1351,
        longitude: 11.582,
        capacity: 250,
        contactEmail: 'shelter@example.test',
        contactPhone: null,
        activatedAt: '2026-10-20T10:00:00.000Z',
      },
    ],
    unmappedActiveShelterCount: 1,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

afterEach(cleanup);

describe('OperationDetail', () => {
  it('renders map projection details and current regions', async () => {
    const api = {
      getEmergencyOperationMap: vi.fn().mockResolvedValue(mapResponse('organization-a')),
    } as unknown as ApiClient;

    render(
      <OperationDetail
        accessToken="token"
        api={api}
        operationId="operation-1"
        organizationId="organization-a"
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Bavaria flood response' })).toBeTruthy();
    expect(screen.getByText('Bavaria')).toBeTruthy();
    expect(screen.getByText('Munich Hall')).toBeTruthy();
    expect(screen.getByText('Map contains 1 shelter markers.')).toBeTruthy();
    expect(screen.getByText('1 active shelter lacks complete location data.')).toBeTruthy();
    expect(screen.getByText('Weather integration coming later.')).toBeTruthy();
    expect(screen.getByText('Unavailable for all 2 active shelters')).toBeTruthy();
    expect(screen.getByText('Not tracked yet')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Operations teams' }));
    expect(screen.getByText('Not available yet.')).toBeTruthy();
  });

  it('renders empty map and region states', async () => {
    const response = mapResponse('organization-a');
    response.activeShelters = [];
    response.affectedRegions = [];
    response.unmappedActiveShelterCount = 0;
    const api = {
      getEmergencyOperationMap: vi.fn().mockResolvedValue(response),
    } as unknown as ApiClient;

    render(
      <OperationDetail
        accessToken="token"
        api={api}
        operationId="operation-1"
        organizationId="organization-a"
      />,
    );

    expect(await screen.findByText('No mapped active shelters are available.')).toBeTruthy();
    expect(screen.getByText('No current affected regions are recorded.')).toBeTruthy();
    expect(screen.getByText('Not tracked yet')).toBeTruthy();
  });

  it('does not replace the selected organization detail with a late response', async () => {
    const first = deferred<DashboardOperationMap>();
    const second = deferred<DashboardOperationMap>();
    const api = {
      getEmergencyOperationMap: vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise),
    } as unknown as ApiClient;
    const view = render(
      <OperationDetail
        accessToken="token"
        api={api}
        operationId="operation-1"
        organizationId="organization-a"
      />,
    );

    view.rerender(
      <OperationDetail
        accessToken="token"
        api={api}
        operationId="operation-1"
        organizationId="organization-b"
      />,
    );
    await act(async () => {
      second.resolve(mapResponse('organization-b'));
    });
    expect(await screen.findByText('Bavaria flood response')).toBeTruthy();

    await act(async () => {
      const earlierResponse = mapResponse('organization-a');
      earlierResponse.operation.name = 'Earlier organization operation';
      first.resolve(earlierResponse);
    });
    expect(screen.queryByText('Earlier organization operation')).toBeNull();
  });
});
