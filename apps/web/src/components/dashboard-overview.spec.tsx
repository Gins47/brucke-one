// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardOverview, getShelterStatus } from './dashboard-overview';
import type { ApiClient, OrganizationDashboardOverview } from '@/lib/api-client';

const organizationA = { id: 'org-a', code: 'A', name: 'Organization A', contactEmail: null, contactPhone: null, officeAddress: null, createdAt: '', updatedAt: '' };
const organizationB = { ...organizationA, id: 'org-b', code: 'B', name: 'Organization B' };

function overview(active: number): OrganizationDashboardOverview {
  return { organization: { id: 'org', code: 'CODE', name: 'Organization' }, operationCounts: { planned: 2, active, completed: 3, cancelled: 4 }, shelterCount: 5, activeShelterActivationCount: 1 };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(cleanup);

describe('DashboardOverview', () => {
  it('renders counts from a successful overview response', async () => {
    const api = { getOrganizationOverview: vi.fn().mockResolvedValue(overview(6)) } as unknown as ApiClient;
    render(<DashboardOverview accessToken="token" api={api} organization={organizationA} />);
    expect(await screen.findByText('Active operations')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('Planned operations')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('renders the error state when the overview request fails', async () => {
    const api = { getOrganizationOverview: vi.fn().mockRejectedValue(new Error('failed')) } as unknown as ApiClient;
    render(<DashboardOverview accessToken="token" api={api} organization={organizationA} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to load the dashboard overview.');
  });

  it('keeps the newer organization overview when an earlier request resolves late', async () => {
    const first = deferred<OrganizationDashboardOverview>();
    const second = deferred<OrganizationDashboardOverview>();
    const api = { getOrganizationOverview: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) } as unknown as ApiClient;
    const view = render(<DashboardOverview accessToken="token" api={api} organization={organizationA} />);
    view.rerender(<DashboardOverview accessToken="token" api={api} organization={organizationB} />);
    await act(async () => { second.resolve(overview(9)); });
    expect(await screen.findByText('9')).toBeTruthy();
    await act(async () => { first.resolve(overview(7)); });
    expect(screen.getByText('9')).toBeTruthy();
    expect(screen.queryByText('7')).toBeNull();
  });

  it('uses zero percent when no shelters exist', () => {
    expect(getShelterStatus(0, 0)).toEqual({ active: 0, inactive: 0, activePercent: 0 });
  });
});
