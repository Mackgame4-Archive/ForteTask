import { UserRole } from "@/generated/prisma/enums";

export const publicRoutes = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/api/health",
] as const;

export type RoutePermission = {
  path: string;
  roles: readonly UserRole[];
};

export const routePermissions = [
  {
    path: "/members",
    roles: [UserRole.ADMIN],
  },
] as const satisfies readonly RoutePermission[];

export function getRoutePermission(path: string) {
  const routePath = path.split("?")[0].split("#")[0];

  return routePermissions.find(
    (route) => routePath === route.path || routePath.startsWith(`${route.path}/`)
  );
}

export function getRouteRoles(path: string) {
  return getRoutePermission(path)?.roles ?? [];
}

export function isPublicPath(path: string, routes: readonly string[]) {
  return routes.some((route) => path === route || path.startsWith(`${route}/`));
}

export function canAccessRoles(role: string | null | undefined, roles: readonly UserRole[]) {
  if (roles.length === 0) {
    return true;
  }

  return roles.includes(role?.toUpperCase() as UserRole);
}
