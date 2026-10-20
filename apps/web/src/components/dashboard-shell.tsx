import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import type { Organization } from '@/lib/api-client';

const navigationItems = [
  'Dashboard',
  'Organizations',
  'Shelters',
  'Emergency operations',
] as const;

type DashboardShellProps = {
  children: ReactNode;
  organizations: Organization[];
  selectedOrganization: Organization | null;
  onSelectOrganization: (organizationId: string) => void;
  onLogout: () => void;
};

type SurfaceTone = 'dark' | 'light';

/** Provides the shared responsive navigation and content frame for later dashboard pages. */
export function DashboardShell({
  children,
  organizations,
  selectedOrganization,
  onSelectOrganization,
  onLogout,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="hidden w-72 shrink-0 border-r border-slate-800 bg-slate-950 p-6 text-slate-100 md:fixed md:inset-y-0 md:flex md:flex-col">
        <Brand />
        <OrganizationSwitcher
          organizations={organizations}
          selectedOrganization={selectedOrganization}
          onSelectOrganization={onSelectOrganization}
        />
        <Navigation />
        <p className="mt-auto text-sm leading-6 text-slate-400">
          Operational information is protected and available after login.
        </p>
      </aside>
      <main className="min-h-screen md:ml-72">
        <header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
            <Brand compact tone="light" />
            <div className="ml-auto flex shrink-0 items-center gap-3">
              <Badge tone="blue">Development admin</Badge>
              <button className="text-sm font-semibold text-blue-700 hover:text-blue-900" onClick={onLogout} type="button">
                Log out
              </button>
            </div>
          </div>
          <div className="mt-4 md:hidden">
            <OrganizationSwitcher
              organizations={organizations}
              selectedOrganization={selectedOrganization}
              onSelectOrganization={onSelectOrganization}
              tone="light"
            />
          </div>
          <div className="mx-auto mt-4 max-w-7xl md:hidden">
            <Navigation tone="light" />
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12">{children}</div>
      </main>
    </div>
  );
}

/** Lets the administrator change the current in-memory organization selection. */
function OrganizationSwitcher({
  organizations,
  selectedOrganization,
  onSelectOrganization,
  tone = 'dark',
}: {
  organizations: Organization[];
  selectedOrganization: Organization | null;
  onSelectOrganization: (organizationId: string) => void;
  tone?: SurfaceTone;
}) {
  const labelColor = tone === 'dark' ? 'text-slate-300' : 'text-slate-700';
  const controlColor = tone === 'dark'
    ? 'border-slate-700 bg-slate-900 text-white'
    : 'border-slate-300 bg-white text-slate-950';

  return (
    <div className="mt-8">
      <label className={`mb-2 block text-xs font-semibold uppercase tracking-[0.16em] ${labelColor}`} htmlFor={`organization-switcher-${tone}`}>
        Organization
      </label>
      <select
        className={`w-full rounded-md border px-3 py-2 text-sm ${controlColor}`}
        id={`organization-switcher-${tone}`}
        onChange={(event) => onSelectOrganization(event.target.value)}
        value={selectedOrganization?.id ?? ''}
      >
        <option value="">Select an organization</option>
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Renders the product identity with colors that match its containing surface. */
function Brand({ compact = false, tone = 'dark' }: { compact?: boolean; tone?: SurfaceTone }) {
  const nameColor = tone === 'dark' ? 'text-white' : 'text-slate-950';
  const descriptionColor = tone === 'dark' ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className={compact ? 'md:hidden' : ''}>
      <p className={`text-lg font-bold tracking-tight ${nameColor}`}>Brücke One</p>
      {!compact && <p className={`mt-1 text-sm ${descriptionColor}`}>Emergency coordination</p>}
    </div>
  );
}

/** Lists the planned dashboard areas without presenting unfinished routes as links. */
function Navigation({ tone = 'dark' }: { tone?: SurfaceTone }) {
  const labelColor = tone === 'dark' ? 'text-slate-400' : 'text-slate-600';
  const itemColor = tone === 'dark' ? 'text-slate-300' : 'text-slate-700';
  const activeColor =
    tone === 'dark' ? 'first:bg-slate-800 first:text-white' : 'first:bg-blue-700 first:text-white';
  const noteColor = tone === 'dark' ? 'text-slate-400' : 'text-slate-600';

  return (
    <nav aria-label="Dashboard areas" className="mt-10 md:mt-12">
      <p className={`mb-3 text-xs font-semibold uppercase tracking-[0.16em] ${labelColor}`}>
        Workspace
      </p>
      <ul className="grid gap-1 sm:grid-cols-2 md:block" role="list">
        {navigationItems.map((item) => (
          <li
            className={`rounded-md px-3 py-2 text-sm font-medium ${itemColor} ${activeColor}`}
            key={item}
          >
            {item}
          </li>
        ))}
      </ul>
      <p className={`mt-4 text-xs leading-5 ${noteColor}`}>
        Pages are introduced in later checkpoints.
      </p>
    </nav>
  );
}
