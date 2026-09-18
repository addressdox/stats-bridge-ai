export type LiveVoiceAudioCallbacks = {
  onInput: (data: string) => void;
  onInputLevel: (level: number) => void;
  onOutputLevel: (level: number) => void;
  onPlaybackChange: (playing: boolean) => void;
  onSpeechStart?: () => void;
};

/** Fractional sample windows persist across chunks, including 44.1 kHz input. */
export class StreamingPcmResampler {
  private readonly window: number;
  private weight = 0;
  private sum = 0;

  constructor(sourceRate: number, targetRate = 16000) {
    if (
      !Number.isFinite(sourceRate) ||
      sourceRate <= 0 ||
      !Number.isFinite(targetRate) ||
      targetRate <= 0
    )
      throw new RangeError("Invalid audio sample rate");
    this.window = sourceRate / targetRate;
  }

  push(input: Float32Array): Float32Array {
    const output: number[] = [];
    for (const sample of input) {
      let remaining = 1;
      while (remaining > 1e-9) {
        const take = Math.min(remaining, this.window - this.weight);
        this.sum += (Number.isFinite(sample) ? sample : 0) * take;
        this.weight += take;
        remaining -= take;
        if (this.weight >= this.window - 1e-9) {
          output.push(this.sum / this.window);
          this.weight = 0;
          this.sum = 0;
        }
      }
    }
    return Float32Array.from(output);
  }
}

export function encodePcm16(input: Float32Array): string {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < input.length; i++) {
    const raw = input[i] ?? 0;
    const sample = Math.max(-1, Math.min(1, Number.isFinite(raw) ? raw : 0));
    view.setInt16(i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export function decodePcm16(base64: string): Float32Array {
  const binary = atob(base64);
  if (binary.length % 2) throw new RangeError("PCM audio must contain complete 16-bit samples");
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(bytes.length / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return samples;
}

export function audioRms(samples: Float32Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) if (Number.isFinite(sample)) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

/** Local interruption detection only; the live model still owns turn detection. */
export class SpeechStartDetector {
  private aboveMs = 0;
  private silentMs = 0;
  private speaking = false;

  push(level: number, durationMs: number): boolean {
    if (level >= 0.025) {
      this.silentMs = 0;
      this.aboveMs += durationMs;
      if (!this.speaking && this.aboveMs >= 150) {
        this.speaking = true;
        return true;
      }
    } else {
      this.aboveMs = 0;
      this.silentMs += durationMs;
      if (this.silentMs >= 700) this.speaking = false;
    }
    return false;
  }
}

function abortError() {
  return new DOMException("The voice call ended", "AbortError");
}

/** One call's microphone and speaker. A closed instance is deliberately not reusable. */
export class LiveVoiceAudio {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private processor: AudioWorkletNode | ScriptProcessorNode | null = null;
  private silentOutput: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private meter: ReturnType<typeof setInterval> | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private nextStartTime = 0;
  private playing = false;
  private closed = false;
  private startPromise: Promise<void> | null = null;
  private playbackGeneration = 0;
  private decodeTail: Promise<void> = Promise.resolve();
  private input = 0;
  private output = 0;

  constructor(private readonly callbacks: LiveVoiceAudioCallbacks) {}

  get inputLevel() {
    return this.input;
  }
  get outputLevel() {
    return this.output;
  }

  start(): Promise<void> {
    if (this.closed) return Promise.reject(abortError());
    if (!this.startPromise) this.startPromise = this.open();
    return this.startPromise;
  }

  private async open(): Promise<void> {
    try {
      const Constructor =
        globalThis.AudioContext ??
        (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Constructor) throw new Error("Audio is not available in this browser");
      // Create/resume immediately from the call gesture, before permission or network awaits.
      const context = new Constructor();
      this.context = context;
      if (context.state === "suspended") await context.resume();
      if (this.closed) throw abortError();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      if (this.closed) {
        stream.getTracks().forEach((track) => track.stop());
        throw abortError();
      }
      this.stream = stream;
      this.microphone = context.createMediaStreamSource(stream);
      const resampler = new StreamingPcmResampler(context.sampleRate);
      const speech = new SpeechStartDetector();
      const receive = (samples: Float32Array) => {
        if (this.closed) return;
        this.input = Math.min(1, audioRms(samples));
        this.callbacks.onInputLevel(this.input);
        if (this.closed) return;
        if (speech.push(this.input, (samples.length / context.sampleRate) * 1000))
          this.callbacks.onSpeechStart?.();
        if (this.closed) return;
        const pcm = resampler.push(samples);
        if (pcm.length) this.callbacks.onInput(encodePcm16(pcm));
      };

      if (context.audioWorklet && typeof AudioWorkletNode !== "undefined") {
        try {
          await context.audioWorklet.addModule("/voice-pcm-worklet.js");
          if (this.closed) throw abortError();
          const node = new AudioWorkletNode(context, "statbridge-pcm-input");
          this.processor = node;
          node.port.onmessage = (event: MessageEvent<unknown>) => {
            if (event.data instanceof Float32Array) receive(event.data);
          };
        } catch (error) {
          if (this.closed) throw abortError();
          // Older browsers/CSP may not permit a worklet; keep the same continuous input path.
          this.processor = null;
        }
      }
      if (!this.processor) {
        const node = context.createScriptProcessor(2048, 1, 1);
        node.onaudioprocess = (event) => receive(event.inputBuffer.getChannelData(0));
        this.processor = node;
      }
      if (this.closed) throw abortError();
      this.silentOutput = context.createGain();
      this.silentOutput.gain.value = 0;
      this.microphone.connect(this.processor);
      this.processor.connect(this.silentOutput);
      this.silentOutput.connect(context.destination);
      this.analyser = context.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.connect(context.destination);
      const samples = new Float32Array(this.analyser.fftSize);
      this.meter = setInterval(() => {
        if (this.closed || !this.analyser || !this.playing) return;
        this.analyser.getFloatTimeDomainData(samples);
        this.output = Math.min(1, audioRms(samples));
        this.callbacks.onOutputLevel(this.output);
      }, 50);
    } catch (error) {
      const wasClosed = this.closed;
      this.close();
      throw wasClosed ? abortError() : error;
    }
  }

  queue(base64PCM: string, rate = 24000): void {
    if (this.closed) return;
    if (!Number.isFinite(rate) || rate <= 0) throw new RangeError("Invalid audio sample rate");
    const samples = decodePcm16(base64PCM);
    if (!samples.length) return;
    const context = this.context;
    if (!context || !this.analyser) throw new Error("Start audio before queuing playback");
    const buffer = context.createBuffer(1, samples.length, rate);
    buffer.getChannelData(0).set(samples);
    this.schedule(buffer);
  }

  /** Preserves call order for complete encoded responses, such as an existing MP3 voice. */
  playEncoded(data: ArrayBuffer): Promise<void> {
    if (this.closed) return Promise.reject(abortError());
    const generation = this.playbackGeneration;
    const previous = this.decodeTail;
    const task = (async () => {
      await previous;
      if (this.closed || generation !== this.playbackGeneration) return;
      const context = this.context;
      if (!context || !this.analyser) throw new Error("Start audio before queuing playback");
      const buffer = await context.decodeAudioData(data.slice(0));
      if (this.closed || generation !== this.playbackGeneration) return;
      this.schedule(buffer);
    })();
    this.decodeTail = task.catch(() => undefined);
    return task;
  }

  private schedule(buffer: AudioBuffer): void {
    const context = this.context;
    if (this.closed || !context || !this.analyser) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser);
    // Apply startup headroom only to an empty/expired queue. Reapplying it to
    // an on-time chunk inserts silence when less than 5 ms remains, producing
    // repeated hard edges in otherwise continuous speech from either renderer.
    const start =
      this.nextStartTime > 0 && this.nextStartTime >= context.currentTime
        ? this.nextStartTime
        : context.currentTime + 0.005;
    source.onended = () => {
      if (!this.sources.delete(source)) return;
      source.disconnect();
      if (!this.sources.size) this.setPlaying(false);
    };
    this.sources.add(source);
    try {
      source.start(start);
      this.nextStartTime = start + buffer.duration;
      this.setPlaying(true);
    } catch (error) {
      this.sources.delete(source);
      source.disconnect();
      throw error;
    }
  }

  private setPlaying(playing: boolean): void {
    if (!playing) {
      this.output = 0;
      this.callbacks.onOutputLevel(0);
    }
    if (this.playing === playing) return;
    this.playing = playing;
    this.callbacks.onPlaybackChange(playing);
  }

  stopPlayback(): void {
    this.playbackGeneration += 1;
    this.decodeTail = Promise.resolve();
    const sources = [...this.sources];
    this.sources.clear();
    this.nextStartTime = 0;
    for (const source of sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
      source.disconnect();
    }
    this.setPlaying(false);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.stopPlayback();
    if (this.meter) clearInterval(this.meter);
    this.meter = null;
    if (this.processor && "port" in this.processor) {
      this.processor.port.onmessage = null;
      this.processor.port.close();
    } else if (this.processor) this.processor.onaudioprocess = null;
    this.processor?.disconnect();
    this.processor = null;
    this.microphone?.disconnect();
    this.microphone = null;
    this.silentOutput?.disconnect();
    this.silentOutput = null;
    this.analyser?.disconnect();
    this.analyser = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
    this.input = 0;
    this.callbacks.onInputLevel(0);
  }
}
