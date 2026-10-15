import { z } from 'zod';
import { shelterActivationStatus } from '../database/schema';

export const createShelterActivationSchema = z.strictObject({
  shelterId: z.uuid(),
  emergencyOperationId: z.uuid(),
});

export type CreateShelterActivationRequest = z.output<
  typeof createShelterActivationSchema
>;
export type ShelterActivationStatus =
  (typeof shelterActivationStatus.enumValues)[number];

export type ShelterActivationResponse = {
  id: string;
  organizationId: string;
  shelterId: string;
  emergencyOperationId: string;
  status: ShelterActivationStatus;
  activatedAt: Date;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
