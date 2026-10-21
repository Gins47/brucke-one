// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider, useSession } from './session-provider';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

function tokenResponse() {
  return new Response(
    JSON.stringify({
      accessToken: 'test-access-token',
      tokenType: 'Bearer',
      expiresIn: '24h',
    }),
    { status: 201 },
  );
}

/** Exercises the provider through its public session actions. */
function SessionControls() {
  const session = useSession();

  return (
    <>
      <p>{session.accessToken ? 'Authenticated' : 'Signed out'}</p>
      <p>Organizations: {session.organizations.map((organization) => organization.name).join(', ')}</p>
      <p>Organization status: {session.organizationsStatus}</p>
      <button onClick={() => void session.login('admin', 'password')} type="button">
        Sign in
      </button>
      <button onClick={() => void session.loadOrganizations()} type="button">
        Load organizations
      </button>
      <button onClick={session.logout} type="button">
        Log out
      </button>
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SessionProvider', () => {
  it('does not restore organizations from a request that resolved after logout and a later login', async () => {
    const oldOrganizationRequest = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(tokenResponse())
        .mockReturnValueOnce(oldOrganizationRequest.promise)
        .mockResolvedValueOnce(tokenResponse()),
    );

    render(
      <SessionProvider>
        <SessionControls />
      </SessionProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Authenticated')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Load organizations' }));
    expect(await screen.findByText('Organization status: loading')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(screen.getByText('Signed out')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Authenticated')).toBeTruthy();

    await act(async () => {
      oldOrganizationRequest.resolve(
        new Response(
          JSON.stringify([
            {
              id: 'organization-a',
              code: 'A',
              name: 'Earlier organization',
              contactEmail: null,
              contactPhone: null,
              officeAddress: null,
              createdAt: '',
              updatedAt: '',
            },
          ]),
          { status: 200 },
        ),
      );
    });

    expect(screen.queryByText(/Earlier organization/)).toBeNull();
    expect(screen.getByText('Organization status: idle')).toBeTruthy();
  });
});
