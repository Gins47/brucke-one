import { z } from 'zod';

export const loginSchema = z
  .object({
    username: z.string().min(1, 'username is required'),
    password: z.string().min(1, 'password is required'),
  })
  .strict();

export type LoginRequest = z.infer<typeof loginSchema>;

/** Defines the access-token response returned by the public login endpoint. */
export type LoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
};
