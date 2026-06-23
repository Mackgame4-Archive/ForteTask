import "server-only";

import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
};

type PreparedRateLimitRule = RateLimitRule & {
  normalizedKey: string;
};

type RateLimitBucket = {
  key: string;
  limit: number;
  count: number;
  resetAt: Date;
};

type RateLimitResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      retryAfterSeconds: number;
    };

const globalForRateLimit = globalThis as unknown as {
  rateLimitLastCleanupAt?: number;
};

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeKey(key: string) {
  return hashKey(key.trim().toLowerCase());
}

async function cleanupExpiredBuckets(now: Date) {
  const lastCleanupAt = globalForRateLimit.rateLimitLastCleanupAt ?? 0;
  const nowMs = now.getTime();

  if (nowMs - lastCleanupAt < 60_000) {
    return;
  }

  globalForRateLimit.rateLimitLastCleanupAt = nowMs;

  await db.$executeRaw`
    DELETE FROM "rate_limit_bucket"
    WHERE "reset_at" <= ${now}
  `;
}

async function getRateLimitBucket(
  tx: Prisma.TransactionClient,
  rule: PreparedRateLimitRule,
  now: Date
) {
  const key = rule.normalizedKey;
  const resetAt = new Date(now.getTime() + rule.windowMs);
  const rows = await tx.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "rate_limit_bucket" ("key", "count", "reset_at", "updated_at")
    VALUES (${key}, 0, ${resetAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit_bucket"."reset_at" <= ${now} THEN 0
        ELSE "rate_limit_bucket"."count"
      END,
      "reset_at" = CASE
        WHEN "rate_limit_bucket"."reset_at" <= ${now} THEN ${resetAt}
        ELSE "rate_limit_bucket"."reset_at"
      END,
      "updated_at" = ${now}
    RETURNING "count", "reset_at" AS "resetAt"
  `;

  const bucket = rows[0];

  if (!bucket) {
    throw new Error("Could not create rate limit bucket.");
  }

  return {
    key,
    limit: rule.limit,
    count: bucket.count,
    resetAt: bucket.resetAt,
  } satisfies RateLimitBucket;
}

export async function checkRateLimit(
  rules: readonly RateLimitRule[]
): Promise<RateLimitResult> {
  const now = new Date();

  await cleanupExpiredBuckets(now);

  return db.$transaction(async (tx) => {
    const buckets: RateLimitBucket[] = [];
    const preparedRules = rules
      .map((rule) => ({
        ...rule,
        normalizedKey: normalizeKey(rule.key),
      }))
      .sort((a, b) => a.normalizedKey.localeCompare(b.normalizedKey));

    for (const rule of preparedRules) {
      buckets.push(await getRateLimitBucket(tx, rule, now));
    }

    const blockedBucket = buckets.find((bucket) => bucket.count >= bucket.limit);

    if (blockedBucket) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((blockedBucket.resetAt.getTime() - now.getTime()) / 1000)
        ),
      };
    }

    for (const bucket of buckets) {
      await tx.$executeRaw`
        UPDATE "rate_limit_bucket"
        SET "count" = "count" + 1,
            "updated_at" = ${now}
        WHERE "key" = ${bucket.key}
      `;
    }

    return {
      allowed: true,
    };
  });
}

export async function clearRateLimit(keys: readonly string[]) {
  for (const key of keys.map(normalizeKey)) {
    await db.$executeRaw`
      DELETE FROM "rate_limit_bucket"
      WHERE "key" = ${key}
    `;
  }
}
