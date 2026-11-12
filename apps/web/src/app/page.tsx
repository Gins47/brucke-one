 'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { DashboardOverview } from '@/components/dashboard-overview';
import { OperationsTable } from '@/components/operations-table';
import { useSession } from '@/components/session-provider';

/** Renders the selected organization's overview and current active operations. */
export default function Home() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (!session.sessionKey) {
      router.replace('/login');
    } else if (!session.selectedOrganization) {
      router.replace('/organizations');
    }
  }, [router, session.sessionKey, session.selectedOrganization]);

  if (!session.sessionKey || !session.selectedOrganization) {
    return null;
  }

  const selectOrganization = (organizationId: string) => {
    const organization = session.organizations.find((item) => item.id === organizationId);
    if (organization) {
      session.selectOrganization(organization);
    }
  };

  return (
    <DashboardShell
      onLogout={() => {
        void session.logout();
      }}
      onSelectOrganization={selectOrganization}
      organizations={session.organizations}
      selectedOrganization={session.selectedOrganization}
    >
      <section aria-labelledby="page-title" className="w-full">
        <h1 id="page-title" className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Operations dashboard
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">{session.selectedOrganization.name}</p>
        <DashboardOverview key={session.selectedOrganization.id} sessionKey={session.sessionKey} api={session.api} organization={session.selectedOrganization} />
        <OperationsTable
          sessionKey={session.sessionKey}
          api={session.api}
          emptyMessage="No active operations are available."
          description="Active emergency operations for this organization."
          key={`${session.selectedOrganization.id}-ACTIVE`}
          organization={session.selectedOrganization}
          pageSize={5}
          status="ACTIVE"
          title="Ongoing operations"
          viewAllHref="/operations?status=ACTIVE"
        />
      </section>
    </DashboardShell>
  );
}
