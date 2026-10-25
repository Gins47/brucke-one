'use client';

import { Component, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import type { ShelterDashboardMapMarker } from './shelter-dashboard-map';

type ShelterDashboardMapComponent = ComponentType<{
  shelters: ShelterDashboardMapMarker[];
  onSelectShelter: (shelterId: string, trigger: HTMLElement | null) => void;
  onUnavailable: () => void;
}>;

type MapErrorBoundaryProps = {
  children: ReactNode;
  onUnavailable: () => void;
};

/** Catches a failed browser-only Leaflet module and shows the shelter-list fallback. */
class MapErrorBoundary extends Component<
  MapErrorBoundaryProps,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onUnavailable();
  }

  render(): ReactNode {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Loads the organization shelter map without changing operation-map behaviour. */
export function ShelterDashboardMapPanel({
  shelters,
  onSelectShelter,
}: {
  shelters: ShelterDashboardMapMarker[];
  onSelectShelter: (shelterId: string, trigger: HTMLElement | null) => void;
}) {
  if (shelters.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
        No shelters have complete coordinates to display on the map.
      </p>
    );
  }

  return (
    <ShelterDashboardMapLoader
      key={shelters.map((shelter) => shelter.shelterId).join(',')}
      onSelectShelter={onSelectShelter}
      shelters={shelters}
    />
  );
}

/** Loads the browser-only shelter map and presents a context-specific fallback. */
function ShelterDashboardMapLoader({
  shelters,
  onSelectShelter,
}: {
  shelters: ShelterDashboardMapMarker[];
  onSelectShelter: (shelterId: string, trigger: HTMLElement | null) => void;
}) {
  const [MapComponent, setMapComponent] = useState<ShelterDashboardMapComponent | null>(
    null,
  );
  const [isUnavailable, setIsUnavailable] = useState(false);

  useEffect(() => {
    let isCurrentRequest = true;

    void import('./shelter-dashboard-map')
      .then((module) => {
        if (isCurrentRequest) {
          setMapComponent(() => module.ShelterDashboardMap);
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setIsUnavailable(true);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  if (isUnavailable) {
    return (
      <p
        className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-600"
        role="status"
      >
        The map is unavailable. Shelter details remain available in the shelter list below.
      </p>
    );
  }

  if (!MapComponent) {
    return <p className="text-slate-600">Loading map…</p>;
  }

  return (
    <MapErrorBoundary onUnavailable={() => setIsUnavailable(true)}>
      <MapComponent
        onSelectShelter={onSelectShelter}
        onUnavailable={() => setIsUnavailable(true)}
        shelters={shelters}
      />
    </MapErrorBoundary>
  );
}
