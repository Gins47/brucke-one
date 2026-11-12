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

/** Loads and displays the read-only overview for the selected organization. */
export function DashboardOverview({
  sessionKey,
  api,
  organization,
}: {
  sessionKey: string;
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
      .getOrganizationOverview(sessionKey, organization.id, controller.signal)
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
  }, [sessionKey, api, organization.id]);

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

  return (
    <section aria-label="Organization overview" className="mt-8 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card, index) => (
          <DashboardCard card={card} index={index} key={card.label} />
        ))}
      </div>
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
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        href={card.href}
      >
        {content}
      </Link>
    );
  }

  return <article className={`rounded-xl border border-slate-200 p-5 ${card.message ? 'bg-slate-50' : 'bg-white shadow-sm'}`}>{content}</article>;
}

/** Renders a decorative icon for one overview summary card. */
function OverviewIcon({ index }: { index: number }) {
  const symbols = ['●', '◷', '⌂', '✓', '…'];

  return (
    <span
      aria-hidden="true"
      className={`grid size-9 shrink-0 place-items-center rounded-full font-bold ${index === 4 ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-700'}`}
    >
      {symbols[index]}
    </span>
  );
}
