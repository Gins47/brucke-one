import { z } from 'zod';

const requiredText = z.string().trim().min(1);

export const createOrganizationSchema = z.strictObject({
  code: requiredText.max(30),
  name: requiredText.max(255),
  contactEmail: z.string().email().max(255).optional(),
  contactPhone: z.string().max(15).optional(),
  officeAddress: z.string().optional(),
});

export const updateOrganizationSchema = z
  .strictObject({
    name: requiredText.max(255).optional(),
    contactEmail: z.string().email().max(255).nullable().optional(),
    contactPhone: z.string().max(15).nullable().optional(),
    officeAddress: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateOrganizationRequest = z.output<
  typeof createOrganizationSchema
>;
export type UpdateOrganizationRequest = z.output<
  typeof updateOrganizationSchema
>;

export type OrganizationResponse = {
  id: string;
  code: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  officeAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
};
