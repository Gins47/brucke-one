export type OrganizationDashboardOverviewResponse = {
  organization: {
    id: string;
    code: string;
    name: string;
  };
  operationCounts: {
    planned: number;
    active: number;
    completed: number;
    cancelled: number;
  };
  shelterCount: number;
  activeShelterActivationCount: number;
};
