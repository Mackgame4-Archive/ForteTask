"use client";

import Link from "next/link";
import {
  use,
  useMemo,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LogOut, Search } from "lucide-react";

import { ModeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarSeparator,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { setActiveTenantAction } from "@/app/(auth)/actions";
import type { TenantModel } from "@/generated/prisma/models/Tenant";
import type { SessionPayload } from "@/lib/auth/session-store";
import Config from "@/lib/config";
import menu from "@/lib/menu";
import { canAccessRoles, getRouteRoles } from "@/lib/auth/permissions";

const emptyTenantValue = "__all_tenants__";

type TenantOption = {
  tenant: Pick<TenantModel, "id" | "name" | "slug">;
};

type AppSidebarProps = {
  sessionPromise: Promise<SessionPayload>;
  tenantsPromise: Promise<TenantOption[]>;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function AppSidebar({ sessionPromise, tenantsPromise }: AppSidebarProps) {
  const session = use(sessionPromise);
  const tenants = use(tenantsPromise);
  const pathname = usePathname();
  const router = useRouter();
  const displayName = session.name || session.email;
  const initials = useMemo(() => getInitials(displayName) || "U", [displayName]);
  const [isTenantPending, startTenantTransition] = useTransition();
  const canClearTenant = session.role === "admin";
  const sessionTenantId = session.activeTenantId
    ? String(session.activeTenantId)
    : canClearTenant
      ? emptyTenantValue
      : "";
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null);
  const selectedTenantId =
    isTenantPending && pendingTenantId != null ? pendingTenantId : sessionTenantId;
  const selectedTenant = tenants.find(
    ({ tenant }) => String(tenant.id) === selectedTenantId
  )?.tenant;
  const tenantInitials = getInitials(selectedTenant?.name ?? "") || "FT";
  const [searchQuery, setSearchQuery] = useState("");
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        menu
          .filter((item) =>
            item.submenu?.some((subitem) => pathname === subitem.href)
          )
          .map((item) => [item.name, true])
      )
  );

  function toggleSubmenu(name: string) {
    setOpenSubmenus((current) => ({
      ...current,
      [name]: !current[name],
    }));
  }

  const normalizedSearchQuery = normalizeSearch(searchQuery.trim());
  const visibleMenu = useMemo(
    () =>
      menu
        .map((item) => ({
          ...item,
          submenu: item.submenu?.filter(
            (subitem) => canAccessRoles(session.role, getRouteRoles(subitem.href))
          ),
        }))
        .filter(
          (item) =>
            canAccessRoles(session.role, getRouteRoles(item.href)) &&
            (item.submenu == null || item.submenu.length > 0)
        ),
    [session.role]
  );
  const filteredMenu = useMemo(() => {
    if (!normalizedSearchQuery) {
      return visibleMenu;
    }

    return visibleMenu
      .map((item) => {
        const itemMatches = normalizeSearch(item.name).includes(
          normalizedSearchQuery
        );
        const submenu = item.submenu?.filter((subitem) =>
          normalizeSearch(subitem.name).includes(normalizedSearchQuery)
        );

        if (!itemMatches && !submenu?.length) {
          return null;
        }

        return {
          ...item,
          submenu: itemMatches ? item.submenu : submenu,
        };
      })
      .filter((item) => item !== null);
  }, [normalizedSearchQuery, visibleMenu]);

  const firstSearchHref = useMemo(() => {
    for (const item of filteredMenu) {
      if (item.href && item.href !== "#") {
        return item.href;
      }

      const subitem = item.submenu?.find((entry) => entry.href !== "#");

      if (subitem) {
        return subitem.href;
      }
    }

    return null;
  }, [filteredMenu]);

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || !firstSearchHref) {
      return;
    }

    event.preventDefault();
    router.push(firstSearchHref);
  }

  function handleTenantChange(value: string | null) {
    if (!value) {
      return;
    }

    if (value === emptyTenantValue) {
      if (!canClearTenant) {
        return;
      }

      setPendingTenantId(value);
      startTenantTransition(async () => {
        await setActiveTenantAction(null);
        router.refresh();
      });
      return;
    }

    const tenantId = Number(value);

    if (!tenantId) {
      return;
    }

    setPendingTenantId(value);
    startTenantTransition(async () => {
      await setActiveTenantAction(tenantId);
      router.refresh();
    });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                {tenantInitials}
              </span>
              <Select
                value={selectedTenantId}
                onValueChange={handleTenantChange}
                disabled={tenants.length === 0 || isTenantPending}
              >
                <SelectTrigger className="h-10 min-w-0 flex-1 border-sidebar-border bg-sidebar-accent/40">
                  <span className="truncate text-left">
                    {selectedTenant?.name ?? "Selecionar organização"}
                  </span>
                </SelectTrigger>
                <SelectContent align="start">
                  {canClearTenant ? (
                    <SelectItem value={emptyTenantValue}>
                      Selecionar organização
                    </SelectItem>
                  ) : null}
                  {tenants.map(({ tenant }) => (
                    <SelectItem key={tenant.id} value={String(tenant.id)}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <SidebarTrigger className="shrink-0" />
        </div>

        <div className="flex gap-2 group-data-[collapsible=icon]:hidden">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <SidebarInput
              className="pl-8"
              placeholder="Pesquisar"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <ModeToggle />
        </div>

        <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={selectedTenant?.name ?? Config.APP_NAME}
              render={<Link href="/" />}
              className="justify-center"
            >
              <span className="flex size-8 shrink-0 items-center justify-center bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                {tenantInitials}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenu.map((item) => {
                const Icon = item.icon;
                const BadgeIcon = item.badge?.icon;
                const hasSubmenu = Boolean(item.submenu?.length);
                const isOpen =
                  Boolean(openSubmenus[item.name]) ||
                  Boolean(normalizedSearchQuery && hasSubmenu);
                const isActive =
                  pathname === item.href ||
                  item.submenu?.some((subitem) => pathname === subitem.href) ||
                  (item.href !== "/" && pathname.startsWith(item.href));

                return (
                  <SidebarMenuItem key={item.name}>
                    {hasSubmenu ? (
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.name}
                        aria-expanded={isOpen}
                        className="h-10 px-3 text-sm"
                        onClick={() => toggleSubmenu(item.name)}
                      >
                        {Icon ? <Icon /> : null}
                        <span>{item.name}</span>
                        {item.badge != null && item.badge.text != "0" ? (
                          <Badge
                            variant={item.badge.variant || "secondary"}
                            className="group-data-[collapsible=icon]:hidden"
                          >
                            {BadgeIcon ? (
                              <BadgeIcon
                                data-icon={item.badge.text ? "inline-start" : undefined}
                              />
                            ) : null}
                            {item.badge.text ? item.badge.text : null}
                          </Badge>
                        ) : null}
                        <ChevronRight className="ml-auto transition-transform group-aria-expanded/menu-button:rotate-90" />
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.name}
                        render={<Link href={item.href} />}
                        className="h-10 px-3 text-sm"
                      >
                        {Icon ? <Icon /> : null}
                        <span>{item.name}</span>
                        {item.badge != null && item.badge.text != "0" ? (
                          <Badge
                            variant={item.badge.variant || "secondary"}
                            className="ml-auto group-data-[collapsible=icon]:hidden"
                          >
                            {BadgeIcon ? (
                              <BadgeIcon
                                data-icon={item.badge.text ? "inline-start" : undefined}
                              />
                            ) : null}
                            {item.badge.text ? item.badge.text : null}
                          </Badge>
                        ) : null}
                      </SidebarMenuButton>
                    )}
                    {hasSubmenu && isOpen ? (
                      <SidebarMenuSub>
                        {item.submenu?.map((subitem) => (
                          <SidebarMenuSubItem key={subitem.name}>
                            <SidebarMenuSubButton
                              isActive={pathname === subitem.href}
                              render={<Link href={subitem.href} />}
                              className="h-9 px-3 text-sm"
                            >
                              <span>{subitem.name}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator className="mx-0" />

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-1">
              <SidebarMenuButton
                size="lg"
                tooltip={displayName}
                render={<Link href="/settings/profile" />}
                className="min-w-0 flex-1"
              >
                <Avatar>
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{displayName}</span>
                  <span className="block truncate text-muted-foreground">
                    {session.role}
                  </span>
                </span>
              </SidebarMenuButton>
              <form
                action="/logout"
                method="post"
                className="group-data-[collapsible=icon]:hidden"
              >
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Terminar sessão"
                >
                  <LogOut />
                </Button>
              </form>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
