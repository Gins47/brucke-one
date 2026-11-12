'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { ShelterDetail } from '@/components/shelter-detail';
import { useSession } from '@/components/session-provider';

/** Hosts one selected-organization shelter detail and availability report view. */
export default function ShelterDetailPage() {
  const params = useParams<{ shelterId: string }>();
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (!session.sessionKey) router.replace('/login');
    else if (!session.selectedOrganization) router.replace('/organizations');
  }, [router, session.sessionKey, session.selectedOrganization]);

  if (!session.sessionKey || !session.selectedOrganization) return null;

  return <DashboardShell
    onLogout={() => { void session.logout(); }}
    onSelectOrganization={(organizationId) => {
      const organization = session.organizations.find((item) => item.id === organizationId);
      if (organization) session.selectOrganization(organization);
    }}
    organizations={session.organizations}
    selectedOrganization={session.selectedOrganization}
  >
    <ShelterDetail sessionKey={session.sessionKey} api={session.api} key={`${session.selectedOrganization.id}-${params.shelterId}`} organizationId={session.selectedOrganization.id} shelterId={params.shelterId} />
  </DashboardShell>;
}
