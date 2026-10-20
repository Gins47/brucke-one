import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api-client';

describe('API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends login credentials and returns the token response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'access-token', tokenType: 'Bearer', expiresIn: '24h' }), { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(createApiClient('http://localhost:3000', vi.fn()).login('admin', 'password')).resolves.toMatchObject({
      accessToken: 'access-token',
      tokenType: 'Bearer',
    });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/auth/login', expect.objectContaining({ method: 'POST' }));
  });

  it('rejects unsuccessful login without exposing an API response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret server detail', { status: 401 })));

    await expect(createApiClient('http://localhost:3000', vi.fn()).login('admin', 'wrong-password')).rejects.toMatchObject({
      status: 401,
      message: 'The API request could not be completed.',
    });
  });

  it('clears the session when a protected request returns 401', async () => {
    const clearSession = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(createApiClient('http://localhost:3000', clearSession).getOrganizations('access-token')).rejects.toBeInstanceOf(ApiError);
    expect(clearSession).toHaveBeenCalledOnce();
  });
});
