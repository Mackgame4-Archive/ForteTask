import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "intranet_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_TOKEN_BYTES = 32;

export function createSessionToken() {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
