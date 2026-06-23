import Link from "next/link";
import { ChevronDown, Columns3, Plus } from "lucide-react";

import { createBoardAction } from "@/app/(root)/boards/actions";
import { CreateAlert } from "@/components/create-alert";
import { CreateAlertDialog } from "@/components/create-alert-dialog";
import { Multiselect } from "@/components/multiselect";
import { PageBase } from "@/components/pages/page-base";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  CardHeader,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBoardsPageData } from "@/services/boards";

type BoardsPageProps = {
  searchParams?: Promise<BoardsSearchParams>;
};

type BoardsSearchParams = {
  error?: string;
  saved?: string;
};

export default async function BoardsPage({ searchParams }: BoardsPageProps) {
  const [{ tenant, canCreate, teams, boards }, params] = await Promise.all([
    getBoardsPageData(),
    searchParams ?? Promise.resolve({} as BoardsSearchParams),
  ]);

  return (
    <PageBase
      icon={Columns3}
      label="Quadros"
      title="Quadros Kanban"
      description={
        tenant
          ? `A gerir quadros para ${tenant.name}.`
          : "Selecione uma organização na barra lateral para gerir quadros."
      }
    >

        <CreateAlertDialog error={params.error} />

        <CreateAlert type="success" title={params.saved} />

        {canCreate ? (
          <Card>
            <Collapsible>
              <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                <span>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="size-4" />
                    Criar quadro
                  </CardTitle>
                  <CardDescription>
                    Novos quadros começam com as colunas A fazer, Em progresso e Concluído.
                  </CardDescription>
                </span>
                <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-data-panel-open:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <form action={createBoardAction} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="board-name">Nome</Label>
                      <Input
                        id="board-name"
                        name="name"
                        required
                        maxLength={120}
                        disabled={!tenant}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Equipas partilhadas</Label>
                      {teams.length > 0 ? (
                        <Multiselect
                          name="teamIds"
                          required
                          defaultValue={[]}
                          options={teams.map((team) => ({
                            label: team.name,
                            value: String(team.id),
                          }))}
                          placeholder="Selecionar equipas"
                          emptyText="Nenhuma equipa encontrada."
                        />
                      ) : (
                        <p className="border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                          Ainda não existem equipas nesta organização.
                        </p>
                      )}
                    </div>

                    <Button type="submit" disabled={!tenant || teams.length === 0}>
                      <Plus />
                      Criar quadro
                    </Button>
                  </form>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {boards.length > 0 ? (
            boards.map((board) => (
              <Card key={board.id} className="h-full p-0">
                <Link
                  href={`/boards/${board.id}`}
                  className="block transition-colors hover:bg-accent/40 pt-4"
                >
                  <CardHeader className="border-b border-border">
                    <CardTitle>{board.name}</CardTitle>
                    <CardDescription>
                      {board._count.columns} colunas
                    </CardDescription>
                  </CardHeader>
                </Link>
                <CardContent>
                  <div className="flex flex-wrap gap-2 pb-4">
                    {board.teams.length > 0 ? (
                      board.teams.map(({ team }) => (
                        <Badge key={team.id} variant="outline">
                          {team.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Não partilhado com uma equipa.
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="md:col-span-2 xl:col-span-3">
              <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
                <Columns3 className="size-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Ainda não existem quadros.</p>
                  <p className="text-sm text-muted-foreground">
                    Crie o primeiro quadro Kanban para esta organização.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
    </PageBase>
  );
}
