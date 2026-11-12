// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider, useSession } from './session-provider';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const identity = () => new Response(JSON.stringify({ id: '1', username: 'admin' }), { status: 200 });
const organization = { id: '11111111-1111-4111-8111-111111111111', name: 'Relief', code: 'RELIEF', contactEmail: null, contactPhone: null, officeAddress: null, createdAt: '', updatedAt: '' };
const organizationKey = 'brucke-selected-organization-id';
const organizations = (records = [organization]) => new Response(JSON.stringify(records), { status: 200 });
/** Exercises the public session actions. */
function Controls() {
  const session = useSession();
  return <><p>{session.sessionKey ? 'Authenticated' : 'Signed out'}</p><p>{session.selectedOrganization ? `Protected page: ${session.selectedOrganization.name}` : 'Organization selection'}</p><p>{session.organizations.map((o) => o.name).join(', ')}</p><button onClick={() => session.selectOrganization(organization)}>Select</button><button onClick={() => void session.login('admin', 'password')}>Sign in</button><button onClick={() => void session.loadOrganizations()}>Load</button><button onClick={() => void session.logout()}>Log out</button></>;
}
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('SessionProvider', () => {
  it('restores a saved organization before rendering the protected page', async () => {
    sessionStorage.setItem(organizationKey, organization.id);
    const pending = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(identity()).mockReturnValueOnce(pending.promise));
    render(<SessionProvider><Controls /></SessionProvider>);
    expect(await screen.findByText('Checking your session…')).toBeTruthy();
    expect(screen.queryByText('Organization selection')).toBeNull();
    await act(async () => pending.resolve(organizations()));
    expect(await screen.findByText('Protected page: Relief')).toBeTruthy();
  });
  it('shows organization selection when the saved organization is missing or malformed', async () => {
    sessionStorage.setItem(organizationKey, organization.id);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(identity()).mockResolvedValueOnce(organizations([])));
    const view = render(<SessionProvider><Controls /></SessionProvider>);
    expect(await screen.findByText('Organization selection')).toBeTruthy();
    expect(sessionStorage.getItem(organizationKey)).toBeNull();
    view.unmount();
    sessionStorage.setItem(organizationKey, 'malformed');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(identity()));
    render(<SessionProvider><Controls /></SessionProvider>);
    expect(await screen.findByText('Organization selection')).toBeTruthy();
    expect(sessionStorage.getItem(organizationKey)).toBeNull();
  });
  it('keeps the saved ID when loading organizations fails and restores it on retry', async () => {
    sessionStorage.setItem(organizationKey, organization.id);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(identity()).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(identity()).mockResolvedValueOnce(organizations()));
    render(<SessionProvider><Controls /></SessionProvider>);
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to load organizations');
    expect(sessionStorage.getItem(organizationKey)).toBe(organization.id);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Protected page: Relief')).toBeTruthy();
  });
  it('continues with an in-memory selection if session storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable'); });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(identity()));
    render(<SessionProvider><Controls /></SessionProvider>);
    expect(await screen.findByText('Organization selection')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(screen.getByText('Protected page: Relief')).toBeTruthy();
  });
  it('stores a selection and clears it on logout or expired session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(identity()).mockResolvedValueOnce(new Response('{"ok":true}', { status: 201 })));
    const view = render(<SessionProvider><Controls /></SessionProvider>);
    expect(await screen.findByText('Authenticated')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(sessionStorage.getItem(organizationKey)).toBe(organization.id);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByText('Signed out')).toBeTruthy();
    expect(sessionStorage.getItem(organizationKey)).toBeNull();
    view.unmount();
    sessionStorage.setItem(organizationKey, organization.id);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })));
    render(<SessionProvider><Controls /></SessionProvider>);
    expect(await screen.findByText('Signed out')).toBeTruthy();
    expect(sessionStorage.getItem(organizationKey)).toBeNull();
  });
  it('waits for restoration before rendering protected children', async () => {
    const pending = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise));
    render(<SessionProvider><Controls /></SessionProvider>);
    expect(screen.getByText('Checking your session…')).toBeTruthy();
    expect(screen.queryByText('Signed out')).toBeNull();
    await act(async () => pending.resolve(identity()));
    expect(await screen.findByText('Authenticated')).toBeTruthy();
  });
  it('distinguishes an expired session from a network error and retries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Response(null, { status: 401 })));
    render(<SessionProvider><Controls /></SessionProvider>);
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to check your session');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Signed out')).toBeTruthy();
  });
  it('reports a non-admin account separately', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    render(<SessionProvider><Controls /></SessionProvider>);
    expect((await screen.findByRole('alert')).textContent).toContain('does not have administrator access');
  });
  it('signs out when an authenticated request returns 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(identity()).mockResolvedValueOnce(new Response(null, { status: 401 })));
    render(<SessionProvider><Controls /></SessionProvider>);
    expect(await screen.findByText('Authenticated')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    expect(await screen.findByText('Signed out')).toBeTruthy();
    expect(sessionStorage.getItem(organizationKey)).toBeNull();
  });
  it('retries failed logout without restoring old organization data', async () => {
    const old = deferred<Response>();
    const fetchMock = vi.fn().mockResolvedValueOnce(identity()).mockReturnValueOnce(old.promise).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Response('{"ok":true}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<SessionProvider><Controls /></SessionProvider>);
    expect(await screen.findByText('Authenticated')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to clear the browser session');
    fireEvent.click(screen.getByRole('button', { name: 'Retry logout' }));
    expect(await screen.findByText('Signed out')).toBeTruthy();
    await act(async () => old.resolve(new Response(JSON.stringify([{ id: 'old', name: 'Old organization' }]), { status: 200 })));
    expect(screen.queryByText('Old organization')).toBeNull();
  });
});
