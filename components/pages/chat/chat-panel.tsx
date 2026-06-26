"use client";

import {
  ChevronsLeft,
  ChevronsRight,
  Phone,
  PhoneOff,
  Plus,
  SendHorizontal,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { MessageBubble } from "@/components/pages/chat/message-bubble";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  connectChatSocket,
  createChatMessage,
  type ChatCallKind,
  type ChatCallSignal,
  type ChatGroup,
  type ChatMessage,
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
  conversationTitle: string;
  kind: ChatCallKind;
  memberIds: number[];
  status: "calling" | "connected" | "ringing";
};

type OutgoingCallSignal =
  | Omit<Extract<ChatCallSignal, { type: "call:offer" }>, "createdAt" | "id" | "roomId">
  | Omit<Extract<ChatCallSignal, { type: "call:answer" }>, "createdAt" | "id" | "roomId">
  | Omit<Extract<ChatCallSignal, { type: "call:candidate" }>, "createdAt" | "id" | "roomId">
  | Omit<Extract<ChatCallSignal, { type: "call:end" }>, "createdAt" | "id" | "roomId">;

type ChatConversation =
  | {
      id: string;
      kind: "private";
      title: string;
      subtitle: string;
      roomId: string;
      memberIds: number[];
      member: ChatMember;
    }
  | {
      id: string;
      kind: "group";
      title: string;
      subtitle: string;
      roomId: string;
      memberIds: number[];
      group: ChatGroup;
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

function getPrivateConversationId(userId: number) {
  return `private:${userId}`;
}

function getGroupConversationId(groupId: string) {
  return `group:${groupId}`;
}

function getGroupRoomId(roomScope: string, groupId: string) {
  return `${roomScope}:group:${groupId}`;
}

function getGroupsRoomId(roomScope: string) {
  return `${roomScope}:groups`;
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
  const [groupDraftName, setGroupDraftName] = useState("");
  const [groupDraftMemberIds, setGroupDraftMemberIds] = useState<number[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [membersCollapsed, setMembersCollapsed] = useState(false);
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [onlineMemberIds, setOnlineMemberIds] = useState<Set<number>>(new Set());
  const [remoteStreamsByUserId, setRemoteStreamsByUserId] = useState<Record<number, MediaStream>>({});
  const [selectedConversationId, setSelectedConversationId] = useState(
    members[0] ? getPrivateConversationId(members[0].id) : null
  );
  const [, startTransition] = useTransition();
  const activeCallRef = useRef<ActiveCall | null>(null);
  const callConnectionRef = useRef<ReturnType<typeof connectChatSocket> | null>(null);
  const callToastIdRef = useRef<string | number | null>(null);
  const callRefsRef = useRef<Record<number, ChatPeerCall>>({});
  const connectionRef = useRef<ReturnType<typeof connectChatSocket> | null>(null);
  const groupsConnectionRef = useRef<ReturnType<typeof connectChatSocket> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const presenceConnectionRef = useRef<ReturnType<typeof connectChatSocket> | null>(null);
  const seenMessageIdsRef = useRef(new Set<string>());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pendingIceCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const conversations = useMemo<ChatConversation[]>(() => {
    const privateConversations = members.map((member) => ({
      id: getPrivateConversationId(member.id),
      kind: "private" as const,
      title: member.name,
      subtitle: member.email,
      roomId: getPrivateRoomId(roomScope, user.id, member.id),
      memberIds: [member.id],
      member,
    }));
    const groupConversations = groups
      .filter((group) => group.memberIds.includes(user.id))
      .map((group) => ({
        id: getGroupConversationId(group.id),
        kind: "group" as const,
        title: group.name,
        subtitle: `${group.memberIds.length} membros`,
        roomId: getGroupRoomId(roomScope, group.id),
        memberIds: group.memberIds.filter((memberId) => memberId !== user.id),
        group,
      }));

    return [...privateConversations, ...groupConversations];
  }, [groups, members, roomScope, user.id]);
  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId) ??
    conversations[0] ??
    null;
  const roomId = selectedConversation?.roomId ?? null;
  const messages = useMemo(
    () => roomId ? messagesByRoom[roomId] ?? [] : [],
    [messagesByRoom, roomId]
  );
  const canSend = Boolean(roomId && draft.trim().length > 0);
  const selectedMemberOnline = Boolean(
    selectedConversation?.kind === "private" &&
      onlineMemberIds.has(selectedConversation.member.id)
  );
  const selectedMemberDotClassName = cn(
    "size-2 rounded-full",
    selectedConversation?.kind === "group" ||
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
  const remoteStreams = useMemo(
    () => Object.entries(remoteStreamsByUserId).map(([memberId, stream]) => ({
      memberId: Number(memberId),
      stream,
    })),
    [remoteStreamsByUserId]
  );

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

  function getCandidateKey(callId: string, memberId: number) {
    return `${callId}:${memberId}`;
  }

  function createSignalBase(signal: OutgoingCallSignal): ChatCallSignal {
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
    const peerEntries = Object.entries(callRefsRef.current);

    for (const [memberIdValue, peerCall] of peerEntries) {
      const memberId = Number(memberIdValue);
      const candidateKey = getCandidateKey(callId, memberId);
      const candidates = pendingIceCandidatesRef.current[candidateKey] ?? [];

      if (!peerCall.peerConnection.remoteDescription || !candidates.length) {
        continue;
      }

      delete pendingIceCandidatesRef.current[candidateKey];

      for (const candidate of candidates) {
        try {
          await peerCall.addIceCandidate(candidate);
        } catch {
          return;
        }
      }
    }
  }

  async function addIceCandidate(signal: Extract<ChatCallSignal, { type: "call:candidate" }>) {
    const peerCall = callRefsRef.current[signal.fromUserId];
    const candidateKey = getCandidateKey(signal.callId, signal.fromUserId);

    if (
      !peerCall ||
      activeCallRef.current?.callId !== signal.callId ||
      !peerCall.peerConnection.remoteDescription
    ) {
      pendingIceCandidatesRef.current[candidateKey] = [
        ...(pendingIceCandidatesRef.current[candidateKey] ?? []),
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
    for (const peerCall of Object.values(callRefsRef.current)) {
      peerCall.close();
    }

    callRefsRef.current = {};
    activeCallRef.current = null;
    setActiveCall(null);
    setLocalStream(null);
    setRemoteStreamsByUserId({});
  }

  function endActiveCall(notify = true) {
    const currentCall = activeCallRef.current;

    if (notify && currentCall) {
      for (const memberId of currentCall.memberIds) {
        sendCallSignal(
          createSignalBase({
            type: "call:end",
            callId: currentCall.callId,
            fromUserId: user.id,
            toUserId: memberId,
          })
        );
      }
    }

    clearActiveCall();
  }

  async function startCall(kind: ChatCallKind) {
    if (!selectedConversation || !selectedConversation.memberIds.length) {
      return;
    }

    endActiveCall(false);

    const callId = createCallId();
    const memberIds = selectedConversation.memberIds;
    const nextCall: ActiveCall = {
      callId,
      conversationTitle: selectedConversation.title,
      kind,
      memberIds,
      status: "calling",
    };

    activeCallRef.current = nextCall;
    setActiveCall(nextCall);

    try {
      for (const memberId of memberIds) {
        const peerCall = await createChatPeerCall({
          kind,
          onIceCandidate: (candidate) => {
            sendCallSignal(
              createSignalBase({
                type: "call:candidate",
                callId,
                fromUserId: user.id,
                toUserId: memberId,
                candidate: candidate.toJSON(),
              })
            );
          },
          onRemoteStream: (stream) => {
            setRemoteStreamsByUserId((currentStreams) => ({
              ...currentStreams,
              [memberId]: stream,
            }));
          },
        });
        const description = await peerCall.createOffer();

        callRefsRef.current[memberId] = peerCall;
        setLocalStream((currentStream) => currentStream ?? peerCall.localStream);
        if (peerCall.localMediaError) {
          toast.warning(getCallErrorMessage(peerCall.localMediaError));
        }
        sendCallSignal(
          createSignalBase({
            type: "call:offer",
            callId,
            fromUserId: user.id,
            toUserId: memberId,
            fromName: user.name,
            description,
            kind,
          })
        );
      }
      toast.success(
        selectedConversation.kind === "group"
          ? "Chamada de grupo iniciada."
          : kind === "video" ? "Videochamada iniciada." : "Chamada iniciada."
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
    setSelectedConversationId(getPrivateConversationId(signal.fromUserId));

    const nextCall: ActiveCall = {
      callId: signal.callId,
      conversationTitle: signal.fromName,
      kind: signal.kind,
      memberIds: [signal.fromUserId],
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
        onRemoteStream: (stream) => {
          setRemoteStreamsByUserId((currentStreams) => ({
            ...currentStreams,
            [signal.fromUserId]: stream,
          }));
        },
      });
      const description = await peerCall.answer(signal.description);

      callRefsRef.current[signal.fromUserId] = peerCall;
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
      const peerCall = callRefsRef.current[signal.fromUserId];

      if (activeCallRef.current?.callId !== signal.callId || !peerCall) {
        return;
      }

      void peerCall.setRemoteAnswer(signal.description).then(async () => {
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
      return;
    }

    const connection = connectChatSocket({
      roomId,
      url: socketUrl,
      user,
      onMessage: appendMessage,
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
      roomId: getGroupsRoomId(roomScope),
      url: socketUrl,
      user,
      onMessage: () => {},
      onGroup: (group) => {
        setGroups((currentGroups) => {
          const otherGroups = currentGroups.filter((currentGroup) => currentGroup.id !== group.id);

          return [...otherGroups, group].sort((firstGroup, secondGroup) =>
            firstGroup.name.localeCompare(secondGroup.name)
          );
        });
      },
    });

    groupsConnectionRef.current = connection;

    return () => {
      connection.close();
      groupsConnectionRef.current = null;
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
    for (const [memberId, stream] of Object.entries(remoteStreamsByUserId)) {
      const video = remoteVideoRefs.current[Number(memberId)];

      if (video) {
        video.srcObject = stream;
      }
    }
  }, [remoteStreamsByUserId]);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject =
        activeCall?.kind === "audio" ? remoteStreams[0]?.stream ?? null : null;
    }
  }, [activeCall?.kind, remoteStreams]);

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

  function toggleGroupDraftMember(memberId: number) {
    setGroupDraftMemberIds((currentMemberIds) =>
      currentMemberIds.includes(memberId)
        ? currentMemberIds.filter((currentMemberId) => currentMemberId !== memberId)
        : [...currentMemberIds, memberId]
    );
  }

  function createGroup() {
    const name = groupDraftName.trim();

    if (!name || groupDraftMemberIds.length === 0) {
      toast.error("Escolha um nome e pelo menos um membro.");
      return;
    }

    const group: ChatGroup = {
      id: createCallId(),
      roomScope,
      name,
      memberIds: Array.from(new Set([user.id, ...groupDraftMemberIds])),
      createdByUserId: user.id,
      createdAt: new Date().toISOString(),
    };

    setGroups((currentGroups) => [
      ...currentGroups.filter((currentGroup) => currentGroup.id !== group.id),
      group,
    ]);
    groupsConnectionRef.current?.sendGroup(group);
    setGroupDraftName("");
    setGroupDraftMemberIds([]);
    setShowGroupForm(false);
    setSelectedConversationId(getGroupConversationId(group.id));
    toast.success("Grupo criado.");
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
          {selectedConversation ? (
            <div className="flex min-w-0 items-center gap-3">
              {selectedConversation.kind === "group" ? (
                <span className="grid size-8 shrink-0 place-items-center border border-border bg-muted text-muted-foreground">
                  <Users className="size-4" />
                </span>
              ) : (
                <Avatar size="sm">
                  <AvatarFallback>{getInitials(selectedConversation.title)}</AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0">
                <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span className={selectedMemberDotClassName} aria-hidden="true" />
                  <span className="truncate">{selectedConversation.title}</span>
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
                <h2 className="text-sm font-semibold">Chat</h2>
                <p className="text-xs text-muted-foreground">
                  Selecione uma conversa.
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
                disabled={!selectedConversation && !activeCall}
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
                disabled={!selectedConversation || Boolean(activeCall)}
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
                    {activeCall ? ` com ${activeCall.conversationTitle}` : ""}
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
                  {remoteStreams.map(({ memberId }) => (
                    <video
                      key={memberId}
                      ref={(node) => {
                        remoteVideoRefs.current[memberId] = node;
                      }}
                      autoPlay
                      playsInline
                      className="aspect-video w-full bg-muted object-cover"
                    />
                  ))}
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
          {!selectedConversation ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Escolha uma conversa.
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
              selectedConversation
                ? `Mensagem para ${selectedConversation.title}`
                : "Selecione uma conversa..."
            }
            disabled={!selectedConversation}
            className="max-h-32 min-h-10 flex-1 resize-none"
          />
          <Button
            type="submit"
            size="icon-sm"
            aria-label="Enviar mensagem"
            disabled={!canSend}
            className="h-10 w-12 shrink-0"
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
              <h2 className="text-sm font-semibold">Conversas</h2>
              <p className="text-xs text-muted-foreground">
                {conversations.length} {conversations.length === 1 ? "conversa" : "conversas"}
              </p>
            </div>
          )}
          {membersCollapsed ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Criar grupo"
              onClick={() => setShowGroupForm((currentValue) => !currentValue)}
            >
              <Plus />
            </Button>
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
          {showGroupForm && !membersCollapsed ? (
            <div className="mb-2 border border-border bg-background p-2">
              <Input
                value={groupDraftName}
                onChange={(event) => setGroupDraftName(event.target.value)}
                placeholder="Nome do grupo"
              />
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {members.map((member) => (
                  <label
                    key={member.id}
                    className="flex cursor-pointer items-center gap-2 px-1 py-1 text-xs"
                  >
                    <Checkbox
                      checked={groupDraftMemberIds.includes(member.id)}
                      onCheckedChange={() => toggleGroupDraftMember(member.id)}
                    />
                    <span className="min-w-0 flex-1 truncate">{member.name}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowGroupForm(false);
                    setGroupDraftMemberIds([]);
                    setGroupDraftName("");
                  }}
                >
                  Cancelar
                </Button>
                <Button type="button" size="sm" onClick={createGroup}>
                  Criar
                </Button>
              </div>
            </div>
          ) : null}
          {conversations.length ? (
            conversations.map((conversation) => {
              const unreadCount =
                messagesByRoom[conversation.roomId]?.filter(
                  (message) => message.userId !== user.id
                ).length ?? 0;
              const selected = conversation.id === selectedConversationId;
              const online =
                conversation.kind === "group" ||
                onlineMemberIds.has(conversation.member.id);

              return (
                <button
                  key={conversation.id}
                  type="button"
                  title={conversation.title}
                  className={cn(
                    "relative flex w-full items-center gap-3 px-2 py-2 text-left transition-colors hover:bg-muted/70",
                    selected && "bg-muted",
                    membersCollapsed && "justify-center px-0"
                  )}
                  onClick={() => {
                    setDraft("");
                    setSelectedConversationId(conversation.id);
                  }}
                >
                  {conversation.kind === "group" ? (
                    <span className="grid size-8 shrink-0 place-items-center border border-border bg-muted text-muted-foreground">
                      <Users className="size-4" />
                    </span>
                  ) : (
                    <Avatar size="sm">
                      <AvatarFallback>{getInitials(conversation.title)}</AvatarFallback>
                    </Avatar>
                  )}
                  {membersCollapsed ? null : (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              online ? "bg-primary" : "bg-border"
                            )}
                            aria-hidden="true"
                          />
                          <span className="truncate">{conversation.title}</span>
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {conversation.subtitle}
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
                        online ? "bg-primary" : "bg-border"
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
              Nao existem conversas disponiveis.
            </div>
          )}
        </div>
      </aside>
    </section>
  );
}

export { ChatPanel };
