'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, type ApiClient, createApiClient, type Organization } from '../lib/api-client';
import { clearSession, initialSessionState, selectOrganization as selectOrganizationState, startSession, type SessionState } from '../lib/session-state';

type SessionContextValue = SessionState & {
  organizations: Organization[];
  organizationsStatus: 'idle' | 'loading' | 'ready' | 'error';
  organizationsError: string | null;
  authNotice: string | null;
  api: ApiClient;
  login: (username: string, password: string) => Promise<string | null>;
  loadOrganizations: () => Promise<void>;
  selectOrganization: (organization: Organization) => void;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
const organizationStorageKey = 'brucke-selected-organization-id';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads a tab-local organization preference without depending on storage availability. */
function readSavedOrganization(): string | null {
  try {
    const id = sessionStorage.getItem(organizationStorageKey);
    if (id && !uuidPattern.test(id)) {
      sessionStorage.removeItem(organizationStorageKey);
      return null;
    }
    return id;
  } catch {
    return null;
  }
}

/** Updates only the tab-local organization ID when browser storage is available. */
function saveOrganization(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(organizationStorageKey, id);
    else sessionStorage.removeItem(organizationStorageKey);
  } catch {
    // Storage is optional; the dashboard can still use its in-memory selection.
  }
}

/** Restores the browser session and isolates requests when its identity changes. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(initialSessionState);
  const [authStatus, setAuthStatus] = useState<'checking' | 'ready' | 'error' | 'organization-error' | 'forbidden'>('checking');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationsStatus, setOrganizationsStatus] = useState<SessionContextValue['organizationsStatus']>('idle');
  const [organizationsError, setOrganizationsError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState(false);
  const generation = useRef(0);
  const organizationRequest = useRef<AbortController | null>(null);
  const organizationGeneration = useRef(0);

  /** Cancels organization work before a session or selection changes. */
  const invalidateOrganizations = useCallback(() => {
    organizationGeneration.current += 1;
    organizationRequest.current?.abort();
    organizationRequest.current = null;
  }, []);

  /** Clears all in-memory dashboard data. */
  const clear = useCallback(() => {
    invalidateOrganizations();
    setSession(clearSession());
    setOrganizations([]);
    setOrganizationsStatus('idle');
    setOrganizationsError(null);
  }, [invalidateOrganizations]);

  const api = useMemo(() => {
    const apiGeneration = session.sessionKey;
    // The callback runs only after a fetch response, not during render.
    // eslint-disable-next-line react-hooks/refs
    return createApiClient(apiBaseUrl, () => {
      if (!apiGeneration || String(generation.current) !== apiGeneration) return;
      generation.current += 1;
      saveOrganization(null);
      clear();
      setAuthNotice('Your session has expired. Please sign in again.');
      setAuthStatus('ready');
    });
    // A new client scopes late 401 responses to the current session.
  }, [clear, session.sessionKey]);

  /** Checks the cookie without mistaking network failures for expiration. */
  const restore = useCallback(async () => {
    const current = ++generation.current;
    setAuthStatus('checking');
    try {
      const user = await api.getMe();
      if (generation.current !== current) return;
      const savedId = readSavedOrganization();
      let records: Organization[] | null = null;
      if (savedId) {
        try {
          records = await api.getOrganizations(String(current));
        } catch (error) {
          if (generation.current !== current) return;
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) throw error;
          setAuthStatus('organization-error');
          return;
        }
        if (generation.current !== current) return;
      }
      clear();
      const selected = records?.find((organization) => organization.id.toLowerCase() === savedId?.toLowerCase());
      if (savedId && !selected) saveOrganization(null);
      setSession(selected ? selectOrganizationState(startSession(user, String(current)), selected) : startSession(user, String(current)));
      if (records) {
        setOrganizations(records);
        setOrganizationsStatus('ready');
      }
      setAuthNotice(null);
      setAuthStatus('ready');
    } catch (error) {
      if (generation.current !== current) return;
      clear();
      if (error instanceof ApiError && error.status === 401) {
        saveOrganization(null);
        setAuthStatus('ready');
      } else if (error instanceof ApiError && error.status === 403) {
        setAuthStatus('forbidden');
      } else {
        setAuthStatus('error');
      }
    }
  }, [api, clear]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void restore(); });
    return () => { active = false; generation.current += 1; invalidateOrganizations(); };
    // Restoration is initiated once; later session changes do not re-check it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Clears the cookie and keeps a retry available if the request fails. */
  const logout = async () => {
    const current = ++generation.current;
    saveOrganization(null);
    invalidateOrganizations();
    try {
      await api.logout();
      if (generation.current !== current) return;
      clear();
      setLogoutError(false);
      setAuthNotice(null);
      setAuthStatus('ready');
    } catch {
      if (generation.current !== current) return;
      clear();
      setLogoutError(true);
      setAuthStatus('ready');
    }
  };

  const value: SessionContextValue = {
    ...session, organizations, organizationsStatus, organizationsError, authNotice, api,
    login: async (username, password) => {
      const current = ++generation.current;
      invalidateOrganizations();
      try {
        await api.login(username, password);
        const user = await api.getMe();
        if (generation.current !== current) return 'Sign-in was interrupted. Please try again.';
        clear();
        setSession(startSession(user, String(current)));
        setAuthNotice(null);
        return null;
      } catch (error) {
        if (generation.current !== current) return 'Sign-in was interrupted. Please try again.';
        if (error instanceof ApiError && error.status === 403) return 'This account does not have administrator access.';
        if (error instanceof ApiError && error.status === 401) return 'Invalid credentials or session. Please sign in again.';
        return 'Unable to sign in. Check the API connection and try again.';
      }
    },
    loadOrganizations: async () => {
      if (!session.sessionKey) return;
      invalidateOrganizations();
      const controller = new AbortController();
      const current = organizationGeneration.current;
      organizationRequest.current = controller;
      setOrganizationsStatus('loading');
      setOrganizationsError(null);
      try {
        const records = await api.getOrganizations(session.sessionKey, controller.signal);
        if (organizationGeneration.current !== current) return;
        setOrganizations(records);
        setOrganizationsStatus('ready');
      } catch (error) {
        if (organizationGeneration.current !== current) return;
        if (error instanceof ApiError && error.status === 401) return;
        setOrganizationsStatus('error');
        setOrganizationsError(error instanceof ApiError && error.status === 403 ? 'You no longer have administrator access.' : 'Unable to load organizations. Try again.');
      } finally {
        if (organizationGeneration.current === current) organizationRequest.current = null;
      }
    },
    selectOrganization: (organization) => {
      invalidateOrganizations();
      saveOrganization(organization.id);
      setSession((current) => selectOrganizationState(current, organization));
    },
    logout,
  };

  if (authStatus === 'checking') return <p role="status" className="p-8">Checking your session…</p>;
  if (authStatus === 'error' || authStatus === 'organization-error' || authStatus === 'forbidden') return <main className="p-8"><p role="alert">{authStatus === 'forbidden' ? 'This account does not have administrator access.' : authStatus === 'organization-error' ? 'Unable to load organizations. Try again.' : 'Unable to check your session. Check the API connection and try again.'}</p><button type="button" onClick={() => void restore()}>Try again</button>{authStatus === 'forbidden' && <button type="button" onClick={() => void logout()}>Log out</button>}</main>;
  if (logoutError) return <main className="p-8"><p role="alert">Unable to clear the browser session. Check the API connection and try again.</p><button type="button" onClick={() => void logout()}>Retry logout</button></main>;
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Returns the current dashboard session. */
export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
