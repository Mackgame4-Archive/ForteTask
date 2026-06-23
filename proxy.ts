import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  canAccessRoles,
  getRoutePermission,
  isPublicPath,
  publicRoutes,
} from "@/lib/auth/permissions";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { getSessionFromToken } from "@/lib/auth/session-store";
import {
  DatabaseConnectionError,
  warnIfDatabaseConnectionError,
} from "@/lib/utils/errors";

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicRoute = isPublicPath(path, publicRoutes);
  const isApiRoute = path === "/api" || path.startsWith("/api/");
  const isServerAction = request.headers.has("next-action");
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const protectedRoute = getRoutePermission(path);

  if (isServerAction) {
    return NextResponse.next();
  }

  if (isPublicRoute && isApiRoute) {
    return NextResponse.next();
  }

  let session = null;

  try {
    session = sessionCookie ? await getSessionFromToken(sessionCookie) : null;
  } catch (error) {
    if (!warnIfDatabaseConnectionError(error)) {
      throw error;
    }

    if (isApiRoute) {
      return NextResponse.json(
        { error: DatabaseConnectionError.defaultMessage },
        { status: 503 }
      );
    }

    return NextResponse.next();
  }

  if (isApiRoute && !session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPublicRoute && !isApiRoute && !session?.userId) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  if (isPublicRoute && session?.userId) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  if (protectedRoute) {
    if (!session?.userId) {
      return NextResponse.redirect(new URL("/login", request.nextUrl));
    }

    if (!canAccessRoles(session?.role, protectedRoute.roles)) {
      return NextResponse.rewrite(new URL("/_not-found", request.url), {
        status: 404,
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
