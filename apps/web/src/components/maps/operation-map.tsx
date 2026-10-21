'use client';

import { useEffect } from 'react';
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import type { DashboardOperationMap } from '@/lib/api-client';

type MappedShelter = DashboardOperationMap['activeShelters'][number];

/** Renders active shelters with coordinates on an OpenStreetMap base layer. */
export function OperationMap({ shelters }: { shelters: MappedShelter[] }) {
  const firstShelter = shelters[0];

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
            See the Shelters tab for details.
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
