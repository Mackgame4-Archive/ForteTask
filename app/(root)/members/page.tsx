import { UsersRound } from "lucide-react";

import { CreateAlert } from "@/components/create-alert";
import { CreateAlertDialog } from "@/components/create-alert-dialog";
import { PageBase } from "@/components/pages/page-base";
import { MembersTable } from "@/components/pages/members/members-table";
import { UserRole } from "@/generated/prisma/enums";
import { verifySession } from "@/lib/auth/session";
import { getUsersPageData } from "@/services/users";

type MembersPageProps = {
  searchParams?: Promise<MembersSearchParams>;
};

type MembersSearchParams = {
  error?: string;
  saved?: string;
};

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const [params, session, data] = await Promise.all([
    searchParams ?? Promise.resolve({} as MembersSearchParams),
    verifySession(),
    getUsersPageData(),
  ]);
  const canManageMembers = session.role.toUpperCase() === UserRole.ADMIN;

  return (
    <PageBase
      icon={UsersRound}
      label="Membros"
      title="Membros da aplicação"
      description="Consulte os utilizadores registados e os seus perfis de acesso."
    >

        <CreateAlertDialog error={params.error} />

        <CreateAlert type="success" title={params.saved} />

        <section className="border border-border bg-card p-4 text-card-foreground">
          <MembersTable
            members={data.members}
            tenants={data.tenants}
            teams={data.teams}
            canManageRoles={canManageMembers}
            canManageAssignments={canManageMembers}
          />
        </section>
    </PageBase>
  );
}
