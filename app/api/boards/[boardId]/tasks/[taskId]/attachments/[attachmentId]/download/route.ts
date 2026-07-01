import { NextResponse } from "next/server";

import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getTaskAttachmentDownloadUrl } from "@/lib/storage/task-attachments";

type DownloadTaskAttachmentRouteProps = {
  params: Promise<{
    attachmentId: string;
    boardId: string;
    taskId: string;
  }>;
};

function canManageBoards(role?: string) {
  return role === "admin" || role === "manager" || role === "coordinator";
}

export async function GET(_request: Request, { params }: DownloadTaskAttachmentRouteProps) {
  const [{ attachmentId, boardId, taskId }, session] = await Promise.all([
    params,
    verifySession(),
  ]);
  const numericBoardId = Number(boardId);
  const numericTaskId = Number(taskId);
  const numericAttachmentId = Number(attachmentId);

  if (
    !session.activeTenantId ||
    !Number.isInteger(numericBoardId) ||
    !Number.isInteger(numericTaskId) ||
    !Number.isInteger(numericAttachmentId)
  ) {
    return NextResponse.json({ error: "Invalid attachment." }, { status: 400 });
  }

  const membership = await db.tenantUser.findUnique({
    where: {
      userId_tenantId: {
        userId: session.userId,
        tenantId: session.activeTenantId,
      },
    },
    select: {
      tenantId: true,
      tenant: {
        select: {
          deletedAt: true,
        },
      },
    },
  });

  if (!membership || membership.tenant.deletedAt) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const userTeams = await db.teamUser.findMany({
    where: {
      userId: session.userId,
      team: {
        tenantId: membership.tenantId,
        deletedAt: null,
      },
    },
    select: {
      teamId: true,
    },
  });
  const userTeamIds = userTeams.map((team) => team.teamId);
  const canManage = canManageBoards(session.role);
  const attachment = await db.taskAttachment.findFirst({
    where: {
      id: numericAttachmentId,
      taskId: numericTaskId,
      task: {
        column: {
          boardId: numericBoardId,
          board: {
            tenantId: membership.tenantId,
            ...(canManage
              ? {}
              : {
                  teams: {
                    some: {
                      teamId: {
                        in: userTeamIds,
                      },
                    },
                  },
                }),
          },
        },
      },
    },
    select: {
      contentType: true,
      fileName: true,
      objectKey: true,
    },
  });

  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  const url = await getTaskAttachmentDownloadUrl(attachment);

  return NextResponse.redirect(url);
}
