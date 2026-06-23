import { z } from "zod";

function createSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const tenantSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
  })
  .transform((data) => ({
    name: data.name,
    slug: createSlug(data.name),
  }))
  .refine((data) => data.slug.length > 0, {
    path: ["slug"],
    message: "Enter a valid tenant slug.",
  });

export const teamSchema = z
  .object({
    tenantId: z.coerce.number().int().positive(),
    name: z.string().trim().min(1).max(120),
  })
  .transform((data) => ({
    tenantId: data.tenantId,
    name: data.name,
    slug: createSlug(data.name),
  }))
  .refine((data) => data.slug.length > 0, {
    path: ["slug"],
    message: "Enter a valid team slug.",
  });

export const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.email().max(255).transform((email) => email.toLowerCase()),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
  })
  .superRefine((data, context) => {
    if (data.newPassword && data.newPassword.length < 6) {
      context.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "Password must be at least 6 characters.",
      });
    }

    if (data.newPassword && !data.currentPassword) {
      context.addIssue({
        code: "custom",
        path: ["currentPassword"],
        message: "Enter your current password to change it.",
      });
    }
  });

export const assignTenantUserSchema = z.object({
  tenantId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
});

export const assignTeamUserSchema = z.object({
  teamId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
});

export const deleteTenantSchema = z.object({
  tenantId: z.coerce.number().int().positive(),
});

export const deleteTeamSchema = z.object({
  teamId: z.coerce.number().int().positive(),
});

export const recoverTenantSchema = deleteTenantSchema;
export const recoverTeamSchema = deleteTeamSchema;
export const permanentlyDeleteTenantSchema = deleteTenantSchema;
export const permanentlyDeleteTeamSchema = deleteTeamSchema;

export type TenantInput = z.infer<typeof tenantSchema>;
export type TeamInput = z.infer<typeof teamSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type AssignTenantUserInput = z.infer<typeof assignTenantUserSchema>;
export type AssignTeamUserInput = z.infer<typeof assignTeamUserSchema>;
export type DeleteTenantInput = z.infer<typeof deleteTenantSchema>;
export type DeleteTeamInput = z.infer<typeof deleteTeamSchema>;
export type RecoverTenantInput = z.infer<typeof recoverTenantSchema>;
export type RecoverTeamInput = z.infer<typeof recoverTeamSchema>;
export type PermanentlyDeleteTenantInput = z.infer<typeof permanentlyDeleteTenantSchema>;
export type PermanentlyDeleteTeamInput = z.infer<typeof permanentlyDeleteTeamSchema>;
