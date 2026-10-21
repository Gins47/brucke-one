'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { useSession } from '@/components/session-provider';
import type { ApiClient, Shelter } from '@/lib/api-client';

type SheltersState = {
  status: 'loading' | 'error' | 'ready';
  items: Shelter[];
};

/** Displays shelters for the current selection from the API's global shelter list. */
export default function SheltersPage() {
  const router = useRouter();
  const session = useSession();
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
        <p className="text-sm font-semibold text-blue-700">Shelters</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950" id="page-title">
          {session.selectedOrganization.name} shelters
        </h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          This development view filters the API&apos;s global shelter list by
          the selected organization. It is not an authorization boundary.
        </p>

        <SheltersList
          accessToken={session.accessToken}
          api={session.api}
          key={session.selectedOrganization.id}
          organizationId={session.selectedOrganization.id}
        />
      </section>
    </DashboardShell>
  );
}

/** Loads and filters the global shelter API response for one selected organization. */
function SheltersList({
  accessToken,
  api,
  organizationId,
}: {
  accessToken: string;
  api: ApiClient;
  organizationId: string;
}) {
  const [state, setState] = useState<SheltersState>({
    status: 'loading',
    items: [],
  });

  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;

    void api
      .getShelters(accessToken, controller.signal)
      .then((shelters) => {
        if (isCurrentRequest) {
          setState({
            status: 'ready',
            items: shelters.filter(
              (shelter) => shelter.organizationId === organizationId,
            ),
          });
        }
      })
      .catch(() => {
        if (isCurrentRequest && !controller.signal.aborted) {
          setState({ status: 'error', items: [] });
        }
      });

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [accessToken, api, organizationId]);

  if (state.status === 'loading') {
    return <p className="mt-8 text-slate-600">Loading shelters…</p>;
  }

  if (state.status === 'error') {
    return <p className="mt-8 text-red-700" role="alert">Unable to load shelters.</p>;
  }

  if (state.items.length === 0) {
    return <p className="mt-8 text-slate-600">No shelters are available.</p>;
  }

  return (
    <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-3 font-semibold" scope="col">Code</th>
            <th className="px-4 py-3 font-semibold" scope="col">Name</th>
            <th className="px-4 py-3 font-semibold" scope="col">Address</th>
            <th className="px-4 py-3 font-semibold" scope="col">Capacity</th>
            <th className="px-4 py-3 font-semibold" scope="col">Contact</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-800">
          {state.items.map((shelter) => (
            <tr key={shelter.id}>
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
  );
}
