import { DashboardShell } from '@/components/dashboard-shell';

/** Renders the shared dashboard frame until data-backed pages are implemented. */
export default function Home() {
  return (
    <DashboardShell>
      <section aria-labelledby="page-title" className="max-w-2xl">
        <p className="text-sm font-semibold text-blue-700">Operations dashboard</p>
        <h1 id="page-title" className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          A clear workspace for emergency coordination.
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          The shared interface is ready. Login, organization selection, and operational data are introduced in later checkpoints.
        </p>
      </section>
    </DashboardShell>
  );
}
