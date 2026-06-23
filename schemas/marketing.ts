import { z } from "zod";

import { MarketingPlatform } from "@/generated/prisma/enums";
import { dateInputPattern } from "@/lib/utils/date";

const marketingPlatforms = Object.values(MarketingPlatform) as [
  MarketingPlatform,
  ...MarketingPlatform[],
];

export const marketingExpensePlatformSchema = z.enum(marketingPlatforms);

export const marketingExpenseSchema = z.object({
  platform: marketingExpensePlatformSchema,
  amount: z.coerce.number().positive().max(9999999999.99),
  day: z.string().regex(dateInputPattern),
});

export type MarketingExpenseInput = z.infer<typeof marketingExpenseSchema>;
