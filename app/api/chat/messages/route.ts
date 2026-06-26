import { NextResponse, type NextRequest } from "next/server";

import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type {
  ChatCallSignal,
  ChatGroup,
  ChatMessage,
  ChatSocketEvent,
  ChatSocketUser,
} from "@/lib/utils/sockets";

const globalChatStore = globalThis as typeof globalThis & {
  __forteTaskChatPresence?: Map<string, Map<number, ChatSocketUser>>;
  __forteTaskChatSubscribers?: Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>;
};

type ChatPostPayload = Partial<ChatMessage> & {
  group?: Partial<ChatGroup>;
  message?: Partial<ChatMessage>;
  signal?: Partial<ChatCallSignal>;
  type?: ChatSocketEvent["type"];
  user?: Partial<ChatSocketUser>;
};

type ChatDeletePayload = {
  groupId?: string;
  roomScope?: string;
};

function getPresenceStore() {
  globalChatStore.__forteTaskChatPresence ??= new Map<
    string,
    Map<number, ChatSocketUser>
  >();

  return globalChatStore.__forteTaskChatPresence;
}

function getSubscriberStore() {
  globalChatStore.__forteTaskChatSubscribers ??= new Map<
    string,
    Set<ReadableStreamDefaultController<Uint8Array>>
  >();

  return globalChatStore.__forteTaskChatSubscribers;
}

const sseEncoder = new TextEncoder();

function encodeSseEvent(event: ChatSocketEvent) {
  return sseEncoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function publishEvent(roomId: string, event: ChatSocketEvent) {
  const subscribers = getSubscriberStore().get(roomId);

  if (!subscribers) {
    return;
  }

  for (const subscriber of subscribers) {
    try {
      subscriber.enqueue(encodeSseEvent(event));
    } catch {
      subscribers.delete(subscriber);
    }
  }
}

function getGroupsRoomId(roomScope: string) {
  return `${roomScope}:groups`;
}

function toChatMessage(message: {
  id: string;
  roomId: string;
  userId: number;
  authorName: string;
  authorEmail: string;
  body: string;
  createdAt: Date;
}): ChatMessage {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
  };
}

function toChatGroup(group: {
  id: string;
  roomScope: string;
  name: string;
  createdByUserId: number;
  createdAt: Date;
  members: {
    userId: number;
  }[];
}): ChatGroup {
  return {
    id: group.id,
    roomScope: group.roomScope,
    name: group.name,
    memberIds: group.members.map((member) => member.userId),
    createdByUserId: group.createdByUserId,
    createdAt: group.createdAt.toISOString(),
  };
}

async function getRoomMessages(roomId: string) {
  const messages = await db.chatMessage.findMany({
    where: {
      roomId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  return messages.reverse().map(toChatMessage);
}

async function getRoomScopeGroups(roomScope: string) {
  const groups = await db.chatGroup.findMany({
    where: {
      roomScope,
    },
    include: {
      members: {
        select: {
          userId: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return groups.map(toChatGroup);
}

export async function GET(request: NextRequest) {
  await verifySession();

  const roomId = request.nextUrl.searchParams.get("roomId");

  if (!roomId) {
    return NextResponse.json({ messages: [] });
  }

  if (request.headers.get("accept")?.includes("text/event-stream")) {
    const subscribers = getSubscriberStore();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const roomSubscribers = subscribers.get(roomId) ?? new Set();
        const heartbeat = setInterval(() => {
          controller.enqueue(sseEncoder.encode(": keep-alive\n\n"));
        }, 25_000);

        roomSubscribers.add(controller);
        subscribers.set(roomId, roomSubscribers);

        void (async () => {
          for (const message of await getRoomMessages(roomId)) {
            controller.enqueue(encodeSseEvent({
              type: "chat:message",
              message,
            }));
          }

          for (const user of getPresenceStore().get(roomId)?.values() ?? []) {
            controller.enqueue(encodeSseEvent({
              type: "chat:join",
              roomId,
              user,
            }));
          }

          const roomScope = roomId.endsWith(":groups")
            ? roomId.slice(0, -":groups".length)
            : null;

          if (roomScope) {
            for (const group of await getRoomScopeGroups(roomScope)) {
              controller.enqueue(encodeSseEvent({
                type: "chat:group",
                group,
              }));
            }
          }
        })();

        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          roomSubscribers.delete(controller);

          if (!roomSubscribers.size) {
            subscribers.delete(roomId);
          }

          try {
            controller.close();
          } catch {
            return;
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
      },
    });
  }

  return NextResponse.json({
    messages: await getRoomMessages(roomId),
  });
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  const payload = (await request.json()) as ChatPostPayload;
  const message =
    payload.type === "chat:message"
      ? payload.message
      : (payload as Partial<ChatMessage>);
  const signal =
    payload.type === "chat:signal"
      ? payload.signal
      : null;
  const group =
    payload.type === "chat:group"
      ? payload.group
      : null;
  const presenceType =
    payload.type === "chat:join" || payload.type === "chat:leave"
      ? payload.type
      : null;
  const presenceUser =
    presenceType
      ? payload.user
      : null;

  if (presenceType && presenceUser) {
    if (
      !payload.roomId ||
      !presenceUser.id ||
      presenceUser.id !== session.userId ||
      !presenceUser.name ||
      !presenceUser.email
    ) {
      return NextResponse.json(
        { error: "Presenca invalida." },
        { status: 400 }
      );
    }

    const presence = getPresenceStore();
    const roomPresence = presence.get(payload.roomId) ?? new Map<number, ChatSocketUser>();

    if (presenceType === "chat:join") {
      roomPresence.set(presenceUser.id, presenceUser as ChatSocketUser);
      presence.set(payload.roomId, roomPresence);
    } else {
      roomPresence.delete(presenceUser.id);

      if (roomPresence.size) {
        presence.set(payload.roomId, roomPresence);
      } else {
        presence.delete(payload.roomId);
      }
    }

    publishEvent(payload.roomId, {
      type: presenceType,
      roomId: payload.roomId,
      user: presenceUser as ChatSocketUser,
    });

    return NextResponse.json({ sent: true });
  }

  if (group) {
    if (
      !group.id ||
      !group.roomScope ||
      !group.name ||
      !Array.isArray(group.memberIds) ||
      group.createdByUserId !== session.userId
    ) {
      return NextResponse.json(
        { error: "Grupo invalido." },
        { status: 400 }
      );
    }

    const memberIds = Array.from(new Set([...group.memberIds, session.userId]));
    const createdAt = group.createdAt ? new Date(group.createdAt) : new Date();
    const savedGroup = await db.chatGroup.upsert({
      where: {
        id: group.id,
      },
      update: {
        name: group.name,
        members: {
          createMany: {
            data: memberIds.map((userId) => ({ userId })),
            skipDuplicates: true,
          },
        },
      },
      create: {
        id: group.id,
        roomScope: group.roomScope,
        name: group.name,
        createdByUserId: session.userId,
        createdAt,
        members: {
          createMany: {
            data: memberIds.map((userId) => ({ userId })),
            skipDuplicates: true,
          },
        },
      },
      include: {
        members: {
          select: {
            userId: true,
          },
        },
      },
    });
    const normalizedGroup = toChatGroup(savedGroup);

    publishEvent(getGroupsRoomId(normalizedGroup.roomScope), {
      type: "chat:group",
      group: normalizedGroup,
    });

    return NextResponse.json({ saved: true });
  }

  if (signal) {
    const callSignal = signal as Partial<ChatCallSignal>;

    if (
      !callSignal.id ||
      !callSignal.roomId ||
      !callSignal.callId ||
      callSignal.fromUserId !== session.userId ||
      !callSignal.toUserId
    ) {
      return NextResponse.json(
        { error: "Sinal de chamada invalido." },
        { status: 400 }
      );
    }

    publishEvent(callSignal.roomId, {
      type: "chat:signal",
      signal: callSignal as ChatCallSignal,
    });

    return NextResponse.json({ sent: true });
  }

  if (
    !message ||
    !message.id ||
    !message.roomId ||
    !message.body ||
    message.userId !== session.userId
  ) {
    return NextResponse.json(
      { error: "Mensagem inválida." },
      { status: 400 }
    );
  }

  const chatMessage = message as ChatMessage;

  try {
    const savedMessage = await db.chatMessage.create({
      data: {
        id: chatMessage.id,
        roomId: chatMessage.roomId,
        userId: session.userId,
        authorName: session.name.slice(0, 120),
        authorEmail: session.email.slice(0, 255),
        body: chatMessage.body.slice(0, 4000),
        createdAt: new Date(chatMessage.createdAt),
      },
    });

    publishEvent(message.roomId, {
      type: "chat:message",
      message: toChatMessage(savedMessage),
    });
  } catch {
    return NextResponse.json({ saved: true });
  }

  return NextResponse.json({ saved: true });
}

export async function DELETE(request: NextRequest) {
  const session = await verifySession();
  const payload = (await request.json()) as ChatDeletePayload;

  if (!payload.groupId || !payload.roomScope) {
    return NextResponse.json(
      { error: "Grupo inválido." },
      { status: 400 }
    );
  }

  const group = await db.chatGroup.findFirst({
    where: {
      id: payload.groupId,
      roomScope: payload.roomScope,
      members: {
        some: {
          userId: session.userId,
        },
      },
    },
    include: {
      members: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!group) {
    return NextResponse.json(
      { error: "Grupo não encontrado." },
      { status: 404 }
    );
  }

  if (group.createdByUserId === session.userId) {
    await db.chatGroup.delete({
      where: {
        id: group.id,
      },
    });

    publishEvent(getGroupsRoomId(group.roomScope), {
      type: "chat:group:delete",
      groupId: group.id,
      roomScope: group.roomScope,
    });

    return NextResponse.json({ deleted: true });
  }

  await db.chatGroupMember.delete({
    where: {
      groupId_userId: {
        groupId: group.id,
        userId: session.userId,
      },
    },
  });

  const nextGroup = await db.chatGroup.findUnique({
    where: {
      id: group.id,
    },
    include: {
      members: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!nextGroup || !nextGroup.members.length) {
    await db.chatGroup.delete({
      where: {
        id: group.id,
      },
    });

    publishEvent(getGroupsRoomId(group.roomScope), {
      type: "chat:group:delete",
      groupId: group.id,
      roomScope: group.roomScope,
    });

    return NextResponse.json({ deleted: true });
  }

  publishEvent(getGroupsRoomId(nextGroup.roomScope), {
    type: "chat:group",
    group: toChatGroup(nextGroup),
  });

  return NextResponse.json({ left: true });
}
