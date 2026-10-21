// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperationsTable } from './operations-table';
import type {
  ApiClient,
  DashboardOperationsPage,
  Organization,
} from '@/lib/api-client';

const organizationA: Organization = {
  id: 'org-a',
  code: 'A',
  name: 'Organization A',
  contactEmail: null,
  contactPhone: null,
  officeAddress: null,
  createdAt: '',
  updatedAt: '',
};
const organizationB = { ...organizationA, id: 'org-b', name: 'Organization B' };

function operation(id: string, name: string) {
  return {
    id,
    operationCode: id.toUpperCase(),
    name,
    countryCode: 'DE',
    type: 'FLOOD' as const,
    severity: 'HIGH' as const,
    status: 'ACTIVE' as const,
    startedAt: null,
    endedAt: null,
    updatedAt: '2026-10-20T10:00:00.000Z',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

afterEach(cleanup);

describe('OperationsTable', () => {
  it('uses the selected status and loads the next cursor page', async () => {
    const api = {
      getOrganizationOperations: vi
        .fn()
        .mockResolvedValueOnce({
          items: [operation('first', 'First operation')],
          nextCursor: 'next-page',
        })
        .mockResolvedValueOnce({
          items: [operation('second', 'Second operation')],
          nextCursor: null,
        }),
    } as unknown as ApiClient;

    render(
      <OperationsTable
        accessToken="token"
        api={api}
        emptyMessage="No operations."
        organization={organizationA}
        status="ACTIVE"
        title="Operations"
      />,
    );

    expect(await screen.findByText('First operation')).toBeTruthy();
    expect(api.getOrganizationOperations).toHaveBeenCalledWith(
      'token',
      'org-a',
      { limit: 25, status: 'ACTIVE' },
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Second operation')).toBeTruthy();
    expect(api.getOrganizationOperations).toHaveBeenLastCalledWith(
      'token',
      'org-a',
      { limit: 25, cursor: 'next-page', status: 'ACTIVE' },
    );
  });

  it('does not show an earlier organization response after a switch', async () => {
    const first = deferred<DashboardOperationsPage>();
    const second = deferred<DashboardOperationsPage>();
    const api = {
      getOrganizationOperations: vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise),
    } as unknown as ApiClient;
    const view = render(
      <OperationsTable
        accessToken="token"
        api={api}
        emptyMessage="No operations."
        organization={organizationA}
        status="ACTIVE"
        title="Operations"
      />,
    );

    view.rerender(
      <OperationsTable
        accessToken="token"
        api={api}
        emptyMessage="No operations."
        organization={organizationB}
        status="ACTIVE"
        title="Operations"
      />,
    );
    await act(async () => {
      second.resolve({
        items: [operation('second', 'Organization B operation')],
        nextCursor: null,
      });
    });
    expect(await screen.findByText('Organization B operation')).toBeTruthy();

    await act(async () => {
      first.resolve({
        items: [operation('first', 'Organization A operation')],
        nextCursor: null,
      });
    });
    expect(screen.getByText('Organization B operation')).toBeTruthy();
    expect(screen.queryByText('Organization A operation')).toBeNull();
  });
});
