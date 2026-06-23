import Link from "next/link";
import { Settings } from "lucide-react";

import { updateProfileAction } from "@/app/(root)/settings/actions";
import { CreateAlert } from "@/components/create-alert";
import { CreateAlertDialog } from "@/components/create-alert-dialog";
import { PageBase } from "@/components/pages/page-base";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";

type ProfilePageProps = {
  searchParams?: Promise<ProfileSearchParams>;
};

type ProfileSearchParams = {
  error?: string;
  saved?: string;
};

export default async function ProfileSettingsPage({ searchParams }: ProfilePageProps) {
  const [session, params] = await Promise.all([
    verifySession(),
    searchParams ?? Promise.resolve({} as ProfileSearchParams),
  ]);
  const user = await db.user.findUnique({
    where: {
      id: session.userId,
    },
    select: {
      name: true,
      email: true,
      role: true,
      tenants: {
        select: {
          tenant: {
            select: {
              name: true,
            },
          },
        },
      },
      teams: {
        select: {
          team: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-muted/40 px-4 py-6">
        <div className="mx-auto max-w-3xl border border-border bg-card p-5">
          <p className="text-sm text-destructive">A sua conta de utilizador não foi encontrada.</p>
        </div>
      </div>
    );
  }

  return (
    <PageBase
      icon={Settings}
      label="Definições"
      title="Perfil"
      description="Atualize os dados da sua conta e reveja as suas organizações e equipas."
      action={
        <Link
          href="/settings"
          className={buttonVariants({
            variant: "outline",
            className: "w-full sm:w-auto",
          })}
        >
          Definições da organização
        </Link>
      }
    >

        <CreateAlertDialog error={params.error} />

        <CreateAlert type="success" title={params.saved} />

        <Card className="max-w-3xl">
          <CardContent>
            <div className="grid gap-3 border-b border-border pb-5 text-sm sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground">Função</p>
                <p className="mt-1 font-medium">{user.role.toLowerCase()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Organizações</p>
                <p className="mt-1 font-medium">
                  {user.tenants.length > 0
                    ? user.tenants.map((membership) => membership.tenant.name).join(", ")
                    : "Nenhuma"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Equipas</p>
                <p className="mt-1 font-medium">
                  {user.teams.length > 0
                    ? user.teams.map((membership) => membership.team.name).join(", ")
                    : "Nenhuma"}
                </p>
              </div>
            </div>

            <form action={updateProfileAction} className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome de utilizador</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={user.name}
                  required
                  maxLength={120}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={user.email}
                  required
                  maxLength={255}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Palavra-passe atual</Label>
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova palavra-passe</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                  />
                </div>
              </div>

              <Button type="submit" className="">
                Guardar perfil
              </Button>
            </form>
          </CardContent>
        </Card>
    </PageBase>
  );
}
