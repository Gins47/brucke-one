'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { OperationMapPanel } from './maps/operation-map-panel';
import {
  ApiError,
  type ApiClient,
  type DashboardOperationMap,
} from '../lib/api-client';

type DetailState = {
  status: 'loading' | 'error' | 'not-found' | 'organization-mismatch' | 'ready';
  data: DashboardOperationMap | null;
};

const detailTabs = [
  { id: 'shelters', label: 'Shelters' },
  { id: 'teams', label: 'Operations teams' },
  { id: 'people', label: 'People seeking help' },
  { id: 'support', label: 'Support units' },
  { id: 'approvals', label: 'Approvals' },
] as const;

type DetailTab = (typeof detailTabs)[number]['id'];

/** Loads and displays a selected operation only when it belongs to the current organization. */
export function OperationDetail({
  accessToken,
  api,
  operationId,
  organizationId,
}: {
  accessToken: string;
  api: ApiClient;
  operationId: string;
  organizationId: string;
}) {
  const [state, setState] = useState<DetailState>({
    status: 'loading',
    data: null,
  });
  const [activeTab, setActiveTab] = useState<DetailTab>('shelters');

  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;

    void api
      .getEmergencyOperationMap(accessToken, operationId, controller.signal)
      .then((data) => {
        if (!isCurrentRequest) {
          return;
        }

        if (data.operation.organizationId !== organizationId) {
          setState({ status: 'organization-mismatch', data: null });
          return;
        }

        setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!isCurrentRequest || controller.signal.aborted) {
          return;
        }

        setState({
          status:
            error instanceof ApiError && error.status === 404
              ? 'not-found'
              : 'error',
          data: null,
        });
      });

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [accessToken, api, operationId, organizationId]);

  if (state.status === 'loading') {
    return <p className="mt-8 text-slate-600">Loading operation details…</p>;
  }

  if (state.status === 'not-found') {
    return <p className="mt-8 text-slate-600">This operation was not found.</p>;
  }

  if (state.status === 'organization-mismatch') {
    return (
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-950">Operation not in selected organization</h2>
        <p className="mt-2 text-slate-600">
          Select the organization that owns this operation to view its details.
        </p>
        <Link className="mt-4 inline-block font-semibold text-blue-700" href="/operations">
          Return to operations
        </Link>
      </section>
    );
  }

  if (state.status === 'error' || !state.data) {
    return <p className="mt-8 text-red-700" role="alert">Unable to load operation details.</p>;
  }

  const { operation, affectedRegions, activeShelters, unmappedActiveShelterCount } =
    state.data;
  const totalActiveShelters =
    activeShelters.length + unmappedActiveShelterCount;

  return (
    <section className="mt-8 space-y-8">
      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-blue-700">{operation.operationCode}</p>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-800">
            {operation.status}
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          {operation.name}
        </h1>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Status" value={operation.status} />
          <Detail label="Type" value={operation.type} />
          <Detail label="Severity" value={operation.severity} />
          <Detail label="Country" value={operation.countryCode} />
          <Detail label="Started" value={formatDate(operation.startedAt)} />
          <Detail label="Ended" value={formatDate(operation.endedAt)} />
          <Detail label="Last updated" value={formatDate(operation.updatedAt)} />
        </dl>
      </article>

      <section aria-labelledby="shelters-heading">
        <h2 className="text-xl font-bold text-slate-950" id="shelters-heading">
          Active shelters
        </h2>
        <p className="mt-2 text-slate-600">
          {unmappedActiveShelterCount > 0
            ? `${unmappedActiveShelterCount} active shelter${unmappedActiveShelterCount === 1 ? '' : 's'} ${unmappedActiveShelterCount === 1 ? 'lacks' : 'lack'} complete location data.`
            : 'All active shelters have complete location data.'}
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <OperationMapPanel shelters={activeShelters} />
          <aside className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-bold text-slate-950">Weather</h3>
            <p className="mt-3 text-slate-600">Weather integration coming later.</p>
          </aside>
        </div>
      </section>

      <section aria-labelledby="detail-tabs-heading">
        <h2 className="sr-only" id="detail-tabs-heading">Operation details</h2>
        <div aria-label="Operation detail sections" className="flex gap-2 overflow-x-auto border-b border-slate-200" role="tablist">
          {detailTabs.map((tab) => (
            <button
              aria-controls={`${tab.id}-panel`}
              aria-selected={activeTab === tab.id}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold ${
                activeTab === tab.id
                  ? 'border-blue-700 text-blue-800'
                  : 'border-transparent text-slate-600 hover:text-slate-950'
              }`}
              id={`${tab.id}-tab`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div
          aria-labelledby={`${activeTab}-tab`}
          className="pt-5"
          id={`${activeTab}-panel`}
          role="tabpanel"
        >
          {activeTab === 'shelters' ? (
            <SheltersTab
              shelters={activeShelters}
              totalActiveShelters={totalActiveShelters}
              unmappedActiveShelterCount={unmappedActiveShelterCount}
            />
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
              Not available yet.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="regions-heading">
        <h2 className="text-xl font-bold text-slate-950" id="regions-heading">Affected regions</h2>
        {affectedRegions.length === 0 ? (
          <p className="mt-3 text-slate-600">No current affected regions are recorded.</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2" role="list">
            {affectedRegions.map((region) => (
              <li className="rounded-lg border border-slate-200 bg-white p-4" key={region.id}>
                <p className="font-semibold text-slate-950">{region.regionName}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {region.countryCode} · {region.regionCode}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

/** Renders one compact operation attribute in the detail summary. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-slate-600">{label}</dt>
      <dd className="mt-1 text-slate-950">{value}</dd>
    </div>
  );
}

/** Displays the only full shelter detail list for this operation. */
function SheltersTab({
  shelters,
  totalActiveShelters,
  unmappedActiveShelterCount,
}: {
  shelters: DashboardOperationMap['activeShelters'];
  totalActiveShelters: number;
  unmappedActiveShelterCount: number;
}) {
  const totalCapacity = shelters.reduce(
    (sum, shelter) => sum + shelter.capacity,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-600">Total shelter capacity</p>
          <p className="mt-2 text-lg font-bold text-slate-950">
            {unmappedActiveShelterCount === 0
              ? totalCapacity
              : `Unavailable for all ${totalActiveShelters} active shelters`}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-600">Occupancy</p>
          <p className="mt-2 text-lg font-bold text-slate-950">Not tracked yet</p>
        </article>
      </div>
      {shelters.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-600">
          No mapped active shelters are available.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold" scope="col">Code</th>
                <th className="px-4 py-3 font-semibold" scope="col">Shelter</th>
                <th className="px-4 py-3 font-semibold" scope="col">Address</th>
                <th className="px-4 py-3 font-semibold" scope="col">Capacity</th>
                <th className="px-4 py-3 font-semibold" scope="col">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {shelters.map((shelter) => (
                <tr key={shelter.shelterId}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium">{shelter.shelterCode}</td>
                  <td className="px-4 py-3">{shelter.name}</td>
                  <td className="px-4 py-3">{shelter.address}</td>
                  <td className="px-4 py-3">{shelter.capacity}</td>
                  <td className="px-4 py-3">
                    {shelter.contactEmail ?? shelter.contactPhone ?? 'Not provided'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Formats an optional API timestamp for the operation summary. */
function formatDate(value: string | null): string {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
