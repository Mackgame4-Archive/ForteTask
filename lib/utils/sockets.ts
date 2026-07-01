"use client";

export type ChatSocketStatus = "connecting" | "connected" | "fallback" | "closed";

export type ChatSocketUser = {
  id: number;
  name: string;
  email: string;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  userId: number;
  authorName: string;
  authorEmail: string;
  body: string;
  createdAt: string;
};

export type ChatGroup = {
  id: string;
  roomScope: string;
  name: string;
  memberIds: number[];
  createdByUserId: number;
  createdAt: string;
};

export type ChatCallKind = "audio" | "video";

export type ChatCallSignal =
  | {
      id: string;
      type: "call:offer";
      roomId: string;
      callId: string;
      fromUserId: number;
      toUserId: number;
      fromName: string;
      conversationRoomId?: string;
      conversationTitle?: string;
      participantIds?: number[];
      description: RTCSessionDescriptionInit;
      kind: ChatCallKind;
      createdAt: string;
    }
  | {
      id: string;
      type: "call:answer";
      roomId: string;
      callId: string;
      fromUserId: number;
      toUserId: number;
      description: RTCSessionDescriptionInit;
      createdAt: string;
    }
  | {
      id: string;
      type: "call:candidate";
      roomId: string;
      callId: string;
      fromUserId: number;
      toUserId: number;
      candidate: RTCIceCandidateInit;
      createdAt: string;
    }
  | {
      id: string;
      type: "call:end";
      roomId: string;
      callId: string;
      fromUserId: number;
      toUserId: number;
      conversationRoomId?: string;
      conversationTitle?: string;
      participantIds?: number[];
      reason?: "ended" | "declined" | "missed";
      createdAt: string;
    };

export type ChatSocketEvent =
  | {
      type: "chat:join";
      roomId: string;
      user: ChatSocketUser;
    }
  | {
      type: "chat:leave";
      roomId: string;
      user: ChatSocketUser;
    }
  | {
      type: "chat:message";
      message: ChatMessage;
    }
  | {
      type: "chat:signal";
      signal: ChatCallSignal;
    }
  | {
      type: "chat:group";
      group: ChatGroup;
    }
  | {
      type: "chat:group:delete";
      groupId: string;
      roomScope: string;
    }
  | {
      type: "chat:call-presence";
      roomScope: string;
      conversationKey: string;
      user: ChatSocketUser;
      present: boolean;
      kind: ChatCallKind;
    };

export type ChatCallPresence = Extract<ChatSocketEvent, { type: "chat:call-presence" }>;

type ChatSocketOptions = {
  roomId: string;
  user: ChatSocketUser;
  url?: string;
  announcePresence?: boolean;
  onMessage: (message: ChatMessage) => void;
  onGroup?: (group: ChatGroup) => void;
  onGroupDelete?: (groupId: string, roomScope: string) => void;
  onPresenceChange?: (user: ChatSocketUser, online: boolean) => void;
  onCallPresence?: (presence: ChatCallPresence) => void;
  onSignal?: (signal: ChatCallSignal) => void;
  onStatusChange?: (status: ChatSocketStatus) => void;
};

type ChatSocketConnection = {
  close: () => void;
  send: (message: ChatMessage) => void;
  sendGroup: (group: ChatGroup) => void;
  sendGroupDelete: (groupId: string, roomScope: string) => void;
  sendSignal: (signal: ChatCallSignal) => void;
  sendCallPresence: (presence: ChatCallPresence) => void;
};

const fallbackChannelName = "intranet-chat";

function parseSocketEvent(value: string): ChatSocketEvent | null {
  try {
    const event = JSON.parse(value) as Partial<ChatSocketEvent>;

    if (
      event.type === "chat:join" ||
      event.type === "chat:leave" ||
      event.type === "chat:message" ||
      event.type === "chat:signal" ||
      event.type === "chat:group" ||
      event.type === "chat:group:delete" ||
      event.type === "chat:call-presence"
    ) {
      return event as ChatSocketEvent;
    }
  } catch {
    return null;
  }

  return null;
}

function createMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createChatMessage({
  body,
  roomId,
  user,
}: {
  body: string;
  roomId: string;
  user: ChatSocketUser;
}): ChatMessage {
  return {
    id: createMessageId(),
    roomId,
    userId: user.id,
    authorName: user.name,
    authorEmail: user.email,
    body,
    createdAt: new Date().toISOString(),
  };
}

function connectChatSocket({
  roomId,
  user,
  url,
  announcePresence,
  onMessage,
  onGroup,
  onGroupDelete,
  onPresenceChange,
  onCallPresence,
  onSignal,
  onStatusChange,
}: ChatSocketOptions): ChatSocketConnection {
  let closed = false;
  let fallbackSource: EventSource | null = null;
  let socket: WebSocket | null = null;
  const fallbackChannel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(fallbackChannelName);

  function setStatus(status: ChatSocketStatus) {
    onStatusChange?.(status);
  }

  function handleEvent(event: ChatSocketEvent) {
    if (event.type === "chat:join" && event.roomId === roomId) {
      onPresenceChange?.(event.user, true);
      return;
    }

    if (event.type === "chat:leave" && event.roomId === roomId) {
      onPresenceChange?.(event.user, false);
      return;
    }

    if (event.type === "chat:message" && event.message.roomId === roomId) {
      onMessage(event.message);
      return;
    }

    if (event.type === "chat:signal" && event.signal.roomId === roomId) {
      onSignal?.(event.signal);
      return;
    }

    if (event.type === "chat:group") {
      onGroup?.(event.group);
      return;
    }

    if (event.type === "chat:group:delete") {
      onGroupDelete?.(event.groupId, event.roomScope);
      return;
    }

    if (event.type === "chat:call-presence") {
      onCallPresence?.(event);
    }
  }

  function createPresenceEvent(type: "chat:join" | "chat:leave") {
    return {
      type,
      roomId,
      user,
    } satisfies ChatSocketEvent;
  }

  function postEvent(event: ChatSocketEvent) {
    const body = JSON.stringify(event);

    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const sent = navigator.sendBeacon(
        "/api/chat/messages",
        new Blob([body], { type: "application/json" })
      );

      if (sent) {
        return;
      }
    }

    void fetch("/api/chat/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      keepalive: true,
    });
  }

  function startFallback() {
    if (fallbackSource) {
      return;
    }

    setStatus("fallback");
    fallbackSource = new EventSource(
      `/api/chat/messages?roomId=${encodeURIComponent(roomId)}`
    );
    fallbackSource.addEventListener("message", (event) => {
      try {
        const socketEvent = parseSocketEvent(event.data);

        if (socketEvent) {
          handleEvent(socketEvent);
          return;
        }

        handleEvent({
          type: "chat:message",
          message: JSON.parse(event.data) as ChatMessage,
        });
      } catch {
        return;
      }
    });
    fallbackSource.addEventListener("error", () => {
      if (!closed) {
        setStatus("fallback");
      }
    });

    if (announcePresence) {
      postEvent(createPresenceEvent("chat:join"));
    }
  }

  fallbackChannel?.addEventListener("message", (event: MessageEvent<ChatSocketEvent>) => {
    handleEvent(event.data);
  });

  if (url) {
    setStatus("connecting");
    socket = new WebSocket(url);

    socket.addEventListener("open", () => {
      if (closed || !socket) {
        return;
      }

      setStatus("connected");
      socket.send(
        JSON.stringify({
          type: "chat:join",
          roomId,
          user,
        } satisfies ChatSocketEvent)
      );
    });

    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") {
        return;
      }

      const socketEvent = parseSocketEvent(event.data);

      if (socketEvent) {
        handleEvent(socketEvent);
      }
    });

    socket.addEventListener("close", () => {
      if (!closed) {
        startFallback();
      }
    });

    socket.addEventListener("error", () => {
      if (!closed) {
        startFallback();
      }
    });
  } else {
    startFallback();
  }

  return {
    close: () => {
      closed = true;
      if (announcePresence) {
        postEvent(createPresenceEvent("chat:leave"));
      }
      setStatus("closed");
      fallbackSource?.close();
      socket?.close();
      fallbackChannel?.close();
    },
    send: (message) => {
      const event = {
        type: "chat:message",
        message,
      } satisfies ChatSocketEvent;
      const serializedEvent = JSON.stringify(event);

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(serializedEvent);
      } else {
        fallbackChannel?.postMessage(event);
      }

      void fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
    },
    sendGroup: (group) => {
      const event = {
        type: "chat:group",
        group,
      } satisfies ChatSocketEvent;
      const serializedEvent = JSON.stringify(event);

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(serializedEvent);
      } else {
        fallbackChannel?.postMessage(event);
      }

      void fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: serializedEvent,
      });
    },
    sendGroupDelete: (groupId, roomScope) => {
      const event = {
        type: "chat:group:delete",
        groupId,
        roomScope,
      } satisfies ChatSocketEvent;
      const serializedEvent = JSON.stringify(event);

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(serializedEvent);
      } else {
        fallbackChannel?.postMessage(event);
      }

      void fetch("/api/chat/messages", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ groupId, roomScope }),
      });
    },
    sendSignal: (signal) => {
      const event = {
        type: "chat:signal",
        signal,
      } satisfies ChatSocketEvent;
      const serializedEvent = JSON.stringify(event);

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(serializedEvent);
        return;
      }

      fallbackChannel?.postMessage(event);
      void fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: serializedEvent,
      });
    },
    sendCallPresence: (presence) => {
      const serializedEvent = JSON.stringify(presence);

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(serializedEvent);
      } else {
        fallbackChannel?.postMessage(presence);
      }

      // keepalive so a leave fired during unload still reaches the server.
      void fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: serializedEvent,
        keepalive: true,
      });
    },
  };
}

export { connectChatSocket, createChatMessage };
