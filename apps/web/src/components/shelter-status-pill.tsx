import type { ShelterDashboardMarkerStatus } from './maps/shelter-dashboard-map';

const presentation: Record<ShelterDashboardMarkerStatus, { label: string; color: string }> = {
  'accepting-arrivals': { label: 'Accepting arrivals', color: 'bg-emerald-100 text-emerald-800' },
  'not-accepting-arrivals': { label: 'Not accepting arrivals', color: 'bg-amber-100 text-amber-900' },
  'availability-not-reported': { label: 'Availability not reported', color: 'bg-red-100 text-red-800' },
  'no-active-operation': { label: 'No active operation', color: 'bg-slate-200 text-slate-800' },
};

/** Displays a shelter status consistently wherever it is shown. */
export function ShelterStatusPill({ status }: { status: ShelterDashboardMarkerStatus }) {
  const { label, color } = presentation[status];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{label}</span>;
}
