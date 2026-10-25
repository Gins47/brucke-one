'use client';

import {
  Component,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import type { DashboardOperationMap } from '@/lib/api-client';

type MappedShelters = DashboardOperationMap['activeShelters'];
type OperationMapComponent = ComponentType<{
  shelters: MappedShelters;
  onUnavailable: () => void;
  onSelectShelter?: (shelter: MappedShelters[number]) => void;
}>;

type MapErrorBoundaryProps = {
  children: ReactNode;
  onUnavailable: () => void;
};

/** Catches a failed browser-only Leaflet module and switches to the map fallback. */
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

/** Shows the map only when the API supplies active shelters with coordinates. */
export function OperationMapPanel({
  shelters,
  onSelectShelter,
}: {
  shelters: DashboardOperationMap['activeShelters'];
  onSelectShelter?: (shelter: MappedShelters[number]) => void;
}) {
  if (shelters.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
        No active shelters have complete coordinates to display on the map.
      </p>
    );
  }

  return (
    <MapLoader
      key={shelters.map((shelter) => shelter.shelterId).join(',')}
      shelters={shelters}
      onSelectShelter={onSelectShelter}
    />
  );
}

/** Loads the browser-only map for the current shelters and displays its fallback states. */
function MapLoader({ shelters, onSelectShelter }: { shelters: MappedShelters; onSelectShelter?: (shelter: MappedShelters[number]) => void }) {
  const [MapComponent, setMapComponent] = useState<OperationMapComponent | null>(
    null,
  );
  const [isUnavailable, setIsUnavailable] = useState(false);

  /** Loads Leaflet in the browser and exposes a fallback if its module cannot load. */
  useEffect(() => {
    let isCurrentRequest = true;

    void import('./operation-map')
      .then((module) => {
        if (isCurrentRequest) {
          setMapComponent(() => module.OperationMap);
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
        The map is unavailable. Shelter details remain available in the Shelters tab.
      </p>
    );
  }

  if (!MapComponent) {
    return <p className="text-slate-600">Loading map…</p>;
  }

  return (
    <MapErrorBoundary onUnavailable={() => setIsUnavailable(true)}>
      <MapComponent
        onUnavailable={() => setIsUnavailable(true)}
        onSelectShelter={onSelectShelter}
        shelters={shelters}
      />
    </MapErrorBoundary>
  );
}
