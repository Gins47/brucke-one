'use client';

import { useEffect, useRef } from 'react';
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import type { DashboardOperationMap } from '@/lib/api-client';

type MappedShelter = DashboardOperationMap['activeShelters'][number];
const tileFailureThreshold = 3;

/** Renders active shelters with coordinates on an OpenStreetMap base layer. */
export function OperationMap({
  shelters,
  onUnavailable,
  onSelectShelter,
}: {
  shelters: MappedShelter[];
  onUnavailable: () => void;
  onSelectShelter?: (shelter: MappedShelter) => void;
}) {
  const firstShelter = shelters[0];
  const tileFailures = useRef(0);

  /** Reports a map outage only after several tiles fail, avoiding a fallback for one transient tile error. */
  const reportTileFailure = () => {
    tileFailures.current += 1;

    if (tileFailures.current === tileFailureThreshold) {
      onUnavailable();
    }
  };

  return (
    <MapContainer
      aria-label="Map of active shelters"
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
      <MapBounds shelters={shelters} />
      {shelters.map((shelter) => (
        <CircleMarker
          center={[shelter.latitude, shelter.longitude]}
          color="#1d4ed8"
          fillColor="#2563eb"
          fillOpacity={0.85}
          key={shelter.shelterId}
          radius={9}
        >
          <Popup>
            <strong>{shelter.name}</strong>
            <br />
            {shelter.shelterCode}
            <br />
            {shelter.availability
              ? `${shelter.availability.availablePlaces} places available`
              : 'Availability not reported'}
            {onSelectShelter && <><br /><button onClick={() => onSelectShelter(shelter)} type="button">View details</button></>}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

/** Keeps every active shelter marker visible after the map initializes. */
function MapBounds({ shelters }: { shelters: MappedShelter[] }) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(
      shelters.map((shelter) => [shelter.latitude, shelter.longitude]),
      { maxZoom: 14, padding: [24, 24] },
    );
  }, [map, shelters]);

  return null;
}
