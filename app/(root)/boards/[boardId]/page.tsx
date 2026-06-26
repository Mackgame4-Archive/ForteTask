import { notFound } from "next/navigation";
import { Pencil, Share2 } from "lucide-react";

import {
  updateBoardAction,
} from "@/app/(root)/boards/actions";
import { BoardCalendar } from "@/components/pages/boards/board-calendar";
import { BoardKanban } from "@/components/pages/boards/board-kanban";
import { BoardTable } from "@/components/pages/boards/board-table";
import { BoardTimeline } from "@/components/pages/boards/board-timeline";
import { CustomFieldsInput } from "@/components/pages/boards/custom-fields-input";
import {
  BoardViewSelect,
  type BoardView,
} from "@/components/pages/boards/board-view-select";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/pages/page-layout";
import { Multiselect } from "@/components/multiselect";
import { TagInput } from "@/components/tag-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getBoardPageData } from "@/services/boards";

type BoardPageProps = {
  params: Promise<{
    boardId: string;
  }>;
  searchParams?: Promise<{
    view?: string;
  }>;
};

export default async function BoardPage({ params, searchParams }: BoardPageProps) {
  const [{ boardId }, pageParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { view?: string }),
  ]);
  const data = await getBoardPageData(boardId);

  if (!data) {
    notFound();
  }

  const { session, canManage, teams, boardMembers, board, totalTasks } = data;
  const view: BoardView =
    pageParams.view === "calendar"
      ? "calendar"
      : pageParams.view === "timeline"
        ? "timeline"
        : pageParams.view === "table"
          ? "table"
          : "board";
  const boardColumns = board.columns.map((column) => ({
    ...column,
    tasks: column.tasks.map((task) => ({
      ...task,
      columnId: task.columnId ?? column.id,
    })),
  }));

  return (
    <PageLayout
      title={board.name}
      backHref="/boards"
      backLabel="Voltar aos quadros"
      contentClassName={
        view === "board" || view === "timeline" ? "overflow-x-auto" : undefined
      }
      footer={
        <>
          <span>{boardColumns.length} colunas</span>
          <span>{totalTasks} tarefas</span>
          <span>{board.teams.length} equipas</span>
        </>
      }
      actions={
        <>
            <BoardViewSelect value={view} />
            {canManage ? (
              <Sheet>
                <SheetTrigger
                  render={
                    <Button type="button" variant="outline" size="sm" />
                  }
                >
                  <Pencil />
                  Editar
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Editar quadro</SheetTitle>
                    <SheetDescription>
                      Altere o nome e as etiquetas do quadro.
                    </SheetDescription>
                  </SheetHeader>
                  <form action={updateBoardAction} className="space-y-4 p-4">
                    <input type="hidden" name="boardId" value={board.id} />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={`/boards/${board.id}`}
                    />
                    {board.teams.map(({ team }) => (
                      <input
                        key={team.id}
                        type="hidden"
                        name="teamIds"
                        value={team.id}
                      />
                    ))}
                    <div className="space-y-2">
                      <Label htmlFor="board-name">Nome</Label>
                      <Input
                        id="board-name"
                        name="name"
                        defaultValue={board.name}
                        required
                        maxLength={120}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Etiquetas</Label>
                      <TagInput
                        name="labels"
                        defaultValue={board.labels.map((label) => label.name)}
                        placeholder="Adicionar etiquetas"
                      />
                    </div>
                    <CustomFieldsInput defaultValue={board.customFields} />
                    <Button type="submit" className="w-full">
                      Guardar alterações
                    </Button>
                  </form>
                </SheetContent>
              </Sheet>
            ) : null}
            {canManage ? (
              <Sheet>
                <SheetTrigger
                  render={
                    <Button type="button" variant="default" size="sm" />
                  }
                >
                  <Share2 />
                  Partilhar
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Partilhar quadro</SheetTitle>
                    <SheetDescription>
                      Escolha que equipas podem aceder a este quadro.
                    </SheetDescription>
                  </SheetHeader>
                  <form action={updateBoardAction} className="space-y-4 p-4">
                    <input type="hidden" name="boardId" value={board.id} />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={`/boards/${board.id}`}
                    />
                    <input type="hidden" name="name" value={board.name} />
                    {board.labels.map((label) => (
                      <input
                        key={label.id}
                        type="hidden"
                        name="labels"
                        value={label.name}
                      />
                    ))}
                    {board.customFields.map((field) => (
                      <span key={field.id} className="contents">
                        <input type="hidden" name="customFieldId" value={field.id} />
                        <input type="hidden" name="customFieldName" value={field.name} />
                        <input type="hidden" name="customFieldType" value={field.type} />
                        <input
                          type="hidden"
                          name="customFieldMinValue"
                          value={field.minValue ?? ""}
                        />
                        <input
                          type="hidden"
                          name="customFieldMaxValue"
                          value={field.maxValue ?? ""}
                        />
                      </span>
                    ))}
                    <div className="space-y-2">
                      <Label>Equipas partilhadas</Label>
                      <Multiselect
                        name="teamIds"
                        required
                        defaultValue={board.teams.map(({ team }) =>
                          String(team.id)
                        )}
                        options={teams.map((team) => ({
                          label: team.name,
                          value: String(team.id),
                        }))}
                        placeholder="Selecionar equipas"
                        emptyText="Nenhuma equipa encontrada."
                      />
                    </div>
                    <Button type="submit" className="w-full">
                      Guardar partilha
                    </Button>
                  </form>
                </SheetContent>
              </Sheet>
            ) : null}
        </>
      }
    >
      {view === "calendar" ? (
        <BoardCalendar
          boardId={board.id}
          boardName={board.name}
          columns={boardColumns}
          boardLabels={board.labels}
          boardCustomFields={board.customFields}
          boardMembers={boardMembers}
          userName={session.name}
          userEmail={session.email}
        />
      ) : view === "timeline" ? (
        <BoardTimeline
          boardId={board.id}
          boardName={board.name}
          columns={boardColumns}
          boardLabels={board.labels}
          boardCustomFields={board.customFields}
          boardMembers={boardMembers}
          userName={session.name}
          userEmail={session.email}
        />
      ) : view === "table" ? (
        <BoardTable
          boardId={board.id}
          columns={boardColumns}
          boardLabels={board.labels}
          boardCustomFields={board.customFields}
          boardMembers={boardMembers}
          userName={session.name}
          userEmail={session.email}
        />
      ) : (
        <BoardKanban
          boardId={board.id}
          canManage={canManage}
          columns={boardColumns}
          boardLabels={board.labels}
          boardCustomFields={board.customFields}
          boardMembers={boardMembers}
          userName={session.name}
          userEmail={session.email}
        />
      )}
    </PageLayout>
  );
}
