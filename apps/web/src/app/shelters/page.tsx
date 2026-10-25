'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { useSession } from '@/components/session-provider';
import { ShelterDashboard } from '@/components/shelter-dashboard';

/** Displays selected-organization shelters from the dashboard read model. */
export default function SheltersPage() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (!session.accessToken) router.replace('/login');
    else if (!session.selectedOrganization) router.replace('/organizations');
  }, [router, session.accessToken, session.selectedOrganization]);

  if (!session.accessToken || !session.selectedOrganization) return null;

  return (
    <DashboardShell
      onLogout={() => { session.logout(); router.replace('/login'); }}
      onSelectOrganization={(organizationId) => {
        const organization = session.organizations.find((item) => item.id === organizationId);
        if (organization) session.selectOrganization(organization);
      }}
      organizations={session.organizations}
      selectedOrganization={session.selectedOrganization}
    >
      <section aria-labelledby="page-title">
        <p className="text-sm font-semibold text-blue-700">Shelters</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950" id="page-title">{session.selectedOrganization.name} shelter readiness</h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Monitor active shelter capacity, reported availability, and operational follow-up needs.
        </p>
        <ShelterDashboard accessToken={session.accessToken} api={session.api} key={session.selectedOrganization.id} organizationId={session.selectedOrganization.id} />
      </section>
    </DashboardShell>
  );
}
