// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./operation-map', () => {
  throw new Error('Leaflet module failed to load');
});

import { OperationMapPanel } from './operation-map-panel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('OperationMapPanel', () => {
  it('shows a fallback when the browser-only map module fails', async () => {
    render(
      <OperationMapPanel
        shelters={[
          {
            shelterActivationId: 'activation-1',
            shelterId: 'shelter-1',
            shelterCode: 'MUC-001',
            name: 'Munich Hall',
            address: 'Example Street 1',
            countryCode: 'DE',
            latitude: 48.1351,
            longitude: 11.582,
            capacity: 250,
            contactEmail: null,
            contactPhone: null,
            activatedAt: '2026-10-20T10:00:00.000Z',
            availability: null,
          },
        ]}
      />,
    );

    expect((await screen.findByRole('status')).textContent).toContain(
      'The map is unavailable.',
    );
  });
});
