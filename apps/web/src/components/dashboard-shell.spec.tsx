// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

import { DashboardShell } from './dashboard-shell';

afterEach(cleanup);

describe('DashboardShell', () => {
  it('links each implemented dashboard area to its route', () => {
    render(
      <DashboardShell
        onLogout={() => undefined}
        onSelectOrganization={() => undefined}
        organizations={[]}
        selectedOrganization={null}
      >
        <p>Content</p>
      </DashboardShell>,
    );

    expect(screen.getAllByRole('link', { name: 'Dashboard' })[0].getAttribute('href')).toBe('/');
    expect(screen.getAllByRole('link', { name: 'Organizations' })[0].getAttribute('href')).toBe('/organizations');
    expect(screen.getAllByRole('link', { name: 'Shelters' })[0].getAttribute('href')).toBe('/shelters');
    expect(screen.getAllByRole('link', { name: 'Emergency operations' })[0].getAttribute('href')).toBe('/operations');
  });
});
