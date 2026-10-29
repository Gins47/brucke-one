import { z } from 'zod';

import { helpRequestStatus } from '../database/schema';

const requiredText = z.string().trim().min(1);

/** Validates and normalizes a two-letter route country code. */
export const countryCodeSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z]{2}$/, 'countryCode must be a two-letter ISO code')
  .transform((value) => value.toUpperCase());

/** Validates the minimal public information needed to submit a help request. */
export const createPublicHelpRequestSchema = z.strictObject({
  emergencyOperationId: z.uuid(),
  requesterName: requiredText,
  requesterPhone: requiredText,
  requesterEmail: z.string().trim().toLowerCase().email().optional(),
  groupSize: z.number().int().positive(),
  locationDescription: requiredText,
  canTravelIndependently: z.boolean(),
  medicalSupportNeeded: z.boolean(),
});

export type CreatePublicHelpRequestRequest = z.output<
  typeof createPublicHelpRequestSchema
>;

export type PublicAffectedRegionResponse = {
  countryCode: string;
  regionCode: string;
  regionName: string;
};

export type PublicEmergencyOperationResponse = {
  id: string;
  operationCode: string;
  name: string;
  countryCode: string;
  affectedRegions: PublicAffectedRegionResponse[];
};

export type PublicHelpRequestAcknowledgement = {
  acknowledgementReference: string;
  status: 'PENDING_REVIEW';
  acknowledgedAt: Date;
  message: string;
};

export type HelpRequestQueueCursor = {
  createdAt: Date;
  id: string;
};

const queueCursorPayloadSchema = z.strictObject({
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

/** Encodes the final queue item's sort values into an opaque cursor. */
export function encodeHelpRequestQueueCursor(
  cursor: HelpRequestQueueCursor,
): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    }),
  ).toString('base64url');
}

/** Decodes and validates an opaque cursor provided to the operator queue. */
function decodeHelpRequestQueueCursor(
  value: string,
): HelpRequestQueueCursor | null {
  try {
    const payload = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as unknown;
    const result = queueCursorPayloadSchema.safeParse(payload);

    if (!result.success) {
      return null;
    }

    const createdAt = new Date(result.data.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }

    return { createdAt, id: result.data.id };
  } catch {
    return null;
  }
}

const queueLimitSchema = z
  .string()
  .regex(/^[1-9]\d*$/, 'limit must be a positive integer')
  .transform(Number)
  .pipe(z.number().max(100, 'limit must not exceed 100'));

const queueCursorSchema = z
  .string()
  .min(1)
  .transform((value, context) => {
    const cursor = decodeHelpRequestQueueCursor(value);

    if (!cursor) {
      context.addIssue({ code: 'custom', message: 'cursor is invalid' });
      return z.NEVER;
    }

    return cursor;
  });

/** Validates the strict, cursor-paginated operator help-request queue query. */
export const helpRequestQueueQuerySchema = z.strictObject({
  limit: queueLimitSchema.optional().default(20),
  cursor: queueCursorSchema.optional(),
  status: z
    .enum(helpRequestStatus.enumValues)
    .optional()
    .default('PENDING_REVIEW'),
});

export type HelpRequestQueueQuery = z.output<
  typeof helpRequestQueueQuerySchema
>;

export type OperatorHelpRequestResponse = {
  id: string;
  publicReference: string;
  requesterName: string;
  requesterPhone: string;
  requesterEmail: string | null;
  groupSize: number;
  locationDescription: string;
  canTravelIndependently: boolean;
  medicalSupportNeeded: boolean;
  status: (typeof helpRequestStatus.enumValues)[number];
  createdAt: Date;
};

export type HelpRequestQueueResponse = {
  items: OperatorHelpRequestResponse[];
  nextCursor: string | null;
};
