export type LoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
};

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
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, init);
    } catch {
      throw new ApiError(0, 'Unable to reach the API. Check that it is running.');
    }

    if (!response.ok) {
      if (response.status === 401) {
        onUnauthorized();
      }
      throw new ApiError(response.status, 'The API request could not be completed.');
    }

    return (await response.json()) as T;
  };

  return {
    /** Sends credentials to the public login endpoint. */
    login: (username: string, password: string) =>
      request<LoginResponse>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      }),
    /** Loads organizations for the currently authenticated administrator. */
    getOrganizations: (accessToken: string, signal?: AbortSignal) =>
      request<Organization[]>('/organizations', {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal,
      }),
    /** Loads the dashboard overview for one selected organization. */
    getOrganizationOverview: (accessToken: string, organizationId: string, signal?: AbortSignal) =>
      request<OrganizationDashboardOverview>(`/dashboard/organizations/${organizationId}/overview`, {
        headers: { Authorization: `Bearer ${accessToken}` }, signal,
      }),
    /** Loads all shelters before the small dashboard filters them by organization. */
    getShelters: (accessToken: string, signal?: AbortSignal) =>
      request<Shelter[]>('/shelters', {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal,
      }),
    /** Loads the selected organization's shelter dashboard projection. */
    getOrganizationShelters: (
      accessToken: string,
      organizationId: string,
      signal?: AbortSignal,
    ) =>
      request<DashboardShelter[]>(
        `/dashboard/organizations/${organizationId}/shelters`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal },
      ),
    /** Loads one selected-organization shelter with its current active context. */
    getOrganizationShelter: (
      accessToken: string,
      organizationId: string,
      shelterId: string,
      signal?: AbortSignal,
    ) =>
      request<DashboardShelter>(
        `/dashboard/organizations/${organizationId}/shelters/${shelterId}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal },
      ),
    /** Replaces one active shelter activation's complete availability report. */
    replaceShelterActivationAvailability: (
      accessToken: string,
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
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
          signal,
        },
      ),
    /** Loads one cursor-paginated operation page for a selected organization. */
    getOrganizationOperations: (
      accessToken: string,
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
          headers: { Authorization: `Bearer ${accessToken}` },
          signal,
        },
      );
    },
    /** Loads the read-only map projection for one emergency operation. */
    getEmergencyOperationMap: (
      accessToken: string,
      operationId: string,
      signal?: AbortSignal,
    ) =>
      request<DashboardOperationMap>(
        `/dashboard/emergency-operations/${operationId}/map`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal,
        },
      ),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
