"use client";

import {
  Mic,
  MicOff,
  MessageSquare,
  PhoneOff,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type MutableRefObject } from "react";

import { MessageBubble } from "@/components/pages/chat/message-bubble";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatCallKind, ChatMessage } from "@/lib/utils/sockets";
import { cn } from "@/lib/utils";

type CallParticipant = {
  id: number;
  name: string;
  self: boolean;
  stream: MediaStream | null;
};

type CallScreenProps = {
  title: string;
  statusLabel: string;
  elapsedLabel: string;
  kind: ChatCallKind;
  participants: CallParticipant[];
  currentUserId: number;
  localVideoRef: MutableRefObject<HTMLVideoElement | null>;
  remoteVideoRefs: MutableRefObject<Record<number, HTMLVideoElement | null>>;
  remoteAudioRefs: MutableRefObject<Record<number, HTMLAudioElement | null>>;
  micEnabled: boolean;
  cameraEnabled: boolean;
  chatOpen: boolean;
  messages: ChatMessage[];
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleChat: () => void;
  onExit: () => void;
  onSendMessage: (body: string) => void;
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

function ParticipantTile({
  participant,
  kind,
  hasVideo,
  videoRef,
  audioRef,
}: {
  participant: CallParticipant;
  kind: ChatCallKind;
  hasVideo: boolean;
  videoRef: (node: HTMLVideoElement | null) => void;
  audioRef: (node: HTMLAudioElement | null) => void;
}) {
  return (
    <div className="relative flex aspect-video min-h-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-neutral-900">
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.self}
          className={cn(
            "size-full object-cover",
            participant.self && "-scale-x-100"
          )}
        />
      ) : (
        <Avatar size="lg" className="size-20">
          <AvatarFallback className="bg-neutral-800 text-xl text-neutral-200">
            {getInitials(participant.name)}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Remote audio is carried by the <video> element on video calls; on
          audio calls each remote needs its own sink so everyone is audible. */}
      {!participant.self && kind === "audio" ? (
        <audio ref={audioRef} autoPlay />
      ) : null}

      <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium text-white">
        {participant.self ? `${participant.name} (você)` : participant.name}
      </span>
    </div>
  );
}

function CallScreen({
  title,
  statusLabel,
  elapsedLabel,
  kind,
  participants,
  currentUserId,
  localVideoRef,
  remoteVideoRefs,
  remoteAudioRefs,
  micEnabled,
  cameraEnabled,
  chatOpen,
  messages,
  onToggleMic,
  onToggleCamera,
  onToggleChat,
  onExit,
  onSendMessage,
}: CallScreenProps) {
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatOpen) {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [chatOpen, messages]);

  function send() {
    const body = draft.trim();

    if (!body) {
      return;
    }

    onSendMessage(body);
    setDraft("");
  }

  const columns = Math.min(Math.max(Math.ceil(Math.sqrt(participants.length)), 1), 3);

  return (
    <div className="fixed inset-0 z-50 flex bg-neutral-950 text-white">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 px-6 py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{title}</p>
            <p className="text-sm text-neutral-400">
              {elapsedLabel ? elapsedLabel : statusLabel}
            </p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
          <div
            className="grid h-full content-center gap-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {participants.map((participant) => {
              const hasVideo =
                kind === "video" &&
                (participant.self
                  ? cameraEnabled
                  : (participant.stream?.getVideoTracks().length ?? 0) > 0);

              return (
                <ParticipantTile
                  key={participant.id}
                  participant={participant}
                  kind={kind}
                  hasVideo={hasVideo}
                  videoRef={(node) => {
                    if (participant.self) {
                      localVideoRef.current = node;
                    } else {
                      remoteVideoRefs.current[participant.id] = node;
                    }

                    if (node) {
                      node.srcObject = participant.stream;
                    }
                  }}
                  audioRef={(node) => {
                    remoteAudioRefs.current[participant.id] = node;

                    if (node) {
                      node.srcObject = participant.stream;
                    }
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-center gap-3 px-6 py-5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={micEnabled ? "Desligar microfone" : "Ligar microfone"}
            className={cn(
              "size-12 rounded-full",
              micEnabled
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-red-600 text-white hover:bg-red-500"
            )}
            onClick={onToggleMic}
          >
            {micEnabled ? <Mic /> : <MicOff />}
          </Button>
          {kind === "video" ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={cameraEnabled ? "Desligar câmara" : "Ligar câmara"}
              className={cn(
                "size-12 rounded-full",
                cameraEnabled
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "bg-red-600 text-white hover:bg-red-500"
              )}
              onClick={onToggleCamera}
            >
              {cameraEnabled ? <Video /> : <VideoOff />}
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Mensagens"
            className={cn(
              "size-12 rounded-full",
              chatOpen
                ? "bg-white text-neutral-900 hover:bg-white/90"
                : "bg-white/10 text-white hover:bg-white/20"
            )}
            onClick={onToggleChat}
          >
            <MessageSquare />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Sair da chamada"
            className="size-12 rounded-full bg-red-600 text-white hover:bg-red-500"
            onClick={onExit}
          >
            <PhoneOff />
          </Button>
        </div>
      </div>

      {chatOpen ? (
        <aside className="flex w-[min(22rem,calc(100vw-1rem))] min-h-0 flex-col border-l border-white/10 bg-neutral-900">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold">Mensagens</p>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Fechar mensagens"
              className="text-neutral-300 hover:text-white"
              onClick={onToggleChat}
            >
              <X />
            </Button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length ? (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  own={message.userId === currentUserId}
                />
              ))
            ) : (
              <div className="grid h-full place-items-center text-sm text-neutral-400">
                Ainda não existem mensagens.
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            className="flex items-end gap-2 border-t border-white/10 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder="Mensagem"
              className="max-h-28 min-h-10 flex-1 resize-none bg-neutral-950 text-white placeholder:text-neutral-500"
            />
            <Button
              type="submit"
              size="icon-sm"
              aria-label="Enviar mensagem"
              disabled={!draft.trim()}
              className="h-10 w-12 shrink-0"
            >
              <MessageSquare />
            </Button>
          </form>
        </aside>
      ) : null}
    </div>
  );
}

export { CallScreen };
