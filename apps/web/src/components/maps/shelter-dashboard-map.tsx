'use client';

import { useEffect, useRef } from 'react';
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';

export type ShelterDashboardMarkerStatus =
  | 'accepting-arrivals'
  | 'not-accepting-arrivals'
  | 'availability-not-reported'
  | 'no-active-operation';

export type ShelterDashboardMapMarker = {
  shelterId: string;
  shelterCode: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  status: ShelterDashboardMarkerStatus;
  availablePlaces: number | null;
};

const tileFailureThreshold = 3;

const markerPresentation: Record<
  ShelterDashboardMarkerStatus,
  { color: string; fillColor: string; label: string }
> = {
  'accepting-arrivals': {
    color: '#047857',
    fillColor: '#10b981',
    label: 'Accepting arrivals',
  },
  'not-accepting-arrivals': {
    color: '#b45309',
    fillColor: '#f59e0b',
    label: 'Not accepting arrivals',
  },
  'availability-not-reported': {
    color: '#b91c1c',
    fillColor: '#ef4444',
    label: 'Availability not reported',
  },
  'no-active-operation': {
    color: '#475569',
    fillColor: '#94a3b8',
    label: 'No active operation',
  },
};

/** Renders organization shelters with real readiness states and map coordinates. */
export function ShelterDashboardMap({
  shelters,
  onSelectShelter,
  onUnavailable,
}: {
  shelters: ShelterDashboardMapMarker[];
  onSelectShelter: (shelterId: string, trigger: HTMLElement | null) => void;
  onUnavailable: () => void;
}) {
  const firstShelter = shelters[0];
  const tileFailures = useRef(0);

  /** Shows the fallback only after repeated tile failures. */
  const reportTileFailure = () => {
    tileFailures.current += 1;

    if (tileFailures.current === tileFailureThreshold) {
      onUnavailable();
    }
  };

  return (
    <MapContainer
      aria-label="Map of organization shelters"
      center={[firstShelter.latitude, firstShelter.longitude]}
      className="h-96 w-full rounded-xl"
      scrollWheelZoom
      zoom={12}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        eventHandlers={{ tileerror: reportTileFailure }}
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ShelterMapBounds shelters={shelters} />
      {shelters.map((shelter) => {
        const presentation = markerPresentation[shelter.status];

        return (
          <CircleMarker
            center={[shelter.latitude, shelter.longitude]}
            color={presentation.color}
            eventHandlers={{
              click: (event) =>
                onSelectShelter(
                  shelter.shelterId,
                  event.target.getElement() as HTMLElement | null,
                ),
            }}
            fillColor={presentation.fillColor}
            fillOpacity={0.85}
            key={shelter.shelterId}
            radius={9}
          >
            <Popup>
              <strong>{shelter.name}</strong>
              <br />
              {shelter.address}
              <br />
              <span>Status: {presentation.label}</span>
              {shelter.availablePlaces !== null && (
                <>
                  <br />
                  <span>Available places: {shelter.availablePlaces}</span>
                </>
              )}
              <br />
              <button
                onClick={() => onSelectShelter(shelter.shelterId, null)}
                type="button"
              >
                View details
              </button>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

/** Keeps all organization-shelter markers visible after map initialization. */
function ShelterMapBounds({ shelters }: { shelters: ShelterDashboardMapMarker[] }) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(
      shelters.map((shelter) => [shelter.latitude, shelter.longitude]),
      { maxZoom: 14, padding: [24, 24] },
    );
  }, [map, shelters]);

  return null;
}
