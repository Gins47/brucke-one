// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./shelter-dashboard-map', () => {
  throw new Error('Leaflet module failed to load');
});

import { ShelterDashboardMapPanel } from './shelter-dashboard-map-panel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ShelterDashboardMapPanel', () => {
  it('uses shelter-list wording when the browser-only map module fails', async () => {
    render(
      <ShelterDashboardMapPanel
        onSelectShelter={() => undefined}
        shelters={[
          {
            shelterId: 'shelter-1',
            shelterCode: 'MUC-001',
            name: 'Munich Hall',
            address: 'Example Street 1',
            latitude: 48.1351,
            longitude: 11.582,
            status: 'availability-not-reported',
            availablePlaces: null,
          },
        ]}
      />,
    );

    expect((await screen.findByRole('status')).textContent).toBe(
      'The map is unavailable. Shelter details remain available in the shelter list below.',
    );
  });
});
