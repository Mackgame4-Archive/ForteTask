"use client";

import type { ChatCallKind } from "@/lib/utils/sockets";

export type { ChatCallKind, ChatCallSignal } from "@/lib/utils/sockets";

type ChatPeerCallOptions = {
  iceServers?: RTCIceServer[];
  kind: ChatCallKind;
  localMediaError?: unknown;
  localStream?: MediaStream | null;
  onConnectionLost?: () => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  stopLocalStreamOnClose?: boolean;
};

export type ChatPeerCall = {
  addIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>;
  answer: (offer: RTCSessionDescriptionInit) => Promise<RTCSessionDescriptionInit>;
  close: () => void;
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  localMediaError: unknown;
  localStream: MediaStream | null;
  peerConnection: RTCPeerConnection;
  setRemoteAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>;
};

function createCallError(name: string, message: string) {
  if (typeof DOMException !== "undefined") {
    return new DOMException(message, name);
  }

  const error = new Error(message);
  error.name = name;
  return error;
}

function createCallId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function createChatPeerCall({
  iceServers = [{ urls: "stun:stun.l.google.com:19302" }],
  kind,
  localMediaError: providedLocalMediaError,
  localStream: providedLocalStream,
  onConnectionLost,
  onIceCandidate,
  onRemoteStream,
  stopLocalStreamOnClose = true,
}: ChatPeerCallOptions): Promise<ChatPeerCall> {
  let closedByUs = false;
  let localMediaError: unknown = providedLocalMediaError ?? null;
  let localStream: MediaStream | null = providedLocalStream ?? null;

  if (typeof RTCPeerConnection === "undefined") {
    throw createCallError(
      "NotSupportedError",
      "Este navegador nao suporta chamadas WebRTC."
    );
  }

  const peerConnection = new RTCPeerConnection({ iceServers });

  if (providedLocalStream === undefined) {
    const localMedia = await createChatLocalStream(kind);

    localMediaError = localMedia.error;
    localStream = localMedia.stream;
  }

  const audioTracks = localStream?.getAudioTracks() ?? [];
  const videoTracks = localStream?.getVideoTracks() ?? [];

  if (localStream) {
    for (const track of localStream.getTracks()) {
      peerConnection.addTrack(track, localStream);
    }
  }

  if (!audioTracks.length) {
    peerConnection.addTransceiver("audio", { direction: "recvonly" });
  }

  if (kind === "video" && !videoTracks.length) {
    peerConnection.addTransceiver("video", { direction: "recvonly" });
  }

  peerConnection.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      onIceCandidate?.(event.candidate);
    }
  });

  peerConnection.addEventListener("track", (event) => {
    const [remoteStream] = event.streams;

    if (remoteStream) {
      onRemoteStream?.(remoteStream);
    }
  });

  const handleConnectionState = () => {
    if (closedByUs) {
      return;
    }

    if (
      peerConnection.connectionState === "failed" ||
      peerConnection.iceConnectionState === "failed"
    ) {
      onConnectionLost?.();
    }
  };

  peerConnection.addEventListener("connectionstatechange", handleConnectionState);
  peerConnection.addEventListener("iceconnectionstatechange", handleConnectionState);

  return {
    addIceCandidate: (candidate) =>
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate)),
    answer: async (offer) => {
      await peerConnection.setRemoteDescription(offer);

      const answer = await peerConnection.createAnswer();

      await peerConnection.setLocalDescription(answer);

      return answer;
    },
    close: () => {
      closedByUs = true;
      peerConnection.close();

      if (stopLocalStreamOnClose) {
        for (const track of localStream?.getTracks() ?? []) {
          track.stop();
        }
      }
    },
    createOffer: async () => {
      const offer = await peerConnection.createOffer();

      await peerConnection.setLocalDescription(offer);

      return offer;
    },
    localMediaError,
    localStream,
    peerConnection,
    setRemoteAnswer: (answer) => peerConnection.setRemoteDescription(answer),
  };
}

async function createChatLocalStream(kind: ChatCallKind) {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw createCallError(
        typeof window !== "undefined" && !window.isSecureContext
          ? "SecurityError"
          : "NotSupportedError",
        "Chamadas precisam de HTTPS ou localhost."
      );
    }

    return {
      error: null,
      stream: await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === "video",
      }),
    };
  } catch (error) {
    return {
      error,
      stream: null,
    };
  }
}

export { createCallId, createChatLocalStream, createChatPeerCall };
