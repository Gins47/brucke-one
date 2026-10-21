'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type {
  ApiClient,
  DashboardOperation,
  OperationStatus,
  Organization,
} from '@/lib/api-client';

type OperationsState = {
  status: 'loading' | 'error' | 'ready';
  items: DashboardOperation[];
  nextCursor: string | null;
};

/** Displays one selected organization's cursor-paginated operation records. */
export function OperationsTable({
  accessToken,
  api,
  emptyMessage,
  organization,
  pageSize = 25,
  status,
  title,
  viewAllHref,
}: {
  accessToken: string;
  api: ApiClient;
  emptyMessage: string;
  organization: Organization;
  pageSize?: number;
  status?: OperationStatus;
  title: string;
  viewAllHref?: string;
}) {
  const [state, setState] = useState<OperationsState>({
    status: 'loading',
    items: [],
    nextCursor: null,
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;

    void api
      .getOrganizationOperations(
        accessToken,
        organization.id,
        { limit: pageSize, status },
        controller.signal,
      )
      .then((page) => {
        if (requestSequence.current === sequence) {
          setState({
            status: 'ready',
            items: page.items,
            nextCursor: page.nextCursor,
          });
        }
      })
      .catch(() => {
        if (
          requestSequence.current === sequence &&
          !controller.signal.aborted
        ) {
          setState({ status: 'error', items: [], nextCursor: null });
        }
      });

    return () => {
      requestSequence.current += 1;
      controller.abort();
    };
  }, [accessToken, api, organization.id, pageSize, status]);

  const loadMore = async () => {
    if (!state.nextCursor || isLoadingMore) {
      return;
    }

    const sequence = requestSequence.current;
    setIsLoadingMore(true);

    try {
      const page = await api.getOrganizationOperations(
        accessToken,
        organization.id,
        { limit: pageSize, cursor: state.nextCursor, status },
      );

      if (requestSequence.current === sequence) {
        setState((current) => ({
          status: 'ready',
          items: [...current.items, ...page.items],
          nextCursor: page.nextCursor,
        }));
      }
    } catch {
      if (requestSequence.current === sequence) {
        setState((current) => ({ ...current, status: 'error' }));
      }
    } finally {
      if (requestSequence.current === sequence) {
        setIsLoadingMore(false);
      }
    }
  };

  return (
    <section aria-labelledby="operations-title" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-950" id="operations-title">
          {title}
        </h2>
        {viewAllHref && (
          <Link
            className="text-sm font-semibold text-blue-700 hover:text-blue-900"
            href={viewAllHref}
          >
            View all operations
          </Link>
        )}
      </div>

      {state.status === 'loading' && (
        <p className="mt-4 text-slate-600">Loading operations…</p>
      )}
      {state.status === 'error' && (
        <p className="mt-4 text-red-700" role="alert">
          Unable to load operations. Try again by changing the filter.
        </p>
      )}
      {state.status === 'ready' && state.items.length === 0 && (
        <p className="mt-4 text-slate-600">{emptyMessage}</p>
      )}
      {state.items.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold" scope="col">Code</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Operation</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Country</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Type</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Severity</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Status</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {state.items.map((operation) => (
                  <tr key={operation.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{operation.operationCode}</td>
                    <td className="px-4 py-3">
                      <Link
                        className="font-semibold text-blue-700 hover:text-blue-900"
                        href={`/operations/${operation.id}`}
                      >
                        {operation.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{operation.countryCode}</td>
                    <td className="px-4 py-3">{operation.type}</td>
                    <td className="px-4 py-3">{operation.severity}</td>
                    <td className="px-4 py-3">{operation.status}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(operation.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state.nextCursor && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-600">
                More operations are available.
              </p>
              <button
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isLoadingMore}
                onClick={() => void loadMore()}
                type="button"
              >
                {isLoadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Formats an API timestamp for the compact operations table. */
function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
