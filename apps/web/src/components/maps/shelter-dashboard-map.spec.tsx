// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const markerProps: Array<Record<string, unknown>> = [];

vi.mock('react-leaflet', () => ({
  CircleMarker: ({
    children,
    eventHandlers,
    ...props
  }: {
    children: ReactNode;
    eventHandlers?: {
      click?: (event: { target: { getElement: () => HTMLElement } }) => void;
    };
    [key: string]: unknown;
  }) => {
    markerProps.push({ ...props, eventHandlers });
    return (
      <div
        data-testid="shelter-marker"
        onClick={() => {
          eventHandlers?.click?.({
            target: { getElement: () => document.activeElement as HTMLElement },
          });
        }}
      >
        {children}
      </div>
    );
  },
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => <div>OpenStreetMap tiles</div>,
  useMap: () => ({ fitBounds: vi.fn() }),
}));

import { ShelterDashboardMap } from './shelter-dashboard-map';

afterEach(() => {
  cleanup();
  markerProps.length = 0;
});

describe('ShelterDashboardMap', () => {
  it('renders each real shelter status with a distinct public label and marker colour', () => {
    render(
      <ShelterDashboardMap
        onSelectShelter={() => undefined}
        onUnavailable={() => undefined}
        shelters={[
          { shelterId: 'one', shelterCode: 'ONE', name: 'Open', address: 'One Street', latitude: 48.1, longitude: 11.5, status: 'accepting-arrivals', availablePlaces: 12 },
          { shelterId: 'two', shelterCode: 'TWO', name: 'Closed', address: 'Two Street', latitude: 48.2, longitude: 11.6, status: 'not-accepting-arrivals', availablePlaces: 0 },
          { shelterId: 'three', shelterCode: 'THREE', name: 'Unreported', address: 'Three Street', latitude: 48.3, longitude: 11.7, status: 'availability-not-reported', availablePlaces: null },
          { shelterId: 'four', shelterCode: 'FOUR', name: 'Inactive', address: 'Four Street', latitude: 48.4, longitude: 11.8, status: 'no-active-operation', availablePlaces: null },
        ]}
      />,
    );

    expect(screen.getByText('Status: Accepting arrivals')).toBeTruthy();
    expect(screen.getByText('Status: Not accepting arrivals')).toBeTruthy();
    expect(screen.getByText('Status: Availability not reported')).toBeTruthy();
    expect(screen.getByText('Status: No active operation')).toBeTruthy();
    expect(screen.getByText('Available places: 12')).toBeTruthy();
    expect(screen.queryByText('Available places: Availability not reported')).toBeNull();
    expect(new Set(markerProps.map((marker) => marker.fillColor)).size).toBe(4);
  });

  it('opens the selected shelter from a map marker', () => {
    const onSelectShelter = vi.fn();
    render(
      <ShelterDashboardMap
        onSelectShelter={onSelectShelter}
        onUnavailable={() => undefined}
        shelters={[
          { shelterId: 'one', shelterCode: 'ONE', name: 'Open', address: 'One Street', latitude: 48.1, longitude: 11.5, status: 'accepting-arrivals', availablePlaces: 12 },
        ]}
      />,
    );

    fireEvent.click(screen.getByTestId('shelter-marker'));

    expect(onSelectShelter).toHaveBeenCalledWith('one', expect.any(HTMLElement));
  });
});
