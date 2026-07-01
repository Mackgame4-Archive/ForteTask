"use client";

import {
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  MoreHorizontal,
  Phone,
  PhoneOff,
  Plus,
  SendHorizontal,
  Trash2,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { CallScreen } from "@/components/pages/chat/call-screen";
import { MessageBubble } from "@/components/pages/chat/message-bubble";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  connectChatSocket,
  createChatMessage,
  type ChatCallKind,
  type ChatCallPresence,
  type ChatCallSignal,
  type ChatGroup,
  type ChatMessage,
  type ChatSocketUser,
} from "@/lib/utils/sockets";
import { playCallEndSound, playIncomingCallLoop } from "@/lib/utils/audio";
import {
  createCallId,
  createChatLocalStream,
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
  conversationRoomId: string;
  conversationTitle: string;
  kind: ChatCallKind;
  memberIds: number[];
  startedAt: number;
  status: "calling" | "connected" | "ringing";
};

// Who is currently in a given conversation's call room, plus the call's kind.
type CallPresence = {
  kind: ChatCallKind;
  users: ChatSocketUser[];
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

function getCallsPresenceRoomId(roomScope: string) {
  return `${roomScope}:calls-presence`;
}

function conversationIdToChatSlug(conversationId: string) {
  if (conversationId.startsWith("private:")) {
    return conversationId.slice("private:".length);
  }

  if (conversationId.startsWith("group:")) {
    return conversationId.slice("group:".length);
  }

  return conversationId;
}

function chatSlugToConversationId(slug: string) {
  // User ids are numeric; group ids are UUIDs — so a bare number is a private
  // chat and anything else is a group.
  return /^\d+$/.test(slug) ? `private:${slug}` : `group:${slug}`;
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

function formatCallDuration(startedAt: number, endedAt = Date.now()) {
  const totalSeconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function ChatPanel({ members, roomScope, socketUrl, user }: ChatPanelProps) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [draft, setDraft] = useState("");
  const [groupDraftName, setGroupDraftName] = useState("");
  const [groupDraftMemberIds, setGroupDraftMemberIds] = useState<number[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelErrorTitle, setPanelErrorTitle] = useState("Erro");
  const [membersCollapsed, setMembersCollapsed] = useState(false);
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [onlineMemberIds, setOnlineMemberIds] = useState<Set<number>>(new Set());
  const [remoteStreamsByUserId, setRemoteStreamsByUserId] = useState<Record<number, MediaStream>>({});
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [callChatOpen, setCallChatOpen] = useState(false);
  const [callPresenceByKey, setCallPresenceByKey] = useState<Record<string, CallPresence>>({});
  const [declinedCallKeys, setDeclinedCallKeys] = useState<string[]>([]);
  const [, setCallTick] = useState(0);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const chatIdSlug = Array.isArray(params.chatId)
    ? params.chatId[0]
    : typeof params.chatId === "string"
      ? params.chatId
      : null;
  const selectedConversationId = chatIdSlug
    ? chatSlugToConversationId(chatIdSlug)
    : null;
  const selectConversation = useCallback(
    (conversationId: string) => {
      setDraft("");
      router.push(`/chat/${conversationIdToChatSlug(conversationId)}`);
    },
    [router]
  );
  const activeCallRef = useRef<ActiveCall | null>(null);
  const callConnectionRef = useRef<ReturnType<typeof connectChatSocket> | null>(null);
  const callPresenceConnectionRef = useRef<ReturnType<typeof connectChatSocket> | null>(null);
  const callRefsRef = useRef<Record<number, ChatPeerCall>>({});
  const callPresenceByKeyRef = useRef<Record<string, CallPresence>>({});
  const endActiveCallRef = useRef<() => void>(() => {});
  const removePeerRef = useRef<(memberId: number) => void>(() => {});
  const connectCallMemberRef = useRef<(memberId: number) => void>(() => {});
  const joinCallRef = useRef<(conversation: ChatConversation) => void>(() => {});
  const joiningRoomRef = useRef<string | null>(null);
  const pendingCallKindRef = useRef<ChatCallKind>("audio");
  const connectionRef = useRef<ReturnType<typeof connectChatSocket> | null>(null);
  const groupsConnectionRef = useRef<ReturnType<typeof connectChatSocket> | null>(null);
  const incomingRingRef = useRef<ReturnType<typeof playIncomingCallLoop> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const presenceConnectionRef = useRef<ReturnType<typeof connectChatSocket> | null>(null);
  const seenMessageIdsRef = useRef(new Set<string>());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pendingIceCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const remoteAudioRefs = useRef<Record<number, HTMLAudioElement | null>>({});
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
    null;
  const roomId = selectedConversation?.roomId ?? null;
  const messages = roomId ? messagesByRoom[roomId] ?? [] : [];
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
  const callParticipants = useMemo(() => {
    if (!activeCall) {
      return [];
    }

    const memberLookup = new Map(members.map((member) => [member.id, member]));

    return [
      { id: user.id, name: user.name, self: true, stream: localStream },
      ...activeCall.memberIds.map((memberId) => ({
        id: memberId,
        name: memberLookup.get(memberId)?.name ?? `Utilizador ${memberId}`,
        self: false,
        stream: remoteStreamsByUserId[memberId] ?? null,
      })),
    ];
  }, [activeCall, localStream, members, remoteStreamsByUserId, user.id, user.name]);
  const callMessages = useMemo(
    () => (activeCall ? messagesByRoom[activeCall.conversationRoomId] ?? [] : []),
    [activeCall, messagesByRoom]
  );
  const selectedConversationHasCall = Boolean(
    selectedConversation && callPresenceByKey[selectedConversation.roomId]?.users.length
  );
  // A call is "incoming" when one of our conversations has people in its call
  // room, we're not in it, and we haven't declined it.
  const incomingCall = ((): {
    conversation: ChatConversation;
    kind: ChatCallKind;
    from: ChatSocketUser;
    others: ChatSocketUser[];
  } | null => {
    if (activeCall) {
      return null;
    }

    for (const conversation of conversations) {
      if (declinedCallKeys.includes(conversation.roomId)) {
        continue;
      }

      const presence = callPresenceByKey[conversation.roomId];
      const others = presence?.users.filter((presenceUser) => presenceUser.id !== user.id) ?? [];

      if (presence && others.length) {
        return { conversation, kind: presence.kind, from: others[0], others };
      }
    }

    return null;
  })();
  const incomingCallKey = incomingCall?.conversation.roomId ?? null;
  // Recomputed on every callTick (1s interval) while connected; "" otherwise.
  const callElapsedLabel =
    activeCall?.status === "connected" ? formatCallDuration(activeCall.startedAt) : "";

  const toggleMic = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];

    if (!tracks.length) {
      return;
    }

    const nextEnabled = !tracks.some((track) => track.enabled);

    for (const track of tracks) {
      track.enabled = nextEnabled;
    }

    setMicEnabled(nextEnabled);
  }, []);

  const toggleCamera = useCallback(() => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? [];

    if (!tracks.length) {
      return;
    }

    const nextEnabled = !tracks.some((track) => track.enabled);

    for (const track of tracks) {
      track.enabled = nextEnabled;
    }

    setCameraEnabled(nextEnabled);
  }, []);

  const appendMessage = useCallback((message: ChatMessage) => {
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
  }, []);

  const showPanelError = useCallback((title: string, message: string) => {
    setPanelErrorTitle(title);
    setPanelError(message);
  }, []);

  const postMessage = useCallback((message: ChatMessage) => {
    appendMessage(message);
    void fetch("/api/chat/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
  }, [appendMessage]);

  const postCallSummary = useCallback((call: ActiveCall) => {
    const message = createChatMessage({
      body: `Chamada com ${call.conversationTitle}\nDuração ${formatCallDuration(call.startedAt)}`,
      roomId: call.conversationRoomId,
      user,
    });

    postMessage(message);
  }, [postMessage, user]);

  const sendCallMessage = useCallback((body: string) => {
    const currentCall = activeCallRef.current;

    if (!currentCall) {
      return;
    }

    const message = createChatMessage({
      body,
      roomId: currentCall.conversationRoomId,
      user,
    });

    postMessage(message);
  }, [postMessage, user]);

  const removeGroupLocally = useCallback((groupId: string) => {
    setGroups((currentGroups) =>
      currentGroups.filter((currentGroup) => currentGroup.id !== groupId)
    );
    setMessagesByRoom((currentMessagesByRoom) => {
      const nextMessagesByRoom = { ...currentMessagesByRoom };

      delete nextMessagesByRoom[getGroupRoomId(roomScope, groupId)];

      return nextMessagesByRoom;
    });

    if (selectedConversationId === getGroupConversationId(groupId) && members[0]) {
      selectConversation(getPrivateConversationId(members[0].id));
    }
  }, [members, roomScope, selectConversation, selectedConversationId]);

  function getCandidateKey(callId: string, memberId: number) {
    return `${callId}:${memberId}`;
  }

  const createSignalBase = useCallback(
    (signal: OutgoingCallSignal): ChatCallSignal =>
      ({
        ...signal,
        id: createCallId(),
        roomId: getCallRoomId(roomScope, signal.toUserId),
        createdAt: new Date().toISOString(),
      }) as ChatCallSignal,
    [roomScope]
  );

  const sendCallSignal = useCallback((signal: ChatCallSignal) => {
    callConnectionRef.current?.sendSignal(signal);
  }, []);

  const sendCallPresence = useCallback(
    (conversationKey: string, kind: ChatCallKind, present: boolean) => {
      callPresenceConnectionRef.current?.sendCallPresence({
        type: "chat:call-presence",
        roomScope,
        conversationKey,
        user: { id: user.id, name: user.name, email: user.email },
        present,
        kind,
      });
    },
    [roomScope, user.email, user.id, user.name]
  );

  const declineIncomingCall = useCallback(
    (call: { conversation: ChatConversation; others: ChatSocketUser[] }) => {
      setDeclinedCallKeys((current) =>
        current.includes(call.conversation.roomId)
          ? current
          : [...current, call.conversation.roomId]
      );

      // Tell whoever is in the room; if it leaves them alone, their call ends.
      for (const other of call.others) {
        sendCallSignal(
          createSignalBase({
            type: "call:end",
            callId: call.conversation.roomId,
            conversationRoomId: call.conversation.roomId,
            conversationTitle: call.conversation.title,
            fromUserId: user.id,
            reason: "declined",
            toUserId: other.id,
          })
        );
      }
    },
    [createSignalBase, sendCallSignal, user.id]
  );

  const flushIceCandidates = useCallback(async (callId: string) => {
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
  }, []);

  const addIceCandidate = useCallback(async (signal: Extract<ChatCallSignal, { type: "call:candidate" }>) => {
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
  }, []);

  const clearActiveCall = useCallback(() => {
    for (const peerCall of Object.values(callRefsRef.current)) {
      peerCall.close();
    }

    for (const track of localStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }

    callRefsRef.current = {};
    activeCallRef.current = null;
    localStreamRef.current = null;
    setActiveCall(null);
    setLocalStream(null);
    setRemoteStreamsByUserId({});
    setMicEnabled(true);
    setCameraEnabled(true);
    setCallChatOpen(false);

    if (typeof window !== "undefined" && window.location.pathname.endsWith("/call")) {
      router.replace(window.location.pathname.slice(0, -"/call".length));
    }
  }, [router]);

  const removePeer = useCallback((memberId: number) => {
    const peerCall = callRefsRef.current[memberId];

    if (peerCall) {
      delete callRefsRef.current[memberId];
      peerCall.close();
    }

    const currentCall = activeCallRef.current;

    if (currentCall) {
      delete pendingIceCandidatesRef.current[getCandidateKey(currentCall.callId, memberId)];
    }

    delete remoteVideoRefs.current[memberId];
    setRemoteStreamsByUserId((currentStreams) => {
      if (!(memberId in currentStreams)) {
        return currentStreams;
      }

      const nextStreams = { ...currentStreams };

      delete nextStreams[memberId];

      return nextStreams;
    });

    delete remoteAudioRefs.current[memberId];

    if (!currentCall) {
      return;
    }

    const nextMemberIds = currentCall.memberIds.filter((id) => id !== memberId);

    // Once we'd be the only one left, the call is over — leave it too.
    if (nextMemberIds.length === 0 && currentCall.status === "connected") {
      endActiveCallRef.current();
      return;
    }

    activeCallRef.current = { ...currentCall, memberIds: nextMemberIds };
    setActiveCall(activeCallRef.current);
  }, []);

  useEffect(() => {
    removePeerRef.current = removePeer;
  }, [removePeer]);

  const endActiveCall = useCallback(() => {
    const currentCall = activeCallRef.current;

    if (currentCall) {
      // Announce we left the call room; the call lives on for anyone still in it.
      sendCallPresence(currentCall.conversationRoomId, currentCall.kind, false);

      if (currentCall.status === "connected") {
        postCallSummary(currentCall);
      }

      playCallEndSound();
    }

    clearActiveCall();
  }, [clearActiveCall, postCallSummary, sendCallPresence]);

  useEffect(() => {
    endActiveCallRef.current = endActiveCall;
  }, [endActiveCall]);

  useEffect(() => {
    const handlePageHide = () => {
      if (activeCallRef.current) {
        endActiveCallRef.current();
      }
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  const answerPeerOffer = useCallback(async (
    signal: Extract<ChatCallSignal, { type: "call:offer" }>,
    localMedia: {
      error: unknown;
      stream: MediaStream | null;
    }
  ) => {
    if (callRefsRef.current[signal.fromUserId]) {
      return;
    }

    const peerCall = await createChatPeerCall({
      kind: signal.kind,
      localMediaError: localMedia.error,
      localStream: localMedia.stream,
      onConnectionLost: () => removePeerRef.current(signal.fromUserId),
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
      stopLocalStreamOnClose: false,
    });
    const description = await peerCall.answer(signal.description);

    callRefsRef.current[signal.fromUserId] = peerCall;
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
  }, [createSignalBase, flushIceCandidates, sendCallSignal, user.id]);

  const createMeshOffers = useCallback(async ({
    callId,
    conversationRoomId,
    conversationTitle,
    kind,
    localMedia,
    participantIds,
  }: {
    callId: string;
    conversationRoomId: string;
    conversationTitle: string;
    kind: ChatCallKind;
    localMedia: {
      error: unknown;
      stream: MediaStream | null;
    };
    participantIds: number[];
  }) => {
    for (const memberId of participantIds) {
      if (
        memberId === user.id ||
        memberId < user.id ||
        callRefsRef.current[memberId]
      ) {
        continue;
      }

      const peerCall = await createChatPeerCall({
        kind,
        localMediaError: localMedia.error,
        localStream: localMedia.stream,
        onConnectionLost: () => removePeerRef.current(memberId),
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
        stopLocalStreamOnClose: false,
      });
      const description = await peerCall.createOffer();

      callRefsRef.current[memberId] = peerCall;
      sendCallSignal(
        createSignalBase({
          type: "call:offer",
          callId,
          conversationRoomId,
          conversationTitle,
          fromUserId: user.id,
          toUserId: memberId,
          fromName: user.name,
          participantIds,
          description,
          kind,
        })
      );
    }
  }, [createSignalBase, sendCallSignal, user.id, user.name]);

  const connectCallMember = useCallback(async (memberId: number) => {
    const currentCall = activeCallRef.current;

    if (!currentCall || memberId === user.id) {
      return;
    }

    if (!currentCall.memberIds.includes(memberId)) {
      activeCallRef.current = {
        ...currentCall,
        memberIds: [...currentCall.memberIds, memberId],
        status: "connected",
      };
      setActiveCall(activeCallRef.current);
    }

    // createMeshOffers only offers higher-id peers; a lower-id peer offers us.
    await createMeshOffers({
      callId: currentCall.callId,
      conversationRoomId: currentCall.conversationRoomId,
      conversationTitle: currentCall.conversationTitle,
      kind: currentCall.kind,
      localMedia: { error: null, stream: localStreamRef.current },
      participantIds: [memberId],
    });
  }, [createMeshOffers, user.id]);

  useEffect(() => {
    connectCallMemberRef.current = (memberId) => {
      void connectCallMember(memberId);
    };
  }, [connectCallMember]);

  const joinCall = useCallback(
    async (conversation: ChatConversation, requestedKind?: ChatCallKind) => {
      const conversationKey = conversation.roomId;

      if (
        activeCallRef.current?.conversationRoomId === conversationKey ||
        joiningRoomRef.current === conversationKey
      ) {
        return;
      }

      // Leave any other call before joining this one.
      if (activeCallRef.current) {
        endActiveCall();
      }

      joiningRoomRef.current = conversationKey;

      const existing = callPresenceByKeyRef.current[conversationKey];
      const presentOthers = (existing?.users ?? []).filter(
        (presenceUser) => presenceUser.id !== user.id
      );
      const kind = existing?.users.length
        ? existing.kind
        : requestedKind ?? pendingCallKindRef.current;

      const nextCall: ActiveCall = {
        callId: conversationKey,
        conversationRoomId: conversationKey,
        conversationTitle: conversation.title,
        kind,
        memberIds: presentOthers.map((presenceUser) => presenceUser.id),
        startedAt: Date.now(),
        status: presentOthers.length ? "connected" : "calling",
      };

      activeCallRef.current = nextCall;
      setActiveCall(nextCall);

      try {
        const localMedia = await createChatLocalStream(kind);

        localStreamRef.current = localMedia.stream;
        setLocalStream(localMedia.stream);

        if (localMedia.error) {
          showPanelError("Erro na chamada", getCallErrorMessage(localMedia.error));
        }

        // Announce we're in the room; members already present will also offer us.
        sendCallPresence(conversationKey, kind, true);

        await createMeshOffers({
          callId: conversationKey,
          conversationRoomId: conversationKey,
          conversationTitle: conversation.title,
          kind,
          localMedia,
          participantIds: presentOthers.map((presenceUser) => presenceUser.id),
        });
      } catch (error) {
        clearActiveCall();
        showPanelError("Erro na chamada", getCallErrorMessage(error));
      } finally {
        joiningRoomRef.current = null;
      }
    },
    [clearActiveCall, createMeshOffers, endActiveCall, sendCallPresence, showPanelError, user.id]
  );

  useEffect(() => {
    joinCallRef.current = (conversation) => {
      void joinCall(conversation);
    };
  }, [joinCall]);

  const handleCallSignal = useCallback(
    (signal: ChatCallSignal) => {
      if (signal.toUserId !== user.id || signal.fromUserId === user.id) {
        return;
      }

      const currentCall = activeCallRef.current;

      // Signals only matter for the call we're currently in — there is no
      // ringing/incoming model anymore; you join a room and mesh with whoever
      // is present.
      if (signal.type === "call:offer") {
        if (currentCall?.callId !== signal.callId) {
          return;
        }

        void (async () => {
          const localMedia = localStreamRef.current
            ? { error: null, stream: localStreamRef.current }
            : await createChatLocalStream(signal.kind);

          if (!localStreamRef.current) {
            localStreamRef.current = localMedia.stream;
            setLocalStream(localMedia.stream);
          }

          await answerPeerOffer(signal, localMedia);

          if (activeCallRef.current) {
            activeCallRef.current = {
              ...activeCallRef.current,
              memberIds: Array.from(
                new Set([...activeCallRef.current.memberIds, signal.fromUserId])
              ),
              status: "connected",
            };
            setActiveCall(activeCallRef.current);
          }
        })();
        return;
      }

      if (signal.type === "call:answer") {
        const peerCall = callRefsRef.current[signal.fromUserId];

        if (currentCall?.callId !== signal.callId || !peerCall) {
          return;
        }

        void peerCall.setRemoteAnswer(signal.description).then(async () => {
          await flushIceCandidates(signal.callId);

          if (activeCallRef.current) {
            activeCallRef.current = { ...activeCallRef.current, status: "connected" };
            setActiveCall(activeCallRef.current);
          }
        });
        return;
      }

      if (signal.type === "call:candidate") {
        void addIceCandidate(signal);
        return;
      }

      if (signal.type === "call:end" && currentCall?.callId === signal.callId) {
        if (currentCall.memberIds.includes(signal.fromUserId)) {
          // A connected peer left.
          removePeerRef.current(signal.fromUserId);
        } else if (currentCall.memberIds.length === 0) {
          // Our invite was declined and we're the only one here — end the call.
          endActiveCallRef.current();
        }
      }
    },
    [addIceCandidate, answerPeerOffer, flushIceCandidates, user.id]
  );

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
  }, [appendMessage, roomId, socketUrl, user]);

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
  }, [handleCallSignal, roomScope, socketUrl, user]);

  useEffect(() => {
    const connection = connectChatSocket({
      roomId: getCallsPresenceRoomId(roomScope),
      url: socketUrl,
      user,
      onMessage: () => {},
      onCallPresence: (presence: ChatCallPresence) => {
        // Drive the mesh for the call we're currently in: connect to anyone who
        // joins our room, drop anyone who leaves.
        if (presence.user.id !== user.id) {
          const currentCall = activeCallRef.current;

          if (currentCall?.conversationRoomId === presence.conversationKey) {
            if (presence.present) {
              connectCallMemberRef.current(presence.user.id);
            } else {
              removePeerRef.current(presence.user.id);
            }
          }
        }

        setCallPresenceByKey((current) => {
          const entry = current[presence.conversationKey];
          const baseUsers = entry?.users ?? [];
          const users = presence.present
            ? [...baseUsers.filter((u) => u.id !== presence.user.id), presence.user]
            : baseUsers.filter((u) => u.id !== presence.user.id);
          const next = { ...current };

          if (users.length) {
            next[presence.conversationKey] = {
              kind: presence.present ? presence.kind : entry?.kind ?? presence.kind,
              users,
            };
          } else {
            delete next[presence.conversationKey];
          }

          return next;
        });

        // When a call empties, forget any decline so a future call rings again.
        if (!presence.present) {
          const entry = callPresenceByKeyRef.current[presence.conversationKey];
          const remaining = (entry?.users ?? []).filter(
            (presenceUser) => presenceUser.id !== presence.user.id
          );

          if (!remaining.length) {
            setDeclinedCallKeys((current) =>
              current.includes(presence.conversationKey)
                ? current.filter((key) => key !== presence.conversationKey)
                : current
            );
          }
        }
      },
    });

    callPresenceConnectionRef.current = connection;

    return () => {
      connection.close();
      callPresenceConnectionRef.current = null;
    };
  }, [roomScope, socketUrl, user]);

  useEffect(() => {
    callPresenceByKeyRef.current = callPresenceByKey;
  }, [callPresenceByKey]);

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
      onGroupDelete: (groupId) => {
        removeGroupLocally(groupId);
      },
    });

    groupsConnectionRef.current = connection;

    return () => {
      connection.close();
      groupsConnectionRef.current = null;
    };
  }, [removeGroupLocally, roomScope, socketUrl, user]);

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
  }, [messages.length, roomId]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Ring while there's an incoming call to answer.
  useEffect(() => {
    if (!incomingCallKey) {
      incomingRingRef.current?.stop();
      incomingRingRef.current = null;
      return;
    }

    if (!incomingRingRef.current) {
      incomingRingRef.current = playIncomingCallLoop();
    }

    return () => {
      incomingRingRef.current?.stop();
      incomingRingRef.current = null;
    };
  }, [incomingCallKey]);

  useEffect(() => {
    localStreamRef.current = localStream;

    if (localVideoRef.current && localVideoRef.current.srcObject !== localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    for (const [memberId, stream] of Object.entries(remoteStreamsByUserId)) {
      const video = remoteVideoRefs.current[Number(memberId)];

      if (video && video.srcObject !== stream) {
        video.srcObject = stream;
      }

      const audio = remoteAudioRefs.current[Number(memberId)];

      if (audio && audio.srcObject !== stream) {
        audio.srcObject = stream;
      }
    }
  }, [remoteStreamsByUserId]);

  useEffect(() => {
    // The /call route IS the call: entering it joins (or rejoins) the room.
    // joinCall is idempotent, so re-runs while already in the call are no-ops.
    if (!pathname?.endsWith("/call") || !selectedConversation) {
      return;
    }

    if (activeCallRef.current?.conversationRoomId === selectedConversation.roomId) {
      return;
    }

    joinCallRef.current(selectedConversation);
  }, [pathname, selectedConversation]);

  useEffect(() => {
    if (!activeCall || activeCall.status !== "connected") {
      return;
    }

    const interval = setInterval(() => setCallTick((tick) => tick + 1), 1000);

    return () => clearInterval(interval);
  }, [activeCall]);

  function startCallWithKind(kind: ChatCallKind) {
    if (!selectedConversation) {
      return;
    }

    pendingCallKindRef.current = kind;
    router.push(`/chat/${conversationIdToChatSlug(selectedConversation.id)}/call`);
  }

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
      showPanelError("Erro no grupo", "Escolha um nome e pelo menos um membro.");
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
    selectConversation(getGroupConversationId(group.id));
  }

  function deleteOrLeaveGroup(group: ChatGroup) {
    removeGroupLocally(group.id);
    startTransition(() => {
      groupsConnectionRef.current?.sendGroupDelete(group.id, group.roomScope);
    });
  }

  const messageCountLabel = useMemo(
    () => `${messages.length} ${messages.length === 1 ? "mensagem" : "mensagens"}`,
    [messages.length]
  );

  return (
    <>
      <AlertDialog
        open={Boolean(panelError)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPanelError(null);
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
              <PhoneOff className="size-4" />
            </AlertDialogMedia>
            <AlertDialogTitle>{panelErrorTitle}</AlertDialogTitle>
            <AlertDialogDescription>{panelError}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPanelError(null)}>
              OK
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
                aria-label={selectedConversationHasCall ? "Entrar na chamada" : "Iniciar chamada"}
                disabled={!selectedConversation}
                className={cn(selectedConversationHasCall && "text-yellow-500 hover:text-yellow-500")}
                onClick={() => startCallWithKind("audio")}
              >
                <Phone />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={selectedConversationHasCall ? "Entrar na videochamada" : "Iniciar videochamada"}
                disabled={!selectedConversation}
                className={cn(selectedConversationHasCall && "text-yellow-500 hover:text-yellow-500")}
                onClick={() => startCallWithKind("video")}
              >
                <Video />
              </Button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-background px-4 py-4">
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
                <div
                  key={conversation.id}
                  className={cn(
                    "relative flex w-full items-center transition-colors hover:bg-muted/70",
                    selected && "bg-muted"
                  )}
                >
                  <button
                    type="button"
                    title={conversation.title}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left",
                      membersCollapsed && "justify-center px-0"
                    )}
                    onClick={() => selectConversation(conversation.id)}
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
                  </button>
                  {!membersCollapsed && conversation.kind === "group" ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Ações do grupo"
                            className="mr-1 shrink-0"
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          variant={conversation.group.createdByUserId === user.id ? "destructive" : "default"}
                          onClick={() => deleteOrLeaveGroup(conversation.group)}
                        >
                          {conversation.group.createdByUserId === user.id ? (
                            <>
                              <Trash2 />
                              Eliminar grupo
                            </>
                          ) : (
                            <>
                              <LogOut />
                              Sair do grupo
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
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
                </div>
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

      {incomingCall ? (
        <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 border border-border bg-popover p-4 text-popover-foreground shadow-lg">
          <div className="flex items-center gap-3">
            <Avatar size="default">
              <AvatarFallback>{getInitials(incomingCall.from.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{incomingCall.conversation.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {incomingCall.kind === "video" ? "Videochamada" : "Chamada"} · {incomingCall.from.name}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => declineIncomingCall(incomingCall)}
            >
              <PhoneOff />
              Recusar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                router.push(`/chat/${conversationIdToChatSlug(incomingCall.conversation.id)}/call`)
              }
            >
              <Phone />
              Atender
            </Button>
          </div>
        </div>
      ) : null}

      {activeCall ? (
        <CallScreen
          title={activeCall.conversationTitle}
          statusLabel={callStatusLabel}
          elapsedLabel={callElapsedLabel}
          kind={activeCall.kind}
          participants={callParticipants}
          currentUserId={user.id}
          localVideoRef={localVideoRef}
          remoteVideoRefs={remoteVideoRefs}
          remoteAudioRefs={remoteAudioRefs}
          micEnabled={micEnabled}
          cameraEnabled={cameraEnabled}
          chatOpen={callChatOpen}
          messages={callMessages}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onToggleChat={() => setCallChatOpen((open) => !open)}
          onExit={() => endActiveCallRef.current()}
          onSendMessage={sendCallMessage}
        />
      ) : null}
    </>
  );
}

export { ChatPanel };
