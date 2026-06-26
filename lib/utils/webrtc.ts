"use client";

import type { ChatCallKind } from "@/lib/utils/sockets";

export type { ChatCallKind, ChatCallSignal } from "@/lib/utils/sockets";

type ChatPeerCallOptions = {
  iceServers?: RTCIceServer[];
  kind: ChatCallKind;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onRemoteStream?: (stream: MediaStream) => void;
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
  onIceCandidate,
  onRemoteStream,
}: ChatPeerCallOptions): Promise<ChatPeerCall> {
  let localMediaError: unknown = null;
  let localStream: MediaStream | null = null;

  if (typeof RTCPeerConnection === "undefined") {
    throw createCallError(
      "NotSupportedError",
      "Este navegador nao suporta chamadas WebRTC."
    );
  }

  const peerConnection = new RTCPeerConnection({ iceServers });

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw createCallError(
        typeof window !== "undefined" && !window.isSecureContext
          ? "SecurityError"
          : "NotSupportedError",
        "Chamadas precisam de HTTPS ou localhost."
      );
    }

    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === "video",
    });
  } catch (error) {
    localMediaError = error;
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
      peerConnection.close();

      for (const track of localStream?.getTracks() ?? []) {
        track.stop();
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

export { createCallId, createChatPeerCall };
