import type { AdminIdentity, Organization } from './api-client';

export type SessionState = {
  user: AdminIdentity | null;
  sessionKey: string | null;
  selectedOrganization: Organization | null;
};

export const initialSessionState: SessionState = {
  user: null,
  sessionKey: null,
  selectedOrganization: null,
};

/** Starts an authenticated session with a non-secret UI lifecycle key. */
export function startSession(user: AdminIdentity, sessionKey: string): SessionState {
  return { user, sessionKey, selectedOrganization: null };
}

/** Clears the authenticated identity and selected organization. */
export function clearSession(): SessionState {
  return initialSessionState;
}

/** Changes the current in-memory organization selection. */
export function selectOrganization(state: SessionState, organization: Organization): SessionState {
  return { ...state, selectedOrganization: organization };
}
