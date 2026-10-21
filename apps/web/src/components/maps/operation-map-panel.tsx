'use client';

import dynamic from 'next/dynamic';
import type { DashboardOperationMap } from '@/lib/api-client';

const OperationMap = dynamic(
  () => import('./operation-map').then((module) => module.OperationMap),
  {
    ssr: false,
    loading: () => <p className="text-slate-600">Loading map…</p>,
  },
);

/** Shows the map only when the API supplies active shelters with coordinates. */
export function OperationMapPanel({
  shelters,
}: {
  shelters: DashboardOperationMap['activeShelters'];
}) {
  if (shelters.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
        No active shelters have complete coordinates to display on the map.
      </p>
    );
  }

  return <OperationMap shelters={shelters} />;
}
