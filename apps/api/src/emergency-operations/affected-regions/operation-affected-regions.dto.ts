import { z } from 'zod';

const requiredText = z.string().trim().min(1);

export const createAffectedRegionSchema = z.strictObject({
  countryCode: requiredText,
  regionCode: requiredText,
  regionName: requiredText,
});

export type CreateAffectedRegionRequest = z.output<
  typeof createAffectedRegionSchema
>;

export type AffectedRegionResponse = {
  id: string;
  emergencyOperationId: string;
  countryCode: string;
  regionCode: string;
  regionName: string;
  addedAt: Date;
  removedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
