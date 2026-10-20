 'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { DashboardOverview } from '@/components/dashboard-overview';
import { useSession } from '@/components/session-provider';

/** Renders the shared dashboard frame until data-backed pages are implemented. */
export default function Home() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (!session.accessToken) {
      router.replace('/login');
    } else if (!session.selectedOrganization) {
      router.replace('/organizations');
    }
  }, [router, session.accessToken, session.selectedOrganization]);

  if (!session.accessToken || !session.selectedOrganization) {
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
        session.logout();
        router.replace('/login');
      }}
      onSelectOrganization={selectOrganization}
      organizations={session.organizations}
      selectedOrganization={session.selectedOrganization}
    >
      <section aria-labelledby="page-title" className="w-full">
        <p className="text-sm font-semibold text-blue-700">Operations dashboard</p>
        <h1 id="page-title" className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          A clear workspace for emergency coordination.
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">{session.selectedOrganization.name} is selected.</p>
        <DashboardOverview key={session.selectedOrganization.id} accessToken={session.accessToken} api={session.api} organization={session.selectedOrganization} />
      </section>
    </DashboardShell>
  );
}
