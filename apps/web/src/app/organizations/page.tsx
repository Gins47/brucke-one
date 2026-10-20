'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/session-provider';

/** Loads the small organization list and lets the administrator choose the active scope. */
export default function OrganizationsPage() {
  const router = useRouter();
  const session = useSession();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!session.accessToken) {
      router.replace('/login');
      return;
    }
    if (session.organizationsStatus === 'idle') {
      void session.loadOrganizations();
    }
  }, [router, session]);

  const organizations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return session.organizations;
    }
    return session.organizations.filter((organization) =>
      `${organization.name} ${organization.code}`.toLowerCase().includes(normalizedQuery),
    );
  }, [query, session.organizations]);

  if (!session.accessToken) {
    return null;
  }

  const chooseOrganization = (organizationId: string) => {
    const organization = session.organizations.find((item) => item.id === organizationId);
    if (!organization) {
      return;
    }
    session.selectOrganization(organization);
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 sm:px-8">
      <section className="relative mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-blue-700">Brücke One</p>
        <button className="absolute right-6 top-6 text-sm font-semibold text-blue-700 hover:text-blue-900 sm:right-8 sm:top-8" onClick={() => { session.logout(); router.replace('/login'); }} type="button">Log out</button>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Choose an organization</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">This local search filters the loaded development organization list.</p>
        <label className="mt-6 block text-sm font-semibold text-slate-800" htmlFor="organization-search">
          Search organizations
        </label>
        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" id="organization-search" onChange={(event) => setQuery(event.target.value)} value={query} />
        {session.organizationsStatus === 'loading' && <p className="mt-6 text-slate-600">Loading organizations…</p>}
        {session.organizationsStatus === 'error' && <div className="mt-6" role="alert"><p className="text-red-700">{session.organizationsError}</p><button className="mt-3 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white" onClick={() => void session.loadOrganizations()} type="button">Try again</button></div>}
        {session.organizationsStatus === 'ready' && session.organizations.length === 0 && <p className="mt-6 text-slate-600">No organizations are available.</p>}
        {session.organizationsStatus === 'ready' && session.organizations.length > 0 && organizations.length === 0 && <p className="mt-6 text-slate-600">No organizations match this search.</p>}
        <ul className="mt-6 grid gap-3" role="list">
          {organizations.map((organization) => (
            <li key={organization.id}><button className="w-full rounded-lg border border-slate-200 p-4 text-left hover:border-blue-400 hover:bg-blue-50" onClick={() => chooseOrganization(organization.id)} type="button"><span className="block font-semibold text-slate-950">{organization.name}</span><span className="mt-1 block text-sm text-slate-600">{organization.code}</span></button></li>
          ))}
        </ul>
      </section>
    </main>
  );
}
