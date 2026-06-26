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
      createdAt: string;
    };

export type ChatSocketEvent =
  | {
      type: "chat:join";
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
    };

type ChatSocketOptions = {
  roomId: string;
  user: ChatSocketUser;
  url?: string;
  onMessage: (message: ChatMessage) => void;
  onSignal?: (signal: ChatCallSignal) => void;
  onStatusChange?: (status: ChatSocketStatus) => void;
};

type ChatSocketConnection = {
  close: () => void;
  send: (message: ChatMessage) => void;
  sendSignal: (signal: ChatCallSignal) => void;
};

const fallbackChannelName = "fortetask-chat";

function parseSocketEvent(value: string): ChatSocketEvent | null {
  try {
    const event = JSON.parse(value) as Partial<ChatSocketEvent>;

    if (
      event.type === "chat:join" ||
      event.type === "chat:message" ||
      event.type === "chat:signal"
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
  onMessage,
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
    if (event.type === "chat:message" && event.message.roomId === roomId) {
      onMessage(event.message);
      return;
    }

    if (event.type === "chat:signal" && event.signal.roomId === roomId) {
      onSignal?.(event.signal);
    }
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
        return;
      }

      fallbackChannel?.postMessage(event);
      void fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
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
  };
}

export { connectChatSocket, createChatMessage };
