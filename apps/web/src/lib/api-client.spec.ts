import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api-client';

describe('API client', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('uses browser credentials and the required header for login and mutations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: '1', username: 'admin' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    await createApiClient('http://localhost:3000', vi.fn()).login('admin', 'password');
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/auth/browser/login');
    expect(options.credentials).toBe('include');
    expect(new Headers(options.headers).get('x-brucke-request')).toBe('1');
    expect(new Headers(options.headers).has('authorization')).toBe(false);
  });
  it('does not report a failed login as session expiry', async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    await expect(createApiClient('http://localhost:3000', onUnauthorized).login('admin', 'wrong')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
  it('clears the session on a protected 401', async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    await expect(createApiClient('http://localhost:3000', onUnauthorized).getOrganizations('session')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
  it('sends cookie credentials without an authorization header on reads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await createApiClient('http://localhost:3000', vi.fn()).getOrganizationOverview('session', 'org-1');
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.credentials).toBe('include');
    expect(new Headers(options.headers).has('authorization')).toBe(false);
  });
});
