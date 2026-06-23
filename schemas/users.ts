import { UserRole, type UserRole as UserRoleValue } from "@/generated/prisma/enums";
import { z } from "zod";

export const updateUserRoleSchema = z.object({
  userId: z.coerce.number().int().positive(),
  role: z.enum(Object.values(UserRole) as [UserRoleValue, ...UserRoleValue[]]),
});

const idListSchema = z
  .array(z.union([z.string(), z.number()]))
  .transform((values) =>
    values
      .flatMap((value) => String(value).split(","))
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
  );

export const updateMemberTenantsSchema = z.object({
  userId: z.coerce.number().int().positive(),
  tenantIds: idListSchema,
});

export const updateMemberTeamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
  teamIds: idListSchema,
});

export const updateMemberSchema = z.object({
  userId: z.coerce.number().int().positive(),
  role: z.enum(Object.values(UserRole) as [UserRoleValue, ...UserRoleValue[]]),
  tenantIds: idListSchema,
  teamIds: idListSchema,
});

export const updateMembersSchema = z.object({
  members: z.array(updateMemberSchema).min(1),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateMemberTenantsInput = z.infer<typeof updateMemberTenantsSchema>;
export type UpdateMemberTeamsInput = z.infer<typeof updateMemberTeamsSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type UpdateMembersInput = z.infer<typeof updateMembersSchema>;
