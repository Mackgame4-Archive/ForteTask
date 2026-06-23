import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(6).max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.email().max(255).transform((email) => email.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
