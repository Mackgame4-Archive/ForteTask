"use client";

const incomingCallAudioSrc = "/audio/incoming_call.mp3";
const callEndAudioSrc = "/audio/call_end.mp3";

type LoopingAudioHandle = {
  stop: () => void;
};

function createAudio(src: string, loop: boolean) {
  if (typeof Audio === "undefined") {
    return null;
  }

  const audio = new Audio(src);

  audio.loop = loop;
  audio.preload = "auto";

  return audio;
}

function playLoopingAudio(src: string): LoopingAudioHandle {
  const audio = createAudio(src, true);

  if (!audio) {
    return { stop: () => {} };
  }

  void audio.play().catch(() => {});

  return {
    stop: () => {
      audio.pause();
      audio.currentTime = 0;
    },
  };
}

function playAudioOnce(src: string) {
  const audio = createAudio(src, false);

  if (!audio) {
    return;
  }

  void audio.play().catch(() => {});
}

function playIncomingCallLoop() {
  return playLoopingAudio(incomingCallAudioSrc);
}

function playCallEndSound() {
  playAudioOnce(callEndAudioSrc);
}

export { playCallEndSound, playIncomingCallLoop };
