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

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Calls the small subset of the API used by login and organization selection. */
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
    getOrganizations: (accessToken: string) =>
      request<Organization[]>('/organizations', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    /** Loads the dashboard overview for one selected organization. */
    getOrganizationOverview: (accessToken: string, organizationId: string, signal?: AbortSignal) =>
      request<OrganizationDashboardOverview>(`/dashboard/organizations/${organizationId}/overview`, {
        headers: { Authorization: `Bearer ${accessToken}` }, signal,
      }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
