import Link from "next/link";
import { Settings } from "lucide-react";

import { CreateAlert } from "@/components/create-alert";
import { CreateAlertDialog } from "@/components/create-alert-dialog";
import { PageBase } from "@/components/pages/page-base";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  assignUserToTeamAction,
  assignUserToTenantAction,
  createTeamAction,
  createTenantAction,
  deleteTeamAction,
  deleteTenantAction,
  permanentlyDeleteTeamAction,
  permanentlyDeleteTenantAction,
  recoverTeamAction,
  recoverTenantAction,
} from "@/app/(root)/settings/actions";

type SettingsPageProps = {
  searchParams?: Promise<SettingsSearchParams>;
};

type SettingsSearchParams = {
  error?: string;
  saved?: string;
};

function canManageOrganizations(role?: string) {
  return role === "admin" || role === "manager";
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const [session, params, users] = await Promise.all([
    verifySession(),
    searchParams ?? Promise.resolve({} as SettingsSearchParams),
    db.user.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        tenants: {
          select: {
            tenantId: true,
          },
        },
        teams: {
          select: {
            teamId: true,
          },
        },
      },
    }),
  ]);
  const canManage = canManageOrganizations(session.role);
  const canAssignUsers = session.role === "admin";
  const [tenants, deletedTenants, deletedTeams] = await Promise.all([
    db.tenant.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        name: "asc",
      },
      include: {
        teams: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            name: "asc",
          },
          include: {
            _count: {
              select: {
                users: true,
              },
            },
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    }),
    db.tenant.findMany({
      where: {
        deletedAt: {
          not: null,
        },
      },
      orderBy: {
        deletedAt: "desc",
      },
      include: {
        _count: {
          select: {
            teams: true,
            users: true,
          },
        },
      },
    }),
    db.team.findMany({
      where: {
        deletedAt: {
          not: null,
        },
      },
      orderBy: {
        deletedAt: "desc",
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            deletedAt: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    }),
  ]);
  const hasDeletedThings = deletedTenants.length > 0 || deletedTeams.length > 0;

  return (
    <PageBase
      icon={Settings}
      label="Definições"
      title="Definições do espaço de trabalho"
      description="Gerir organizações, equipas, permissões e itens eliminados."
      action={
        <Link
          href="/settings/profile"
          className={buttonVariants({ className: "w-full sm:w-auto" })}
        >
          Definições do perfil
        </Link>
      }
    >

        <CreateAlertDialog error={params.error} />

        <CreateAlert type="success" title={params.saved} />

        {canManage ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="">
              <CardHeader>
                <CardTitle>Criar organização</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={createTenantAction} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenant-name">Nome</Label>
                    <Input id="tenant-name" name="name" required maxLength={120} />
                  </div>
                  <Button type="submit" className="">
                    Criar organização
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="">
              <CardHeader>
                <CardTitle>Criar equipa</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={createTeamAction} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Organização</Label>
                    <Select
                      name="tenantId"
                      required
                      disabled={tenants.length === 0}
                      items={tenants.map((tenant) => ({
                        value: String(tenant.id),
                        label: tenant.name,
                      }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecionar organização" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map((tenant) => (
                          <SelectItem
                            key={tenant.id}
                            value={String(tenant.id)}
                            label={tenant.name}
                          >
                            {tenant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team-name">Nome</Label>
                    <Input id="team-name" name="name" required maxLength={120} />
                  </div>
                  <Button type="submit" className="" disabled={tenants.length === 0}>
                    Criar equipa
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : (
          <p className="border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            Pode ver organizações e equipas. Administradores e gestores podem criar novas.
          </p>
        )}

        <section className="border border-border bg-card text-card-foreground">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Organizações e equipas</h2>
          </div>
          <div className="divide-y divide-border">
            {tenants.length > 0 ? (
              tenants.map((tenant) => (
                <div key={tenant.id} className="px-5 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">{tenant.name}</h3>
                      <p className="text-sm text-muted-foreground">/{tenant.slug}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <p className="text-sm text-muted-foreground">
                        {tenant.teams.length} equipas - {tenant._count.users} utilizadores
                      </p>
                      {canAssignUsers ? (
                        <form action={deleteTenantAction}>
                          <input type="hidden" name="tenantId" value={tenant.id} />
                          <Button
                            type="submit"
                            variant="destructive"
                            className="h-8"
                          >
                            Eliminar organização
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>

                  {canAssignUsers ? (
                    <form
                      action={assignUserToTenantAction}
                      className="mt-4 flex flex-col gap-2 sm:flex-row"
                    >
                      <input type="hidden" name="tenantId" value={tenant.id} />
                      <Select
                        name="userId"
                        required
                        items={users
                          .filter(
                            (user) =>
                              !user.tenants.some(
                                (membership) => membership.tenantId === tenant.id
                              )
                          )
                          .map((user) => ({
                            value: String(user.id),
                            label: `${user.name} (${user.email})`,
                          }))}
                      >
                        <SelectTrigger className="w-full flex-1 sm:w-auto">
                          <SelectValue placeholder="Adicionar utilizador à organização" />
                        </SelectTrigger>
                        <SelectContent>
                        {users
                          .filter(
                            (user) =>
                              !user.tenants.some(
                                (membership) => membership.tenantId === tenant.id
                              )
                          )
                          .map((user) => (
                            <SelectItem
                              key={user.id}
                              value={String(user.id)}
                              label={`${user.name} (${user.email})`}
                            >
                              {user.name} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="submit" className="">
                        Adicionar utilizador
                      </Button>
                    </form>
                  ) : null}

                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {tenant.teams.length > 0 ? (
                      tenant.teams.map((team) => (
                        <div
                          key={team.id}
                          className="border border-border bg-background p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{team.name}</p>
                              <p className="text-xs text-muted-foreground">/{team.slug}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <p className="text-xs text-muted-foreground">
                                {team._count.users} utilizadores
                              </p>
                              {canAssignUsers ? (
                                <form action={deleteTeamAction}>
                                  <input type="hidden" name="teamId" value={team.id} />
                                  <Button
                                    type="submit"
                                    variant="destructive"
                                    className="h-8"
                                  >
                                    Eliminar equipa
                                  </Button>
                                </form>
                              ) : null}
                            </div>
                          </div>

                          {canAssignUsers ? (
                            <form
                              action={assignUserToTeamAction}
                              className="mt-3 flex flex-col gap-2"
                            >
                              <input type="hidden" name="teamId" value={team.id} />
                              <Select
                                name="userId"
                                required
                                items={users
                                  .filter(
                                    (user) =>
                                      !user.teams.some(
                                        (membership) => membership.teamId === team.id
                                      )
                                  )
                                  .map((user) => ({
                                    value: String(user.id),
                                    label: `${user.name} (${user.email})`,
                                  }))}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Adicionar utilizador à equipa" />
                                </SelectTrigger>
                                <SelectContent>
                                {users
                                  .filter(
                                    (user) =>
                                      !user.teams.some(
                                        (membership) => membership.teamId === team.id
                                      )
                                  )
                                  .map((user) => (
                                    <SelectItem
                                      key={user.id}
                                      value={String(user.id)}
                                      label={`${user.name} (${user.email})`}
                                    >
                                      {user.name} ({user.email})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button type="submit" className="">
                                Adicionar utilizador
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Ainda não existem equipas.</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="px-5 py-4 text-sm text-muted-foreground">
                Ainda não existem organizações.
              </p>
            )}
          </div>
        </section>

        {canAssignUsers ? (
          <section className="border border-destructive/30 bg-card text-card-foreground">
            <div className="border-b border-destructive/20 px-5 py-4">
              <h2 className="text-base font-semibold">Itens eliminados</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Recupere organizações e equipas eliminadas ou remova-as permanentemente.
              </p>
            </div>
            <div className="divide-y divide-border">
              {hasDeletedThings ? (
                <>
                  {deletedTenants.map((tenant) => (
                    <div key={`tenant-${tenant.id}`} className="px-5 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">
                            Organização
                          </p>
                          <h3 className="text-sm font-semibold">{tenant.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            /{tenant.slug} - {tenant._count.teams} equipas -{" "}
                            {tenant._count.users} utilizadores
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <form action={recoverTenantAction}>
                            <input type="hidden" name="tenantId" value={tenant.id} />
                            <Button type="submit" variant="outline" className="w-full sm:w-auto">
                              Recuperar
                            </Button>
                          </form>
                          <form action={permanentlyDeleteTenantAction}>
                            <input type="hidden" name="tenantId" value={tenant.id} />
                            <Button
                              type="submit"
                              variant="destructive"
                              className="w-full sm:w-auto"
                            >
                              Eliminar permanentemente
                            </Button>
                          </form>
                        </div>
                      </div>
                    </div>
                  ))}

                  {deletedTeams.map((team) => (
                    <div key={`team-${team.id}`} className="px-5 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">
                            Equipa
                          </p>
                          <h3 className="text-sm font-semibold">{team.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            /{team.slug} - {team._count.users} utilizadores - organização:{" "}
                            {team.tenant.name}
                            {team.tenant.deletedAt ? " (eliminada)" : ""}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <form action={recoverTeamAction}>
                            <input type="hidden" name="teamId" value={team.id} />
                            <Button type="submit" variant="outline" className="w-full sm:w-auto">
                              Recuperar
                            </Button>
                          </form>
                          <form action={permanentlyDeleteTeamAction}>
                            <input type="hidden" name="teamId" value={team.id} />
                            <Button
                              type="submit"
                              variant="destructive"
                              className="w-full sm:w-auto"
                            >
                              Eliminar permanentemente
                            </Button>
                          </form>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <p className="px-5 py-4 text-sm text-muted-foreground">
                  Nada foi eliminado.
                </p>
              )}
            </div>
          </section>
        ) : null}
    </PageBase>
  );
}
