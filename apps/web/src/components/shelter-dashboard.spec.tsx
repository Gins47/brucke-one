// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient, DashboardShelter } from '../lib/api-client';
import { ShelterDashboard } from './shelter-dashboard';

vi.mock('./maps/shelter-dashboard-map-panel', () => ({
  ShelterDashboardMapPanel: ({
    shelters,
    onSelectShelter,
  }: {
    shelters: Array<{ shelterId: string; status: string }>;
    onSelectShelter: (shelterId: string, trigger: HTMLElement | null) => void;
  }) => (
    <div>
      {shelters.map((shelter) => (
        <button
          key={shelter.shelterId}
          onClick={(event) => onSelectShelter(shelter.shelterId, event.currentTarget)}
          type="button"
        >
          Map marker: {shelter.status}
        </button>
      ))}
    </div>
  ),
}));

const reported: DashboardShelter = {
  id: 'one',
  shelterCode: 'ONE',
  name: 'Reported shelter',
  address: 'One Street',
  countryCode: 'DE',
  latitude: 48.1,
  longitude: 11.5,
  capacity: 100,
  contactEmail: 'shelter@example.org',
  contactPhone: '+491234567',
  activeActivation: {
    id: 'activation-one',
    activatedAt: '2026-10-25T10:00:00Z',
    operation: {
      id: 'operation-one',
      operationCode: 'OP-1',
      name: 'Flood response',
      status: 'ACTIVE',
    },
    availability: {
      operationalCapacity: 80,
      currentOccupancy: 20,
      reservedPlaces: 10,
      availablePlaces: 50,
      acceptingArrivals: true,
      availabilityNote: 'Use the south entrance',
      reportedAt: '2026-10-25T10:00:00Z',
    },
  },
};
const unreported: DashboardShelter = {
  ...reported,
  id: 'two',
  shelterCode: 'TWO',
  name: 'Unreported shelter',
  activeActivation: { ...reported.activeActivation!, id: 'activation-two', availability: null },
};
const inactive: DashboardShelter = {
  ...reported,
  id: 'three',
  shelterCode: 'THREE',
  name: 'Inactive shelter',
  activeActivation: null,
};

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ShelterDashboard', () => {
  it('totals only reported active availability and marks missing availability clearly', async () => {
    const api = {
      getOrganizationShelters: vi.fn().mockResolvedValue([reported, unreported, inactive]),
    } as unknown as ApiClient;

    render(<ShelterDashboard accessToken="token" api={api} organizationId="org" />);

    expect(await screen.findByText('Reported operational capacity')).toBeTruthy();
    expect(screen.getAllByText('80').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Totals exclude 1 active shelter with availability not reported.'),
    ).toBeTruthy();
    expect(screen.getAllByText('Availability not reported').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No active operation').length).toBeGreaterThan(0);
  });

  it('opens the correct quick view from a map marker and shows only reported values', async () => {
    const api = {
      getOrganizationShelters: vi.fn().mockResolvedValue([reported, unreported]),
    } as unknown as ApiClient;

    render(<ShelterDashboard accessToken="token" api={api} organizationId="org" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Map marker: accepting-arrivals' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.querySelector('#shelter-quick-title')?.textContent).toBe('Reported shelter');
    expect(screen.getByText('shelter@example.org')).toBeTruthy();
    expect(screen.getByText('Use the south entrance')).toBeTruthy();
  });

  it('restores focus to the trigger after closing the native quick view', async () => {
    const api = {
      getOrganizationShelters: vi.fn().mockResolvedValue([reported]),
    } as unknown as ApiClient;

    render(<ShelterDashboard accessToken="token" api={api} organizationId="org" />);

    const trigger = await screen.findByRole('button', { name: 'Details' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('renders a narrow-screen card with unknown values instead of fabricated capacity', async () => {
    const api = {
      getOrganizationShelters: vi.fn().mockResolvedValue([unreported, inactive]),
    } as unknown as ApiClient;

    const { container } = render(
      <ShelterDashboard accessToken="token" api={api} organizationId="org" />,
    );

    expect((await screen.findAllByText('Unreported shelter')).length).toBeGreaterThan(0);
    expect(container.querySelector('ul.md\\:hidden')).toBeTruthy();
    expect(screen.getAllByText('Availability not reported').length).toBeGreaterThan(0);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('Operational capacity: 0')).toBeNull();
  });
});
