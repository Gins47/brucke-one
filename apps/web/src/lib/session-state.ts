import type { Organization } from './api-client';

export type SessionState = {
  accessToken: string | null;
  selectedOrganization: Organization | null;
};

export const initialSessionState: SessionState = {
  accessToken: null,
  selectedOrganization: null,
};

/** Starts an authenticated in-memory session after a successful login. */
export function startSession(accessToken: string): SessionState {
  return { ...initialSessionState, accessToken };
}

/** Clears all in-memory session and organization state for logout or a 401 response. */
export function clearSession(): SessionState {
  return initialSessionState;
}

/** Changes the current in-memory organization selection. */
export function selectOrganization(
  state: SessionState,
  organization: Organization,
): SessionState {
  return {
    ...state,
    selectedOrganization: organization,
  };
}
