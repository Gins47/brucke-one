'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type {
  ApiClient,
  Organization,
  OrganizationDashboardOverview,
} from '@/lib/api-client';

type OverviewState = {
  status: 'loading' | 'error' | 'ready';
  data: OrganizationDashboardOverview | null;
};

/** Calculates safe active and inactive shelter values for the chart. */
export function getShelterStatus(total: number, active: number) {
  const safeActive = Math.min(Math.max(active, 0), total);

  return {
    active: safeActive,
    inactive: total - safeActive,
    activePercent: total === 0 ? 0 : Math.round((safeActive / total) * 100),
  };
}

/** Loads and displays the read-only overview for the selected organization. */
export function DashboardOverview({
  accessToken,
  api,
  organization,
}: {
  accessToken: string;
  api: ApiClient;
  organization: Organization;
}) {
  const [state, setState] = useState<OverviewState>({
    status: 'loading',
    data: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;

    void api
      .getOrganizationOverview(accessToken, organization.id, controller.signal)
      .then((data) => {
        if (isCurrentRequest) {
          setState({ status: 'ready', data });
        }
      })
      .catch(() => {
        if (isCurrentRequest && !controller.signal.aborted) {
          setState({ status: 'error', data: null });
        }
      });

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [accessToken, api, organization.id]);

  if (state.status === 'loading') {
    return <p className="mt-8 text-slate-600">Loading dashboard overview…</p>;
  }

  if (state.status === 'error') {
    return (
      <p className="mt-8 text-red-700" role="alert">
        Unable to load the dashboard overview.
      </p>
    );
  }

  if (!state.data) {
    return null;
  }

  const { operationCounts, shelterCount, activeShelterActivationCount } =
    state.data;
  const cards = [
    {
      label: 'Active operations',
      value: operationCounts.active,
      href: '/operations?status=ACTIVE',
    },
    {
      label: 'Planned operations',
      value: operationCounts.planned,
      href: '/operations?status=PLANNED',
    },
    { label: 'Shelters', value: shelterCount, href: '/shelters' },
    { label: 'Active shelters', value: activeShelterActivationCount },
    { label: 'Pending approvals', message: 'Not available yet' },
  ];
  const shelters = getShelterStatus(
    shelterCount,
    activeShelterActivationCount,
  );

  return (
    <section aria-label="Organization overview" className="mt-8 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card, index) => (
          <DashboardCard card={card} index={index} key={card.label} />
        ))}
      </div>

      <article className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">Shelter status</h2>
        <div className="mt-5 flex flex-wrap items-center gap-6">
          <div
            aria-label={`${shelters.active} active shelters and ${shelters.inactive} not-active shelters`}
            className="grid size-32 shrink-0 place-items-center rounded-full"
            role="img"
            style={{
              background: `conic-gradient(#2563eb ${shelters.activePercent}%, #e2e8f0 0)`,
            }}
          >
            <div className="grid size-24 place-items-center rounded-full bg-white text-center">
              <span className="text-2xl font-bold text-slate-950">
                {shelters.activePercent}%
              </span>
              <span className="text-xs text-slate-600">active</span>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p>
              <span
                aria-hidden="true"
                className="mr-2 inline-block size-3 rounded-full bg-blue-600"
              />
              Active: <strong>{shelters.active}</strong>
            </p>
            <p>
              <span
                aria-hidden="true"
                className="mr-2 inline-block size-3 rounded-full bg-slate-200"
              />
              Not active: <strong>{shelters.inactive}</strong>
            </p>
            {shelterCount === 0 && (
              <p className="text-slate-600">No shelters are registered.</p>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}

/** Renders an overview card as a link only when its destination is available. */
function DashboardCard({
  card,
  index,
}: {
  card: { label: string; value?: number; message?: string; href?: string };
  index: number;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">{card.label}</p>
        <OverviewIcon index={index} />
      </div>
      {card.value === undefined ? (
        <p className="mt-4 text-sm font-semibold text-slate-600">{card.message}</p>
      ) : (
        <p className="mt-4 text-3xl font-bold text-slate-950">{card.value}</p>
      )}
    </>
  );

  if (card.href) {
    return (
      <Link
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-400 hover:bg-blue-50"
        href={card.href}
      >
        {content}
      </Link>
    );
  }

  return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{content}</article>;
}

/** Renders a decorative icon for one overview summary card. */
function OverviewIcon({ index }: { index: number }) {
  const symbols = ['●', '◷', '⌂', '✓'];

  return (
    <span
      aria-hidden="true"
      className="grid size-9 place-items-center rounded-full bg-blue-50 font-bold text-blue-700"
    >
      {symbols[index]}
    </span>
  );
}
