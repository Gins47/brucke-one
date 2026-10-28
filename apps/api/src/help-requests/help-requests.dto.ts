import { z } from 'zod';

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
