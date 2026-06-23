"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { updateMembersAction } from "@/app/(root)/members/actions";
import { DataTable } from "@/components/data-table";
import { Multiselect, type MultiselectOption } from "@/components/multiselect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserRole, type UserRole as UserRoleType } from "@/generated/prisma/enums";
import type { TeamOption, TenantOption, UserRow } from "@/services/users";

type MembersTableProps = {
  canManageAssignments: boolean;
  canManageRoles: boolean;
  members: UserRow[];
  teams: TeamOption[];
  tenants: TenantOption[];
};

type MemberDraft = {
  role: UserRoleType;
  teamIds: string[];
  tenantIds: string[];
};

const roleLabels: Record<UserRoleType, string> = {
  [UserRole.ADMIN]: "Administrador",
  [UserRole.MANAGER]: "Gestor",
  [UserRole.COORDINATOR]: "Coordenador",
  [UserRole.CONTRIBUTOR]: "Contribuidor",
  [UserRole.MEMBER]: "Membro",
};

const roleOptions = Object.values(UserRole) as UserRoleType[];

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function joinNames(items: string[]) {
  return items.length > 0 ? items.join(", ") : "Sem atribuição";
}

function rowTeamNames(member: UserRow) {
  return member.teams.map(({ team }) => `${team.tenant.name} - ${team.name}`);
}

function getMemberDraft(member: UserRow): MemberDraft {
  return {
    role: member.role,
    teamIds: member.teams.map(({ team }) => String(team.id)),
    tenantIds: member.tenants.map(({ tenant }) => String(tenant.id)),
  };
}

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();

  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function isMemberDraftDirty(member: UserRow, draft: MemberDraft) {
  const original = getMemberDraft(member);

  return (
    draft.role !== original.role ||
    !areStringArraysEqual(draft.tenantIds, original.tenantIds) ||
    !areStringArraysEqual(draft.teamIds, original.teamIds)
  );
}

function MemberTenantsField({
  canManage,
  member,
  onChange,
  options,
  value,
}: {
  canManage: boolean;
  member: UserRow;
  onChange: (value: string[]) => void;
  options: MultiselectOption[];
  value: string[];
}) {
  if (!canManage) {
    return (
      <span className="text-muted-foreground">
        {joinNames(member.tenants.map(({ tenant }) => tenant.name))}
      </span>
    );
  }

  return (
    <div className="min-w-80">
      <Multiselect
        options={options}
        value={value}
        onValueChange={onChange}
        placeholder="Organizações"
        emptyText="Nenhuma organização encontrada."
      />
    </div>
  );
}

function MemberTeamsField({
  canManage,
  member,
  onChange,
  options,
  value,
}: {
  canManage: boolean;
  member: UserRow;
  onChange: (value: string[]) => void;
  options: MultiselectOption[];
  value: string[];
}) {
  if (!canManage) {
    return (
      <span className="text-muted-foreground">
        {joinNames(rowTeamNames(member))}
      </span>
    );
  }

  return (
    <div className="min-w-96">
      <Multiselect
        options={options}
        value={value}
        onValueChange={onChange}
        placeholder="Equipas"
        emptyText="Nenhuma equipa encontrada."
      />
    </div>
  );
}

export function MembersTable({
  canManageAssignments,
  canManageRoles,
  members,
  teams,
  tenants,
}: MembersTableProps) {
  const [drafts, setDrafts] = useState<Record<number, MemberDraft>>(() =>
    Object.fromEntries(members.map((member) => [member.id, getMemberDraft(member)]))
  );
  const tenantOptions = useMemo<MultiselectOption[]>(
    () =>
      tenants.map((tenant) => ({
        value: String(tenant.id),
        label: tenant.name,
      })),
    [tenants]
  );
  const teamOptions = useMemo<MultiselectOption[]>(
    () =>
      teams.map((team) => ({
        value: String(team.id),
        label: `${team.tenant.name} - ${team.name}`,
      })),
    [teams]
  );
  const changedMembers = useMemo(
    () =>
      members
        .map((member) => ({
          member,
          draft: drafts[member.id] ?? getMemberDraft(member),
        }))
        .filter(({ member, draft }) => isMemberDraftDirty(member, draft))
        .map(({ member, draft }) => ({
          userId: member.id,
          role: draft.role,
          tenantIds: draft.tenantIds,
          teamIds: draft.teamIds,
        })),
    [drafts, members]
  );
  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nome",
        cell: ({ row }) => (
          <div className="min-w-44">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "Perfil",
        cell: ({ row }) =>
          canManageRoles ? (
            <div className="min-w-40">
              <Select
                value={drafts[row.original.id]?.role ?? row.original.role}
                onValueChange={(role) =>
                  setDrafts((current) => ({
                    ...current,
                    [row.original.id]: {
                      ...(current[row.original.id] ?? getMemberDraft(row.original)),
                      role: role as UserRoleType,
                    },
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role} label={roleLabels[role]}>
                      {roleLabels[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Badge variant={row.original.role === UserRole.ADMIN ? "default" : "outline"}>
              {roleLabels[row.original.role]}
            </Badge>
          ),
      },
      {
        id: "tenants",
        header: "Organizações",
        accessorFn: (member) =>
          member.tenants.map(({ tenant }) => tenant.name).join(" "),
        cell: ({ row }) => (
          <MemberTenantsField
            canManage={canManageAssignments}
            member={row.original}
            value={
              drafts[row.original.id]?.tenantIds ??
              getMemberDraft(row.original).tenantIds
            }
            onChange={(tenantIds) =>
              setDrafts((current) => ({
                ...current,
                [row.original.id]: {
                  ...(current[row.original.id] ?? getMemberDraft(row.original)),
                  tenantIds,
                },
              }))
            }
            options={tenantOptions}
          />
        ),
      },
      {
        id: "teams",
        header: "Equipas",
        accessorFn: (member) => rowTeamNames(member).join(" "),
        cell: ({ row }) => (
          <MemberTeamsField
            canManage={canManageAssignments}
            member={row.original}
            value={
              drafts[row.original.id]?.teamIds ?? getMemberDraft(row.original).teamIds
            }
            onChange={(teamIds) =>
              setDrafts((current) => ({
                ...current,
                [row.original.id]: {
                  ...(current[row.original.id] ?? getMemberDraft(row.original)),
                  teamIds,
                },
              }))
            }
            options={teamOptions}
          />
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Criado em",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [canManageAssignments, canManageRoles, drafts, teamOptions, tenantOptions]
  );

  return (
    <DataTable
      actions={
        changedMembers.length > 0 ? (
          <form action={updateMembersAction}>
            <input
              type="hidden"
              name="members"
              value={JSON.stringify(changedMembers)}
            />
            <Button type="submit" size="sm">
              Guardar alterações
            </Button>
          </form>
        ) : null
      }
      columns={columns}
      data={members}
      emptyText="Ainda não existem membros."
      pageSize={10}
    />
  );
}
