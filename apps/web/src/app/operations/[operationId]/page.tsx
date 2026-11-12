'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OperationDetail } from '@/components/operation-detail';
import { DashboardShell } from '@/components/dashboard-shell';
import { useSession } from '@/components/session-provider';

/** Displays a selected operation's read-only map projection. */
export default function OperationDetailPage() {
  const params = useParams<{ operationId: string }>();
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (!session.sessionKey) {
      router.replace('/login');
      return;
    }
    if (!session.selectedOrganization) {
      router.replace('/organizations');
    }
  }, [router, session.sessionKey, session.selectedOrganization]);

  if (!session.sessionKey || !session.selectedOrganization) {
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

  return (
    <DashboardShell
      onLogout={() => {
        void session.logout();
      }}
      onSelectOrganization={selectOrganization}
      organizations={session.organizations}
      selectedOrganization={session.selectedOrganization}
    >
      <OperationDetail
        sessionKey={session.sessionKey}
        api={session.api}
        key={`${session.selectedOrganization.id}-${params.operationId}`}
        operationId={params.operationId}
        organizationId={session.selectedOrganization.id}
      />
    </DashboardShell>
  );
}
