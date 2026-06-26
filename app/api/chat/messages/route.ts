import { NextResponse, type NextRequest } from "next/server";

import { verifySession } from "@/lib/auth/session";
import type {
  ChatCallSignal,
  ChatGroup,
  ChatMessage,
  ChatSocketEvent,
  ChatSocketUser,
} from "@/lib/utils/sockets";

const globalChatStore = globalThis as typeof globalThis & {
  __forteTaskChatGroups?: Map<string, Map<string, ChatGroup>>;
  __forteTaskChatMessages?: Map<string, ChatMessage[]>;
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

function getMessageStore() {
  globalChatStore.__forteTaskChatMessages ??= new Map<string, ChatMessage[]>();

  return globalChatStore.__forteTaskChatMessages;
}

function getGroupStore() {
  globalChatStore.__forteTaskChatGroups ??= new Map<string, Map<string, ChatGroup>>();

  return globalChatStore.__forteTaskChatGroups;
}

function getRoomMessages(roomId: string) {
  return getMessageStore().get(roomId) ?? [];
}

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

        for (const message of getRoomMessages(roomId)) {
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

        for (const [roomScope, groups] of getGroupStore()) {
          if (roomId !== getGroupsRoomId(roomScope)) {
            continue;
          }

          for (const group of groups.values()) {
            controller.enqueue(encodeSseEvent({
              type: "chat:group",
              group,
            }));
          }
        }

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
    messages: getRoomMessages(roomId),
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

    const normalizedGroup: ChatGroup = {
      id: group.id,
      roomScope: group.roomScope,
      name: group.name,
      memberIds: Array.from(new Set([...group.memberIds, session.userId])),
      createdByUserId: session.userId,
      createdAt: group.createdAt ?? new Date().toISOString(),
    };
    const store = getGroupStore();
    const scopeGroups = store.get(normalizedGroup.roomScope) ?? new Map<string, ChatGroup>();

    scopeGroups.set(normalizedGroup.id, normalizedGroup);
    store.set(normalizedGroup.roomScope, scopeGroups);
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

  const store = getMessageStore();
  const messages = store.get(message.roomId) ?? [];

  if (!messages.some((currentMessage) => currentMessage.id === message.id)) {
    const nextMessages = [
      ...messages,
      message as ChatMessage,
    ].slice(-100);

    store.set(message.roomId, nextMessages);
    publishEvent(message.roomId, {
      type: "chat:message",
      message: message as ChatMessage,
    });
  }

  return NextResponse.json({ saved: true });
}
