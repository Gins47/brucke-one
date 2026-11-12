export type AdminIdentity = { id: string; username: string };

export type Organization = {
  id: string;
  code: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  officeAddress: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationDashboardOverview = {
  organization: Pick<Organization, 'id' | 'code' | 'name'>;
  operationCounts: { planned: number; active: number; completed: number; cancelled: number };
  shelterCount: number;
  activeShelterActivationCount: number;
};

export type Shelter = {
  id: string;
  organizationId: string;
  shelterCode: string;
  name: string;
  address: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  capacity: number;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  updatedAt: string;
};

export const operationStatuses = [
  'PLANNED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
] as const;

export type OperationStatus = (typeof operationStatuses)[number];

export type DashboardOperation = {
  id: string;
  operationCode: string;
  name: string;
  countryCode: string;
  type: 'FLOOD' | 'FIRE' | 'EARTHQUAKE' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: OperationStatus;
  startedAt: string | null;
  endedAt: string | null;
  updatedAt: string;
};

export type DashboardOperationsPage = {
  items: DashboardOperation[];
  nextCursor: string | null;
};

export type DashboardOperationMap = {
  operation: DashboardOperation & { organizationId: string };
  affectedRegions: Array<{
    id: string;
    countryCode: string;
    regionCode: string;
    regionName: string;
    addedAt: string;
  }>;
  activeShelters: Array<{
    shelterActivationId: string;
    shelterId: string;
    shelterCode: string;
    name: string;
    address: string;
    countryCode: string;
    latitude: number;
    longitude: number;
    capacity: number;
    contactEmail: string | null;
    contactPhone: string | null;
    activatedAt: string;
    availability: ShelterAvailability | null;
  }>;
  activeShelterAvailability: Array<DashboardOperationMap['activeShelters'][number] & {
    latitude: number | null;
    longitude: number | null;
  }>;
  mappedActiveShelterCount: number;
  unmappedActiveShelterCount: number;
  availabilitySummary: {
    activeShelterCount: number;
    availabilityReportedShelterCount: number;
    availabilityNotReportedShelterCount: number;
    reportedOperationalCapacity: number;
    reportedCurrentOccupancy: number;
    reportedReservedPlaces: number;
    reportedAvailablePlaces: number;
    acceptingArrivalsShelterCount: number;
  };
};

export type ShelterAvailability = {
  operationalCapacity: number;
  currentOccupancy: number;
  reservedPlaces: number;
  availablePlaces: number;
  acceptingArrivals: boolean;
  availabilityNote: string | null;
  reportedAt: string;
};

export type DashboardShelter = Omit<Shelter, 'organizationId' | 'createdAt' | 'updatedAt'> & {
  activeActivation: {
    id: string;
    activatedAt: string;
    operation: {
      id: string;
      operationCode: string;
      name: string;
      status: OperationStatus;
    };
    availability: ShelterAvailability | null;
  } | null;
};

export type HelpRequestAssignment = {
  id: string;
  helpRequestId: string;
  emergencyOperationId: string;
  shelterActivationId: string;
  shelterId: string;
  shelterName: string;
  reservedGroupSize: number;
  assignedByUserId: string;
  createdAt: string;
};

export type OperatorHelpRequest = {
  id: string;
  requesterName: string;
  requesterPhone: string;
  requesterEmail: string | null;
  groupSize: number;
  locationDescription: string;
  canTravelIndependently: boolean;
  medicalSupportNeeded: boolean;
  status: string;
  assignment?: HelpRequestAssignment | null;
};

export type HelpRequestPage = { items: OperatorHelpRequest[]; nextCursor: string | null };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Calls the API routes used by the authenticated dashboard. */
export function createApiClient(baseUrl: string, onUnauthorized: () => void) {
  const request = async <T>(path: string, init: RequestInit = {}, notifyUnauthorized = true): Promise<T> => {
    let response: Response;
    try {
      const headers = new Headers(init.headers);
      if (init.method && !['GET', 'HEAD', 'OPTIONS'].includes(init.method)) headers.set('X-Brucke-Request', '1');
      response = await fetch(`${baseUrl}${path}`, { ...init, headers, credentials: 'include' });
    } catch {
      throw new ApiError(0, 'Unable to reach the API. Check that it is running.');
    }

    if (!response.ok) {
      if (response.status === 401 && notifyUnauthorized && !init.signal?.aborted) {
        onUnauthorized();
      }
      throw new ApiError(response.status, 'The API request could not be completed.');
    }

    return (await response.json()) as T;
  };

  return {
    /** Sends credentials to the public login endpoint. */
    login: (username: string, password: string) =>
      request<AdminIdentity>('/auth/browser/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      }, false),
    /** Restores the identity from the browser cookie. */
    getMe: (signal?: AbortSignal) => request<AdminIdentity>('/auth/me', { signal }, false),
    /** Clears the browser cookie. */
    logout: () => request<{ ok: boolean }>('/auth/browser/logout', { method: 'POST' }, false),
    /** Loads organizations for the currently authenticated administrator. */
    getOrganizations: (_sessionKey: string, signal?: AbortSignal) =>
      request<Organization[]>('/organizations', {
        signal,
      }),
    /** Loads the dashboard overview for one selected organization. */
    getOrganizationOverview: (_sessionKey: string, organizationId: string, signal?: AbortSignal) =>
      request<OrganizationDashboardOverview>(`/dashboard/organizations/${organizationId}/overview`, {
        signal,
      }),
    /** Loads all shelters before the small dashboard filters them by organization. */
    getShelters: (_sessionKey: string, signal?: AbortSignal) =>
      request<Shelter[]>('/shelters', {
        signal,
      }),
    /** Loads the selected organization's shelter dashboard projection. */
    getOrganizationShelters: (
      _sessionKey: string,
      organizationId: string,
      signal?: AbortSignal,
    ) =>
      request<DashboardShelter[]>(
        `/dashboard/organizations/${organizationId}/shelters`,
        { signal },
      ),
    /** Loads one selected-organization shelter with its current active context. */
    getOrganizationShelter: (
      _sessionKey: string,
      organizationId: string,
      shelterId: string,
      signal?: AbortSignal,
    ) =>
      request<DashboardShelter>(
        `/dashboard/organizations/${organizationId}/shelters/${shelterId}`,
        { signal },
      ),
    /** Replaces one active shelter activation's complete availability report. */
    replaceShelterActivationAvailability: (
      _sessionKey: string,
      activationId: string,
      input: Omit<ShelterAvailability, 'availablePlaces' | 'reportedAt' | 'availabilityNote'> & {
        availabilityNote?: string;
      },
      signal?: AbortSignal,
    ) =>
      request<ShelterAvailability>(
        `/shelter-activations/${activationId}/availability`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
          signal,
        },
      ),
    /** Loads one cursor-paginated operation page for a selected organization. */
    getOrganizationOperations: (
      _sessionKey: string,
      organizationId: string,
      query: { limit?: number; cursor?: string; status?: OperationStatus },
      signal?: AbortSignal,
    ) => {
      const search = new URLSearchParams();

      if (query.limit) {
        search.set('limit', String(query.limit));
      }
      if (query.cursor) {
        search.set('cursor', query.cursor);
      }
      if (query.status) {
        search.set('status', query.status);
      }

      const suffix = search.size > 0 ? `?${search.toString()}` : '';

      return request<DashboardOperationsPage>(
        `/dashboard/organizations/${organizationId}/operations${suffix}`,
        {
          signal,
        },
      );
    },
    /** Loads a page of pending or reserved requests for an operation. */
    getOperatorHelpRequests: (_sessionKey: string, operationId: string, status: 'PENDING_REVIEW' | 'RESERVED', cursor?: string, signal?: AbortSignal) => {
      const query = new URLSearchParams({ status });
      if (cursor) query.set('cursor', cursor);
      return request<HelpRequestPage>(`/emergency-operations/${operationId}/help-requests?${query}`, {
        signal,
      });
    },
    /** Assigns a pending request to a selected shelter activation. */
    assignHelpRequest: (_sessionKey: string, operationId: string, requestId: string, shelterActivationId: string, signal?: AbortSignal) =>
      request<HelpRequestAssignment>(`/emergency-operations/${operationId}/help-requests/${requestId}/assignment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shelterActivationId }), signal,
      }),
    /** Loads the read-only map projection for one emergency operation. */
    getEmergencyOperationMap: (
      _sessionKey: string,
      operationId: string,
      signal?: AbortSignal,
    ) =>
      request<DashboardOperationMap>(
        `/dashboard/emergency-operations/${operationId}/map`,
        {
          signal,
        },
      ),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
