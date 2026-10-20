'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  ApiError,
  type ApiClient,
  createApiClient,
  type Organization,
} from '@/lib/api-client';
import {
  clearSession,
  initialSessionState,
  selectOrganization as selectOrganizationState,
  startSession,
  type SessionState,
} from '@/lib/session-state';

type SessionContextValue = SessionState & {
  organizations: Organization[];
  organizationsStatus: 'idle' | 'loading' | 'ready' | 'error';
  organizationsError: string | null;
  authNotice: string | null;
  api: ApiClient;
  login: (username: string, password: string) => Promise<string | null>;
  loadOrganizations: () => Promise<void>;
  selectOrganization: (organization: Organization) => void;
  logout: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

/** Holds the access token and selected organization in memory for the current page lifetime. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(initialSessionState);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationsStatus, setOrganizationsStatus] = useState<SessionContextValue['organizationsStatus']>('idle');
  const [organizationsError, setOrganizationsError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const clear = useCallback(() => {
    setSession(clearSession());
    setOrganizations([]);
    setOrganizationsStatus('idle');
    setOrganizationsError(null);
    setAuthNotice(null);
  }, []);

  const expire = useCallback(() => {
    clear();
    setAuthNotice('Your session has expired. Please sign in again.');
  }, [clear]);

  const api = useMemo(() => createApiClient(apiBaseUrl, expire), [expire]);

  const value: SessionContextValue = {
    ...session,
    organizations,
    organizationsStatus,
    organizationsError,
    authNotice,
    api,
    login: async (username, password) => {
      try {
        const response = await api.login(username, password);
        setSession(startSession(response.accessToken));
        setOrganizations([]);
        setOrganizationsStatus('idle');
        setOrganizationsError(null);
        setAuthNotice(null);
        return null;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return 'Invalid username or password.';
        }
        return 'Unable to sign in. Check the API connection and try again.';
      }
    },
    loadOrganizations: async () => {
      if (!session.accessToken) {
        return;
      }
      setOrganizationsStatus('loading');
      setOrganizationsError(null);
      try {
        const records = await api.getOrganizations(session.accessToken);
        setOrganizations(records);
        setOrganizationsStatus('ready');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return;
        }
        setOrganizationsStatus('error');
        setOrganizationsError(
          error instanceof ApiError && error.status === 403
            ? 'You no longer have administrator access.'
            : 'Unable to load organizations. Try again.',
        );
      }
    },
    selectOrganization: (organization) => {
      setSession((current) => selectOrganizationState(current, organization));
    },
    logout: clear,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Returns the current in-memory session for authenticated frontend pages. */
export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return value;
}
