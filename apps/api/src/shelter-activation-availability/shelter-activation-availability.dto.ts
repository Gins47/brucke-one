import { z } from 'zod';

const nonNegativeInteger = z.number().int().nonnegative();

/** Validates a complete shelter-activation availability snapshot. */
export const replaceShelterActivationAvailabilitySchema = z
  .strictObject({
    operationalCapacity: nonNegativeInteger,
    currentOccupancy: nonNegativeInteger,
    reservedPlaces: nonNegativeInteger,
    acceptingArrivals: z.boolean(),
    availabilityNote: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) =>
      value.currentOccupancy + value.reservedPlaces <=
      value.operationalCapacity,
    {
      path: ['reservedPlaces'],
      message:
        'currentOccupancy plus reservedPlaces must not exceed operationalCapacity',
    },
  );

export type ReplaceShelterActivationAvailabilityRequest = z.output<
  typeof replaceShelterActivationAvailabilitySchema
>;

/** Represents a reported availability snapshot and its derived capacity. */
export type ShelterActivationAvailabilityResponse = {
  shelterActivationId: string;
  shelterId: string;
  emergencyOperationId: string;
  organizationId: string;
  operationalCapacity: number;
  currentOccupancy: number;
  reservedPlaces: number;
  availablePlaces: number;
  acceptingArrivals: boolean;
  availabilityNote: string | null;
  reportedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

/** Represents an existing activation for which no availability was reported. */
export type ShelterActivationAvailabilityNotReportedResponse = {
  shelterActivationId: string;
  availability: null;
};

export type ShelterActivationAvailabilityGetResponse =
  | ShelterActivationAvailabilityResponse
  | ShelterActivationAvailabilityNotReportedResponse;
