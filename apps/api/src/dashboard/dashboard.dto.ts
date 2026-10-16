import { z } from 'zod';
import {
  emergencyOperationSeverity,
  emergencyOperationStatus,
  emergencyOperationType,
} from '../database/schema';

export type DashboardOperationCursor = {
  updatedAt: Date;
  id: string;
};

const cursorPayloadSchema = z.strictObject({
  updatedAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

/** Encodes the final operation's sort values into an opaque cursor string. */
export function encodeDashboardOperationCursor(
  cursor: DashboardOperationCursor,
): string {
  return Buffer.from(
    JSON.stringify({
      updatedAt: cursor.updatedAt.toISOString(),
      id: cursor.id,
    }),
  ).toString('base64url');
}

/** Decodes and validates an opaque cursor supplied to the operations endpoint. */
function decodeDashboardOperationCursor(
  value: string,
): DashboardOperationCursor | null {
  try {
    const payload = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as unknown;
    const result = cursorPayloadSchema.safeParse(payload);

    if (!result.success) {
      return null;
    }

    const updatedAt = new Date(result.data.updatedAt);

    if (Number.isNaN(updatedAt.getTime())) {
      return null;
    }

    return { updatedAt, id: result.data.id };
  } catch {
    return null;
  }
}

const positiveLimit = z
  .string()
  .regex(/^[1-9]\d*$/, 'limit must be a positive integer')
  .transform(Number)
  .pipe(z.number().max(100, 'limit must not exceed 100'));

const dashboardOperationCursorSchema = z
  .string()
  .min(1)
  .transform((value, context) => {
    const cursor = decodeDashboardOperationCursor(value);

    if (!cursor) {
      context.addIssue({ code: 'custom', message: 'cursor is invalid' });
      return z.NEVER;
    }

    return cursor;
  });

export const dashboardOperationsQuerySchema = z.strictObject({
  limit: positiveLimit.optional().default(25),
  cursor: dashboardOperationCursorSchema.optional(),
  status: z.enum(emergencyOperationStatus.enumValues).optional(),
});

export type DashboardOperationsQuery = z.output<
  typeof dashboardOperationsQuerySchema
>;

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

export type DashboardOperationCardResponse = {
  id: string;
  operationCode: string;
  name: string;
  countryCode: string;
  type: (typeof emergencyOperationType.enumValues)[number];
  severity: (typeof emergencyOperationSeverity.enumValues)[number];
  status: (typeof emergencyOperationStatus.enumValues)[number];
  startedAt: Date | null;
  endedAt: Date | null;
  updatedAt: Date;
};

export type DashboardOperationsListResponse = {
  items: DashboardOperationCardResponse[];
  nextCursor: string | null;
};
