import { useCallback, useEffect, useRef, useState } from "react";

/** One microphone owner for dictation and automatic voice turns. Every exit releases its tracks. */
export function useVoiceRecorder(options: {
  onRecording: (audio: Blob) => void;
  onError: (message: string) => void;
  onSilence?: () => void;
  automatic?: boolean;
}) {
  const callbacks = useRef(options);
  callbacks.current = options;
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const frame = useRef<number | null>(null);
  const generation = useRef(0);

  const release = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void context.current?.close().catch(() => undefined);
    context.current = null;
    setRecording(false);
    setLevel(0);
    setElapsed(0);
  }, []);

  const cancel = useCallback(() => {
    generation.current += 1;
    const active = recorder.current;
    recorder.current = null;
    if (active && active.state !== "inactive") {
      active.onstop = null;
      active.stop();
    }
    release();
  }, [release]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    cancel();
    const current = generation.current;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      callbacks.current.onError(
        "Voice recording is not available in this browser. You can type your question.",
      );
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (current !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      );
      const active = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = active;
      const chunks: Blob[] = [];
      let heardSpeech = false;
      let lastVoice = performance.now();
      let speechFrames = 0;
      const began = performance.now();
      active.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      active.onerror = () => {
        cancel();
        callbacks.current.onError(
          "The microphone could not record. Please retry or type your question.",
        );
      };
      active.onstop = () => {
        recorder.current = null;
        release();
        if (current !== generation.current) return;
        if (callbacks.current.automatic && !heardSpeech) {
          callbacks.current.onSilence?.();
          return;
        }
        const blob = new Blob(chunks, { type: active.mimeType });
        if (blob.size) callbacks.current.onRecording(blob);
      };
      const audioContext = new AudioContext();
      context.current = audioContext;
      await audioContext.resume();
      if (current !== generation.current) {
        release();
        return;
      }
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      audioContext.createMediaStreamSource(media).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      active.start(250);
      setRecording(true);
      const meter = () => {
        if (current !== generation.current || active.state !== "recording") return;
        analyser.getByteTimeDomainData(samples);
        const rms = Math.sqrt(
          samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length,
        );
        const now = performance.now();
        setLevel(Math.min(1, rms * 3.2));
        setElapsed(Math.floor((now - began) / 1000));
        if (rms > 0.018) {
          speechFrames += 1;
          if (speechFrames > 5) heardSpeech = true;
          lastVoice = now;
        }
        if (
          callbacks.current.automatic &&
          ((heardSpeech && now - lastVoice > 1400 && now - began > 1000) || now - began > 30000)
        ) {
          active.stop();
          return;
        }
        frame.current = requestAnimationFrame(meter);
      };
      meter();
    } catch {
      if (current !== generation.current) return;
      release();
      callbacks.current.onError(
        "The microphone is not available. Check microphone permission or type your question.",
      );
    }
  }, [cancel, release]);

  useEffect(() => cancel, [cancel]);
  return { start, stop, cancel, recording, level, elapsed };
}
