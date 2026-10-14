import { z } from 'zod';
import {
  emergencyOperationSeverity,
  emergencyOperationStatus,
  emergencyOperationType,
} from '../database/schema';

const requiredText = z.string().trim().min(1);
const dateTime = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const operationTimeline = {
  startedAt: dateTime.optional(),
  endedAt: dateTime.optional(),
};

/** Validates that an operation does not end before it starts. */
function hasValidTimeline(value: {
  startedAt?: Date;
  endedAt?: Date;
}): boolean {
  return (
    value.startedAt === undefined ||
    value.endedAt === undefined ||
    value.endedAt >= value.startedAt
  );
}

export const createEmergencyOperationSchema = z
  .strictObject({
    organizationId: z.uuid(),
    operationCode: requiredText,
    name: requiredText,
    description: z.string().optional(),
    countryCode: requiredText,
    type: z.enum(emergencyOperationType.enumValues),
    severity: z.enum(emergencyOperationSeverity.enumValues),
    ...operationTimeline,
  })
  .refine(hasValidTimeline, {
    path: ['endedAt'],
    message: 'endedAt must not be earlier than startedAt',
  });

export const updateEmergencyOperationSchema = z
  .strictObject({
    name: requiredText.optional(),
    description: z.string().nullable().optional(),
    countryCode: requiredText.optional(),
    type: z.enum(emergencyOperationType.enumValues).optional(),
    severity: z.enum(emergencyOperationSeverity.enumValues).optional(),
    ...operationTimeline,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })
  .refine(hasValidTimeline, {
    path: ['endedAt'],
    message: 'endedAt must not be earlier than startedAt',
  });

export type CreateEmergencyOperationRequest = z.output<
  typeof createEmergencyOperationSchema
>;
export type UpdateEmergencyOperationRequest = z.output<
  typeof updateEmergencyOperationSchema
>;
export type EmergencyOperationStatus =
  (typeof emergencyOperationStatus.enumValues)[number];
export type EmergencyOperationType =
  (typeof emergencyOperationType.enumValues)[number];
export type EmergencyOperationSeverity =
  (typeof emergencyOperationSeverity.enumValues)[number];

export type EmergencyOperationResponse = {
  id: string;
  organizationId: string;
  operationCode: string;
  name: string;
  description: string | null;
  countryCode: string;
  type: EmergencyOperationType;
  severity: EmergencyOperationSeverity;
  status: EmergencyOperationStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
