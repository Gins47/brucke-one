'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { OperationsTable } from '@/components/operations-table';
import { useSession } from '@/components/session-provider';
import { operationStatuses, type OperationStatus } from '@/lib/api-client';

const statusFilters: Array<{ label: string; value?: OperationStatus }> = [
  { label: 'All' },
  { label: 'Planned', value: 'PLANNED' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

/** Displays paginated emergency operations for the selected organization. */
export default function OperationsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-slate-600">Loading operations…</p>}>
      <OperationsPageContent />
    </Suspense>
  );
}

/** Reads the URL status filter and renders the selected organization's operations. */
function OperationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSession();
  const requestedStatus = searchParams.get('status');
  const status = operationStatuses.find((item) => item === requestedStatus);

  useEffect(() => {
    if (!session.accessToken) {
      router.replace('/login');
      return;
    }
    if (!session.selectedOrganization) {
      router.replace('/organizations');
    }
  }, [router, session.accessToken, session.selectedOrganization]);

  if (!session.accessToken || !session.selectedOrganization) {
    return null;
  }

  const selectOrganization = (organizationId: string) => {
    const organization = session.organizations.find(
      (item) => item.id === organizationId,
    );

    if (organization) {
      session.selectOrganization(organization);
    }
  };

  const selectStatus = (nextStatus?: OperationStatus) => {
    router.replace(nextStatus ? `/operations?status=${nextStatus}` : '/operations');
  };

  return (
    <DashboardShell
      onLogout={() => {
        session.logout();
        router.replace('/login');
      }}
      onSelectOrganization={selectOrganization}
      organizations={session.organizations}
      selectedOrganization={session.selectedOrganization}
    >
      <section aria-labelledby="page-title">
        <p className="text-sm font-semibold text-blue-700">Emergency operations</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950" id="page-title">
          {session.selectedOrganization.name} operations
        </h1>
        <label className="mt-6 block max-w-xs text-sm font-semibold text-slate-800" htmlFor="operation-status">
          Status
        </label>
        <select
          className="mt-1 w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950"
          id="operation-status"
          onChange={(event) => selectStatus(event.target.value as OperationStatus || undefined)}
          value={status ?? ''}
        >
          {statusFilters.map((filter) => (
            <option key={filter.label} value={filter.value ?? ''}>
              {filter.label}
            </option>
          ))}
        </select>
        <OperationsTable
          accessToken={session.accessToken}
          api={session.api}
          emptyMessage="No operations match this status."
          key={`${session.selectedOrganization.id}-${status ?? 'ALL'}`}
          organization={session.selectedOrganization}
          status={status}
          title="Operations"
        />
      </section>
    </DashboardShell>
  );
}
