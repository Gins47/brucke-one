'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ApiError,
  type ApiClient,
  type DashboardShelter,
  type ShelterAvailability,
} from '../lib/api-client';
import {
  ShelterDashboardMapPanel,
} from './maps/shelter-dashboard-map-panel';
import type {
  ShelterDashboardMapMarker,
  ShelterDashboardMarkerStatus,
} from './maps/shelter-dashboard-map';

type ShelterDashboardProps = {
  accessToken: string;
  organizationId: string;
  api: ApiClient;
};

type ShelterDashboardState = {
  status: 'loading' | 'error' | 'ready';
  shelters: DashboardShelter[];
};

/** Displays the selected organization's shelter readiness without treating missing reports as zero. */
export function ShelterDashboard({
  accessToken,
  organizationId,
  api,
}: ShelterDashboardProps) {
  const [state, setState] = useState<ShelterDashboardState>({
    status: 'loading',
    shelters: [],
  });
  const [selectedShelter, setSelectedShelter] = useState<DashboardShelter | null>(
    null,
  );
  const triggerRef = useRef<HTMLElement | null>(null);

  /** Loads the selected organization's stable shelter contexts. */
  useEffect(() => {
    const controller = new AbortController();

    void api
      .getOrganizationShelters(accessToken, organizationId, controller.signal)
      .then((shelters) => {
        if (!controller.signal.aborted) {
          setState({ status: 'ready', shelters });
        }
      })
      .catch((error: unknown) => {
        if (
          !controller.signal.aborted &&
          !(error instanceof ApiError && error.status === 401)
        ) {
          setState({ status: 'error', shelters: [] });
        }
      });

    return () => controller.abort();
  }, [accessToken, api, organizationId]);

  /** Opens the quick view and keeps the actual trigger for focus restoration. */
  const openQuickView = (
    shelter: DashboardShelter,
    trigger: HTMLElement | null,
  ) => {
    triggerRef.current = trigger;
    setSelectedShelter(shelter);
  };

  /** Closes the quick view and returns focus to its still-mounted trigger. */
  const closeQuickView = () => {
    setSelectedShelter(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  if (state.status === 'loading') {
    return <p className="mt-8 text-slate-600">Loading shelter readiness…</p>;
  }

  if (state.status === 'error') {
    return (
      <p className="mt-8 text-red-700" role="alert">
        Unable to load shelter readiness.
      </p>
    );
  }

  return (
    <ShelterDashboardContent
      onCloseQuickView={closeQuickView}
      onOpenQuickView={openQuickView}
      selectedShelter={selectedShelter}
      shelters={state.shelters}
    />
  );
}

/** Renders readiness summaries, follow-up items, map, and shelter list. */
function ShelterDashboardContent({
  shelters,
  selectedShelter,
  onOpenQuickView,
  onCloseQuickView,
}: {
  shelters: DashboardShelter[];
  selectedShelter: DashboardShelter | null;
  onOpenQuickView: (shelter: DashboardShelter, trigger: HTMLElement | null) => void;
  onCloseQuickView: () => void;
}) {
  const activeShelters = shelters.filter((shelter) => shelter.activeActivation);
  const reportedShelters = activeShelters.filter(
    (shelter) => shelter.activeActivation?.availability,
  );
  const totals = reportedShelters.reduce(
    (sum, shelter) => {
      const availability = shelter.activeActivation!.availability!;

      return {
        capacity: sum.capacity + availability.operationalCapacity,
        occupied: sum.occupied + availability.currentOccupancy,
        reserved: sum.reserved + availability.reservedPlaces,
        available: sum.available + availability.availablePlaces,
      };
    },
    { capacity: 0, occupied: 0, reserved: 0, available: 0 },
  );
  const attentionShelters = activeShelters.filter(
    (shelter) =>
      !shelter.activeActivation!.availability ||
      !shelter.activeActivation!.availability!.acceptingArrivals ||
      shelter.activeActivation!.availability!.availablePlaces === 0,
  );
  const mapShelters = shelters
    .filter(
      (shelter) => shelter.latitude !== null && shelter.longitude !== null,
    )
    .map(toShelterMapMarker);
  const sheltersMissingLocations = shelters.filter(
    (shelter) => shelter.latitude === null || shelter.longitude === null,
  );

  /** Opens a map-selected shelter using the real marker element when available. */
  const openMapShelter = (shelterId: string, trigger: HTMLElement | null) => {
    const shelter = shelters.find((item) => item.id === shelterId);

    if (shelter) {
      onOpenQuickView(shelter, trigger);
    }
  };

  return (
    <div className="mt-8 space-y-8">
      <section
        aria-label="Shelter readiness summary"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric label="Total shelters" note="Registered shelters" value={String(shelters.length)} />
        <Metric
          label="Active shelters"
          note={`${activeShelters.length} currently supporting an operation`}
          value={String(activeShelters.length)}
        />
        <Metric
          label="Reported operational capacity"
          note={
            reportedShelters.length
              ? 'Across reported active shelters'
              : 'No availability reported'
          }
          value={reportedShelters.length ? String(totals.capacity) : '—'}
        />
        <Metric
          label="Available places"
          note={
            reportedShelters.length
              ? 'Ready for confirmed arrivals'
              : 'No availability reported'
          }
          value={reportedShelters.length ? String(totals.available) : '—'}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <AvailabilityPanel
          missing={activeShelters.length - reportedShelters.length}
          reportedCount={reportedShelters.length}
          totals={totals}
        />
        <AttentionPanel
          items={attentionShelters}
          onOpenQuickView={onOpenQuickView}
        />
      </section>

      <section
        aria-labelledby="shelter-map-title"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-xl font-bold text-slate-950" id="shelter-map-title">
          Shelter map
        </h2>
        <p className="mt-2 text-slate-600">
          Shelters with complete coordinates. The shelter list below remains
          available if the map is unavailable.
        </p>
        <div className="mt-4">
          <ShelterDashboardMapPanel
            onSelectShelter={openMapShelter}
            shelters={mapShelters}
          />
        </div>
        {sheltersMissingLocations.length > 0 && (
          <p className="mt-3 rounded-md bg-amber-50 p-3 text-amber-900">
            Location unavailable for:{' '}
            {sheltersMissingLocations.map((shelter) => shelter.name).join(', ')}
          </p>
        )}
      </section>

      <ShelterList shelters={shelters} onOpenQuickView={onOpenQuickView} />
      <ShelterQuickView
        onClose={onCloseQuickView}
        shelter={selectedShelter}
      />
    </div>
  );
}

/** Maps only real selected-organization shelter fields to a map marker. */
function toShelterMapMarker(shelter: DashboardShelter): ShelterDashboardMapMarker {
  return {
    shelterId: shelter.id,
    shelterCode: shelter.shelterCode,
    name: shelter.name,
    address: shelter.address,
    latitude: shelter.latitude!,
    longitude: shelter.longitude!,
    status: getShelterStatus(shelter),
    availablePlaces: shelter.activeActivation?.availability?.availablePlaces ?? null,
  };
}

/** Renders one non-interactive factual metric card. */
function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="min-h-36 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{note}</p>
    </article>
  );
}

/** Presents only reported active-shelter totals and their text equivalents. */
function AvailabilityPanel({
  totals,
  missing,
  reportedCount,
}: {
  totals: { capacity: number; occupied: number; reserved: number; available: number };
  missing: number;
  reportedCount: number;
}) {
  if (!reportedCount) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-2">
        <h2 className="text-xl font-bold">Shelter availability</h2>
        <p className="mt-2 text-slate-600">
          Reported capacity across active shelters
        </p>
        <p className="mt-6 rounded-md bg-slate-50 p-4 text-slate-700">
          No active shelter has reported availability.
        </p>
      </section>
    );
  }

  const percent = (value: number) =>
    `${totals.capacity ? Math.round((value / totals.capacity) * 100) : 0}%`;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-2">
      <h2 className="text-xl font-bold">Shelter availability</h2>
      <p className="mt-2 text-slate-600">
        Reported capacity across active shelters
      </p>
      <div
        aria-label={`${totals.occupied} occupied, ${totals.reserved} expected, ${totals.available} available of ${totals.capacity} places`}
        className="mt-6 flex h-8 overflow-hidden rounded-full bg-slate-100"
      >
        <span className="bg-slate-700" style={{ width: percent(totals.occupied) }} />
        <span className="bg-amber-400" style={{ width: percent(totals.reserved) }} />
        <span className="bg-emerald-600" style={{ width: percent(totals.available) }} />
      </div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <p>
          <b>Occupied places:</b> {totals.occupied} ({percent(totals.occupied)})
        </p>
        <p>
          <b>Expected arrivals:</b> {totals.reserved} ({percent(totals.reserved)})
        </p>
        <p>
          <b>Available places:</b> {totals.available} ({percent(totals.available)})
        </p>
      </div>
      <p className="mt-4 font-medium text-slate-800">
        {totals.occupied + totals.reserved} of {totals.capacity} places committed ·{' '}
        {totals.available} places currently available
      </p>
      {missing > 0 && (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-amber-900">
          Totals exclude {missing} active shelter{missing === 1 ? '' : 's'} with
          availability not reported.
        </p>
      )}
    </section>
  );
}

/** Shows active shelters requiring a report or operational follow-up. */
function AttentionPanel({
  items,
  onOpenQuickView,
}: {
  items: DashboardShelter[];
  onOpenQuickView: (shelter: DashboardShelter, trigger: HTMLElement | null) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-bold">Attention needed</h2>
      {items.length === 0 ? (
        <p className="mt-5 text-slate-600">No shelters need follow-up right now.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((shelter) => (
            <li key={shelter.id}>
              <button
                className="w-full rounded-md border border-slate-200 p-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-700"
                onClick={(event) => onOpenQuickView(shelter, event.currentTarget)}
                type="button"
              >
                <b>{shelter.name}</b>
                <br />
                <StatusPill shelter={shelter} />
                <span className="ml-2 text-sm text-slate-600">Open details →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Displays a desktop table and a small-screen card list without duplicate controls. */
function ShelterList({
  shelters,
  onOpenQuickView,
}: {
  shelters: DashboardShelter[];
  onOpenQuickView: (shelter: DashboardShelter, trigger: HTMLElement | null) => void;
}) {
  return (
    <section>
      <h2 className="text-xl font-bold">Shelters</h2>
      <p className="mt-1 text-slate-600">
        Select a shelter to view operational details and update availability.{' '}
        {shelters.length} shelters.
      </p>

      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-4">Shelter</th>
              <th className="p-4">Active operation</th>
              <th className="p-4">Operational capacity</th>
              <th className="p-4">Current occupancy</th>
              <th className="p-4">Available places</th>
              <th className="p-4">Status</th>
              <th className="p-4">
                <span className="sr-only">Open quick view</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shelters.map((shelter) => (
              <ShelterTableRow
                key={shelter.id}
                onOpenQuickView={onOpenQuickView}
                shelter={shelter}
              />
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 grid gap-3 md:hidden">
        {shelters.map((shelter) => (
          <ShelterCard
            key={shelter.id}
            onOpenQuickView={onOpenQuickView}
            shelter={shelter}
          />
        ))}
      </ul>
    </section>
  );
}

/** Renders one desktop shelter row with a keyboard-accessible quick-view action. */
function ShelterTableRow({
  shelter,
  onOpenQuickView,
}: {
  shelter: DashboardShelter;
  onOpenQuickView: (shelter: DashboardShelter, trigger: HTMLElement | null) => void;
}) {
  const report = shelter.activeActivation?.availability;

  return (
    <tr className="border-t hover:bg-slate-50">
      <td className="p-4">
        <b>{shelter.name}</b>
        <br />
        <span className="text-slate-600">{shelter.address}</span>
      </td>
      <td className="p-4">{shelter.activeActivation?.operation.name ?? 'No active operation'}</td>
      <td className="p-4">{report?.operationalCapacity ?? '—'}</td>
      <td className="p-4">{report?.currentOccupancy ?? '—'}</td>
      <td className="p-4">{report?.availablePlaces ?? '—'}</td>
      <td className="p-4">
        <StatusPill shelter={shelter} />
      </td>
      <td className="p-4">
        <button
          className="rounded-md px-2 py-1 font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"
          onClick={(event) => onOpenQuickView(shelter, event.currentTarget)}
          type="button"
        >
          Details
        </button>
      </td>
    </tr>
  );
}

/** Renders the mobile shelter alternative with the same truthful values as the table. */
function ShelterCard({
  shelter,
  onOpenQuickView,
}: {
  shelter: DashboardShelter;
  onOpenQuickView: (shelter: DashboardShelter, trigger: HTMLElement | null) => void;
}) {
  const report = shelter.activeActivation?.availability;

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-950">{shelter.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{shelter.address}</p>
        </div>
        <StatusPill shelter={shelter} />
      </div>
      <p className="mt-4 text-sm text-slate-700">
        <b>Active operation:</b>{' '}
        {shelter.activeActivation?.operation.name ?? 'No active operation'}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <MetricValue label="Operational capacity" value={report?.operationalCapacity ?? '—'} />
        <MetricValue label="Current occupancy" value={report?.currentOccupancy ?? '—'} />
        <MetricValue label="Available places" value={report?.availablePlaces ?? '—'} />
      </dl>
      <button
        className="mt-5 rounded-md border border-blue-700 px-3 py-2 text-sm font-semibold text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        onClick={(event) => onOpenQuickView(shelter, event.currentTarget)}
        type="button"
      >
        Open quick view
      </button>
    </li>
  );
}

/** Renders one compact operational value without converting unknown data to zero. */
function MetricValue({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-slate-600">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

/** Derives the shelter marker and pill state from the current active context only. */
function getShelterStatus(shelter: DashboardShelter): ShelterDashboardMarkerStatus {
  if (!shelter.activeActivation) {
    return 'no-active-operation';
  }

  if (!shelter.activeActivation.availability) {
    return 'availability-not-reported';
  }

  return shelter.activeActivation.availability.acceptingArrivals
    ? 'accepting-arrivals'
    : 'not-accepting-arrivals';
}

/** Renders a text status that stays meaningful without its accompanying colour. */
function StatusPill({ shelter }: { shelter: DashboardShelter }) {
  const status = getShelterStatus(shelter);
  const presentation: Record<ShelterDashboardMarkerStatus, { label: string; color: string }> = {
    'accepting-arrivals': {
      label: 'Accepting arrivals',
      color: 'bg-emerald-100 text-emerald-800',
    },
    'not-accepting-arrivals': {
      label: 'Not accepting arrivals',
      color: 'bg-amber-100 text-amber-900',
    },
    'availability-not-reported': {
      label: 'Availability not reported',
      color: 'bg-red-100 text-red-800',
    },
    'no-active-operation': {
      label: 'No active operation',
      color: 'bg-slate-200 text-slate-800',
    },
  };
  const { label, color } = presentation[status];

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}

/** Uses a native dialog for quick details and restores focus to the original trigger. */
function ShelterQuickView({
  shelter,
  onClose,
}: {
  shelter: DashboardShelter | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (shelter && !dialog.current?.open) {
      dialog.current?.showModal();
    }
  }, [shelter]);

  if (!shelter) {
    return null;
  }

  const report = shelter.activeActivation?.availability;

  return (
    <dialog
      aria-describedby="shelter-quick-description"
      aria-labelledby="shelter-quick-title"
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-xl rounded-xl p-0 shadow-xl backdrop:bg-slate-950/50"
      onClose={onClose}
      ref={dialog}
    >
      <section className="p-6">
        <h2 className="text-2xl font-bold" id="shelter-quick-title">
          {shelter.name}
        </h2>
        <p className="mt-1 text-slate-600" id="shelter-quick-description">
          {shelter.shelterCode} · {shelter.address}
        </p>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <QuickViewValue label="Physical capacity" value={shelter.capacity} />
          <QuickViewValue label="Contact email" value={shelter.contactEmail ?? 'Not provided'} />
          <QuickViewValue label="Contact phone" value={shelter.contactPhone ?? 'Not provided'} />
          <QuickViewValue
            label="Active operation"
            value={
              shelter.activeActivation
                ? `${shelter.activeActivation.operation.name} · ${shelter.activeActivation.operation.status}`
                : 'No active operation'
            }
          />
          {report ? <ReportedAvailabilityValues report={report} /> : (
            <QuickViewValue
              label="Availability"
              value={
                shelter.activeActivation
                  ? 'Availability not reported'
                  : '—'
              }
            />
          )}
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            href={`/shelters/${shelter.id}`}
          >
            View shelter details
          </Link>
          <button
            className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            onClick={() => dialog.current?.close()}
            type="button"
          >
            Close
          </button>
        </div>
      </section>
    </dialog>
  );
}

/** Renders the availability fields shown only when a report exists. */
function ReportedAvailabilityValues({ report }: { report: ShelterAvailability }) {
  return (
    <>
      <QuickViewValue label="Operational capacity" value={report.operationalCapacity} />
      <QuickViewValue label="Current occupancy" value={report.currentOccupancy} />
      <QuickViewValue label="Expected arrivals" value={report.reservedPlaces} />
      <QuickViewValue label="Available places" value={report.availablePlaces} />
      <QuickViewValue
        label="Arrival status"
        value={report.acceptingArrivals ? 'Accepting arrivals' : 'Not accepting arrivals'}
      />
      <QuickViewValue
        label="Availability note"
        value={report.availabilityNote ?? '—'}
      />
      <QuickViewValue
        label="Availability reported"
        value={new Date(report.reportedAt).toLocaleString()}
      />
    </>
  );
}

/** Renders a labelled value in the quick-view modal. */
function QuickViewValue({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="font-semibold text-slate-600">{label}</dt>
      <dd className="mt-1 text-slate-950">{value}</dd>
    </div>
  );
}
