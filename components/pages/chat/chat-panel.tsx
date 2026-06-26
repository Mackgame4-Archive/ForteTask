"use client";

import {
  ChevronsLeft,
  ChevronsRight,
  Phone,
  PhoneOff,
  SendHorizontal,
  UserRound,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { MessageBubble } from "@/components/pages/chat/message-bubble";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  connectChatSocket,
  createChatMessage,
  type ChatCallKind,
  type ChatCallSignal,
  type ChatMessage,
  type ChatSocketStatus,
  type ChatSocketUser,
} from "@/lib/utils/sockets";
import {
  createCallId,
  createChatPeerCall,
  type ChatPeerCall,
} from "@/lib/utils/webrtc";
import { cn } from "@/lib/utils";

type ChatMember = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type ChatPanelProps = {
  members: ChatMember[];
  roomScope: string;
  socketUrl?: string;
  user: ChatSocketUser;
};

type ActiveCall = {
  callId: string;
  kind: ChatCallKind;
  memberId: number;
  status: "calling" | "connected" | "ringing";
};

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function getPrivateRoomId(roomScope: string, firstUserId: number, secondUserId: number) {
  const [firstId, secondId] = [firstUserId, secondUserId].sort((a, b) => a - b);

  return `${roomScope}:private:${firstId}:${secondId}`;
}

function getCallRoomId(roomScope: string, userId: number) {
  return `${roomScope}:calls:${userId}`;
}

function getPresenceRoomId(roomScope: string) {
  return `${roomScope}:presence`;
}

function getCallErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Nao foi possivel iniciar a chamada.";
  }

  if (error.name === "NotAllowedError") {
    return "Permissao do microfone/camara bloqueada.";
  }

  if (error.name === "NotFoundError") {
    return "Microfone ou camara nao encontrado.";
  }

  if (error.name === "NotReadableError") {
    return "Microfone ou camara ja esta em uso.";
  }

  if (error.name === "NotSupportedError") {
    return "Este navegador nao suporta chamadas.";
  }

  if (error.name === "SecurityError") {
    return "Chamadas precisam de HTTPS ou localhost.";
  }

  return error.message || "Nao foi possivel iniciar a chamada.";
}

function ChatPanel({ members, roomScope, socketUrl, user }: ChatPanelProps) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [draft, setDraft] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [membersCollapsed, setMembersCollapsed] = useState(false);
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [onlineMemberIds, setOnlineMemberIds] = useState<Set<number>>(new Set());
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id ?? null);
  const [, setStatus] = useState<ChatSocketStatus>(
    socketUrl ? "connecting" : "fallback"
  );
  const [, startTransition] = useTransition();
  const activeCallRef = useRef<ActiveCall | null>(null);
  const callConnectionRef = useRef<ReturnType<typeof connectChatSocket> | null>(null);
  const callToastIdRef = useRef<string | number | null>(null);
  const callRef = useRef<ChatPeerCall | null>(null);
  const connectionRef = useRef<ReturnType<typeof connectChatSocket> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const presenceConnectionRef = useRef<ReturnType<typeof connectChatSocket> | null>(null);
  const seenMessageIdsRef = useRef(new Set<string>());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pendingIceCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;
  const activeCallMember = activeCall
    ? members.find((member) => member.id === activeCall.memberId) ?? null
    : null;
  const roomId = selectedMember
    ? getPrivateRoomId(roomScope, user.id, selectedMember.id)
    : null;
  const messages = roomId ? messagesByRoom[roomId] ?? [] : [];
  const canSend = Boolean(roomId && draft.trim().length > 0);
  const selectedMemberOnline = Boolean(
    selectedMember && onlineMemberIds.has(selectedMember.id)
  );
  const selectedMemberDotClassName = cn(
    "size-2 rounded-full",
    selectedMemberOnline
      ? "bg-primary"
      : "bg-border"
  );
  const callStatusLabel =
    activeCall?.status === "calling"
      ? "A chamar"
      : activeCall?.status === "ringing"
        ? "A atender"
        : "Em chamada";

  function appendMessage(message: ChatMessage) {
    if (seenMessageIdsRef.current.has(message.id)) {
      return;
    }

    seenMessageIdsRef.current.add(message.id);
    setMessagesByRoom((currentMessagesByRoom) => ({
      ...currentMessagesByRoom,
      [message.roomId]: [
        ...(currentMessagesByRoom[message.roomId] ?? []),
        message,
      ],
    }));
  }

  function createSignalBase(
    signal: Omit<ChatCallSignal, "createdAt" | "id" | "roomId">
  ): ChatCallSignal {
    return {
      ...signal,
      id: createCallId(),
      roomId: getCallRoomId(roomScope, signal.toUserId),
      createdAt: new Date().toISOString(),
    } as ChatCallSignal;
  }

  function sendCallSignal(signal: ChatCallSignal) {
    callConnectionRef.current?.sendSignal(signal);
  }

  async function flushIceCandidates(callId: string) {
    const peerCall = callRef.current;
    const candidates = pendingIceCandidatesRef.current[callId] ?? [];

    if (!peerCall || !peerCall.peerConnection.remoteDescription || !candidates.length) {
      return;
    }

    delete pendingIceCandidatesRef.current[callId];

    for (const candidate of candidates) {
      try {
        await peerCall.addIceCandidate(candidate);
      } catch {
        return;
      }
    }
  }

  async function addIceCandidate(signal: Extract<ChatCallSignal, { type: "call:candidate" }>) {
    const peerCall = callRef.current;

    if (
      !peerCall ||
      activeCallRef.current?.callId !== signal.callId ||
      !peerCall.peerConnection.remoteDescription
    ) {
      pendingIceCandidatesRef.current[signal.callId] = [
        ...(pendingIceCandidatesRef.current[signal.callId] ?? []),
        signal.candidate,
      ];
      return;
    }

    try {
      await peerCall.addIceCandidate(signal.candidate);
    } catch {
      return;
    }
  }

  function clearActiveCall() {
    callRef.current?.close();
    callRef.current = null;
    activeCallRef.current = null;
    setActiveCall(null);
    setLocalStream(null);
    setRemoteStream(null);
  }

  function endActiveCall(notify = true) {
    const currentCall = activeCallRef.current;

    if (notify && currentCall) {
      sendCallSignal(
        createSignalBase({
          type: "call:end",
          callId: currentCall.callId,
          fromUserId: user.id,
          toUserId: currentCall.memberId,
        })
      );
    }

    clearActiveCall();
  }

  async function startCall(kind: ChatCallKind) {
    if (!selectedMember) {
      return;
    }

    endActiveCall(false);

    const callId = createCallId();
    const nextCall: ActiveCall = {
      callId,
      kind,
      memberId: selectedMember.id,
      status: "calling",
    };

    activeCallRef.current = nextCall;
    setActiveCall(nextCall);

    try {
      const peerCall = await createChatPeerCall({
        kind,
        onIceCandidate: (candidate) => {
          sendCallSignal(
            createSignalBase({
              type: "call:candidate",
              callId,
              fromUserId: user.id,
              toUserId: selectedMember.id,
              candidate: candidate.toJSON(),
            })
          );
        },
        onRemoteStream: setRemoteStream,
      });
      const description = await peerCall.createOffer();

      callRef.current = peerCall;
      setLocalStream(peerCall.localStream);
      if (peerCall.localMediaError) {
        toast.warning(getCallErrorMessage(peerCall.localMediaError));
      }
      sendCallSignal(
        createSignalBase({
          type: "call:offer",
          callId,
          fromUserId: user.id,
          toUserId: selectedMember.id,
          fromName: user.name,
          description,
          kind,
        })
      );
      toast.success(
        kind === "video" ? "Videochamada iniciada." : "Chamada iniciada."
      );
    } catch (error) {
      clearActiveCall();
      toast.error(getCallErrorMessage(error));
    }
  }

  async function answerIncomingCall(
    signal: Extract<ChatCallSignal, { type: "call:offer" }>
  ) {
    endActiveCall(false);
    setSelectedMemberId(signal.fromUserId);

    const nextCall: ActiveCall = {
      callId: signal.callId,
      kind: signal.kind,
      memberId: signal.fromUserId,
      status: "ringing",
    };

    activeCallRef.current = nextCall;
    setActiveCall(nextCall);

    try {
      const peerCall = await createChatPeerCall({
        kind: signal.kind,
        onIceCandidate: (candidate) => {
          sendCallSignal(
            createSignalBase({
              type: "call:candidate",
              callId: signal.callId,
              fromUserId: user.id,
              toUserId: signal.fromUserId,
              candidate: candidate.toJSON(),
            })
          );
        },
        onRemoteStream: setRemoteStream,
      });
      const description = await peerCall.answer(signal.description);

      callRef.current = peerCall;
      setLocalStream(peerCall.localStream);
      if (peerCall.localMediaError) {
        toast.warning(getCallErrorMessage(peerCall.localMediaError));
      }
      sendCallSignal(
        createSignalBase({
          type: "call:answer",
          callId: signal.callId,
          fromUserId: user.id,
          toUserId: signal.fromUserId,
          description,
        })
      );
      await flushIceCandidates(signal.callId);
      activeCallRef.current = {
        ...nextCall,
        status: "connected",
      };
      setActiveCall(activeCallRef.current);
      toast.success("Chamada atendida.");
    } catch (error) {
      clearActiveCall();
      toast.error(getCallErrorMessage(error));
    }
  }

  function declineIncomingCall(signal: Extract<ChatCallSignal, { type: "call:offer" }>) {
    sendCallSignal(
      createSignalBase({
        type: "call:end",
        callId: signal.callId,
        fromUserId: user.id,
        toUserId: signal.fromUserId,
      })
    );
  }

  function showIncomingCall(signal: Extract<ChatCallSignal, { type: "call:offer" }>) {
    if (callToastIdRef.current) {
      toast.dismiss(callToastIdRef.current);
    }

    callToastIdRef.current = toast.custom(
      (toastId) => (
        <div className="flex w-80 flex-col gap-3 border border-border bg-popover p-4 text-popover-foreground shadow-md">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center bg-primary text-primary-foreground">
              {signal.kind === "video" ? (
                <Video className="size-4" />
              ) : (
                <Phone className="size-4" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {signal.kind === "video" ? "Videochamada" : "Chamada"}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {signal.fromName}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                toast.dismiss(toastId);
                callToastIdRef.current = null;
                declineIncomingCall(signal);
              }}
            >
              <PhoneOff />
              Recusar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                toast.dismiss(toastId);
                callToastIdRef.current = null;
                void answerIncomingCall(signal);
              }}
            >
              <Phone />
              Atender
            </Button>
          </div>
        </div>
      ),
      {
        duration: 30_000,
        onDismiss: () => {
          callToastIdRef.current = null;
        },
      }
    );
  }

  function handleCallSignal(signal: ChatCallSignal) {
    if (signal.toUserId !== user.id || signal.fromUserId === user.id) {
      return;
    }

    if (signal.type === "call:offer") {
      showIncomingCall(signal);
      return;
    }

    if (signal.type === "call:answer") {
      if (activeCallRef.current?.callId !== signal.callId || !callRef.current) {
        return;
      }

      void callRef.current.setRemoteAnswer(signal.description).then(async () => {
        await flushIceCandidates(signal.callId);
        activeCallRef.current = {
          ...activeCallRef.current!,
          status: "connected",
        };
        setActiveCall(activeCallRef.current);
        toast.success("Chamada ligada.");
      });
      return;
    }

    if (signal.type === "call:candidate") {
      void addIceCandidate(signal);
      return;
    }

    if (signal.type === "call:end") {
      if (activeCallRef.current?.callId === signal.callId) {
        clearActiveCall();
      }

      toast.info("Chamada terminada.");
    }
  }

  useEffect(() => {
    if (!roomId) {
      setStatus("closed");
      return;
    }

    const connection = connectChatSocket({
      roomId,
      url: socketUrl,
      user,
      onMessage: appendMessage,
      onStatusChange: setStatus,
    });

    connectionRef.current = connection;

    return () => {
      connection.close();
      connectionRef.current = null;
    };
  }, [roomId, socketUrl, user]);

  useEffect(() => {
    const connection = connectChatSocket({
      roomId: getCallRoomId(roomScope, user.id),
      url: socketUrl,
      user,
      onMessage: () => {},
      onSignal: handleCallSignal,
    });

    callConnectionRef.current = connection;

    return () => {
      connection.close();
      callConnectionRef.current = null;
    };
  }, [roomScope, socketUrl, user]);

  useEffect(() => {
    const connection = connectChatSocket({
      roomId: getPresenceRoomId(roomScope),
      url: socketUrl,
      user,
      announcePresence: true,
      onMessage: () => {},
      onPresenceChange: (presenceUser, online) => {
        setOnlineMemberIds((currentOnlineMemberIds) => {
          const nextOnlineMemberIds = new Set(currentOnlineMemberIds);

          if (online) {
            nextOnlineMemberIds.add(presenceUser.id);
          } else {
            nextOnlineMemberIds.delete(presenceUser.id);
          }

          return nextOnlineMemberIds;
        });
      },
    });

    presenceConnectionRef.current = connection;

    return () => {
      connection.close();
      presenceConnectionRef.current = null;
    };
  }, [roomScope, socketUrl, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject =
        activeCall?.kind === "audio" ? remoteStream : null;
    }
  }, [activeCall?.kind, remoteStream]);

  function sendMessage() {
    const body = draft.trim();

    if (!body || !roomId) {
      return;
    }

    const message = createChatMessage({
      body,
      roomId,
      user,
    });

    setDraft("");
    appendMessage(message);
    startTransition(() => {
      connectionRef.current?.send(message);
    });
  }

  const messageCountLabel = useMemo(
    () => `${messages.length} ${messages.length === 1 ? "mensagem" : "mensagens"}`,
    [messages.length]
  );

  return (
    <section
      className={cn(
        "grid h-screen min-h-0 w-full overflow-hidden bg-card",
        membersCollapsed
          ? "md:grid-cols-[minmax(0,1fr)_4.5rem]"
          : "md:grid-cols-[minmax(0,1fr)_20rem]"
      )}
    >
      <div className="flex min-h-0 flex-col bg-card">
        <header className="flex h-[4.0625rem] items-center justify-between gap-3 border-b border-border px-4 py-3">
          {selectedMember ? (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar size="sm">
                <AvatarFallback>{getInitials(selectedMember.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span className={selectedMemberDotClassName} aria-hidden="true" />
                  <span className="truncate">{selectedMember.name}</span>
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  {messageCountLabel}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-8 place-items-center border border-border bg-muted text-muted-foreground">
                <UserRound className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Chat privado</h2>
                <p className="text-xs text-muted-foreground">
                  Selecione um membro.
                </p>
              </div>
            </div>
          )}
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={activeCall ? "Terminar chamada" : "Iniciar chamada"}
                disabled={!selectedMember && !activeCall}
                onClick={() => {
                  if (activeCall) {
                    endActiveCall();
                    return;
                  }

                  void startCall("audio");
                }}
              >
                {activeCall ? <PhoneOff /> : <Phone />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Iniciar videochamada"
                disabled={!selectedMember || Boolean(activeCall)}
                onClick={() => {
                  void startCall("video");
                }}
              >
                <Video />
              </Button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-background px-4 py-4">
          {activeCall ? (
            <div className="border border-border bg-card p-3">
              <audio ref={remoteAudioRef} autoPlay />
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {callStatusLabel}
                    {activeCallMember ? ` com ${activeCallMember.name}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeCall.kind === "video" ? "Videochamada" : "Chamada"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => endActiveCall()}
                >
                  <PhoneOff />
                  Terminar
                </Button>
              </div>
              {activeCall.kind === "video" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="aspect-video w-full bg-muted object-cover"
                  />
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="aspect-video w-full bg-muted object-cover"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          {!selectedMember ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Escolha um membro para iniciar uma conversa privada.
            </div>
          ) : messages.length ? (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                own={message.userId === user.id}
              />
            ))
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Ainda não existem mensagens nesta conversa.
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form
          className="flex items-end gap-2 border-t border-border bg-card p-3"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage();
          }}
        >
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder={
              selectedMember
                ? `Mensagem para ${selectedMember.name}`
                : "Selecione um membro..."
            }
            disabled={!selectedMember}
            className="max-h-32 min-h-10 flex-1 resize-none"
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Enviar mensagem"
            disabled={!canSend}
          >
            <SendHorizontal />
          </Button>
        </form>
      </div>

      <aside className="flex min-h-0 flex-col border-t border-border bg-card md:border-l md:border-t-0">
        <div
          className={cn(
            "flex h-[4.0625rem] items-center gap-3 border-b border-border px-4 py-3",
            membersCollapsed && "justify-center px-2"
          )}
        >
          {membersCollapsed ? null : (
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Membros</h2>
              <p className="text-xs text-muted-foreground">
                {members.length} {members.length === 1 ? "membro" : "membros"}
              </p>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={membersCollapsed ? "Expandir membros" : "Recolher membros"}
            onClick={() => setMembersCollapsed((collapsed) => !collapsed)}
          >
            {membersCollapsed ? <ChevronsLeft /> : <ChevronsRight />}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {members.length ? (
            members.map((member) => {
              const memberRoomId = getPrivateRoomId(roomScope, user.id, member.id);
              const unreadCount =
                messagesByRoom[memberRoomId]?.filter(
                  (message) => message.userId !== user.id
                ).length ?? 0;
              const selected = member.id === selectedMemberId;

              return (
                <button
                  key={member.id}
                  type="button"
                  title={member.name}
                  className={cn(
                    "relative flex w-full items-center gap-3 px-2 py-2 text-left transition-colors hover:bg-muted/70",
                    selected && "bg-muted",
                    membersCollapsed && "justify-center px-0"
                  )}
                  onClick={() => {
                    setDraft("");
                    setSelectedMemberId(member.id);
                  }}
                >
                  <Avatar size="sm">
                    <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                  </Avatar>
                  {membersCollapsed ? null : (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              onlineMemberIds.has(member.id)
                                ? "bg-primary"
                                : "bg-border"
                            )}
                            aria-hidden="true"
                          />
                          <span className="truncate">
                            {member.name}
                          </span>
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      </span>
                      {unreadCount ? (
                        <Badge variant="secondary">{unreadCount}</Badge>
                      ) : null}
                    </>
                  )}
                  {membersCollapsed ? (
                    <span
                      className={cn(
                        "absolute right-2 top-1.5 size-2 rounded-full",
                        onlineMemberIds.has(member.id)
                          ? "bg-primary"
                          : "bg-border"
                      )}
                      aria-hidden="true"
                    />
                  ) : null}
                  {membersCollapsed && unreadCount ? (
                    <span className="absolute right-2 top-4 flex size-4 items-center justify-center bg-primary text-[10px] font-medium text-primary-foreground">
                      {unreadCount}
                    </span>
                  ) : null}
                </button>
              );
            })
          ) : (
            <div
              className={cn(
                "grid min-h-40 place-items-center px-4 text-center text-sm text-muted-foreground",
                membersCollapsed && "px-0 text-[0]"
              )}
            >
              NÃ£o existem membros disponÃ­veis para conversar.
            </div>
          )}
        </div>
      </aside>
    </section>
  );
}

export { ChatPanel };
