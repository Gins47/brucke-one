import { z } from 'zod';

const requiredText = z.string().trim().min(1);
const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
const capacity = z.number().int().nonnegative();

/** Ensures coordinates are both omitted, both numeric, or both null. */
function hasValidCoordinateState(value: {
  latitude?: number | null;
  longitude?: number | null;
}): boolean {
  const { latitude, longitude } = value;

  if (latitude === undefined && longitude === undefined) {
    return true;
  }

  if (latitude === null || longitude === null) {
    return latitude === null && longitude === null;
  }

  return typeof latitude === 'number' && typeof longitude === 'number';
}

export const createShelterSchema = z
  .strictObject({
    organizationId: z.uuid(),
    shelterCode: requiredText,
    name: requiredText,
    address: requiredText,
    countryCode: requiredText,
    latitude: latitude.optional(),
    longitude: longitude.optional(),
    capacity,
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
  })
  .refine(hasValidCoordinateState, {
    path: ['latitude'],
    message: 'latitude and longitude must be supplied together',
  });

export const updateShelterSchema = z
  .strictObject({
    name: requiredText.optional(),
    address: requiredText.optional(),
    countryCode: requiredText.optional(),
    capacity: capacity.optional(),
    latitude: latitude.nullable().optional(),
    longitude: longitude.nullable().optional(),
    contactEmail: z.string().email().nullable().optional(),
    contactPhone: z.string().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })
  .refine(hasValidCoordinateState, {
    path: ['latitude'],
    message: 'latitude and longitude must be supplied together',
  });

export type CreateShelterRequest = z.output<typeof createShelterSchema>;
export type UpdateShelterRequest = z.output<typeof updateShelterSchema>;

export type ShelterResponse = {
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
  createdAt: Date;
  updatedAt: Date;
};
