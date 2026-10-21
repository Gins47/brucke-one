// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fitBounds = vi.fn();

vi.mock('react-leaflet', () => ({
  CircleMarker: ({ children }: { children: ReactNode }) => (
    <div data-testid="shelter-marker">{children}</div>
  ),
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => <div>OpenStreetMap tiles</div>,
  useMap: () => ({ fitBounds }),
}));

import { OperationMap } from './operation-map';

afterEach(cleanup);

describe('OperationMap', () => {
  it('passes every mapped shelter to a marker with its popup details', () => {
    render(
      <OperationMap
        shelters={[
          {
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
          },
        ]}
      />,
    );

    expect(screen.getAllByTestId('shelter-marker')).toHaveLength(1);
    expect(screen.getByText('Munich Hall')).toBeTruthy();
    expect(screen.getByTestId('shelter-marker').textContent).toContain(
      'See the Shelters tab for details.',
    );
    expect(fitBounds).toHaveBeenCalledOnce();
  });
});
