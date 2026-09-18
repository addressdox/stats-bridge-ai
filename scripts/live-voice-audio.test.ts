import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  LiveVoiceAudio,
  SpeechStartDetector,
  StreamingPcmResampler,
  audioRms,
  decodePcm16,
  encodePcm16,
  type LiveVoiceAudioCallbacks,
} from "../src/lib/statbridge/live-voice-audio";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("continuous PCM audio", () => {
  for (const sampleRate of [44100, 48000]) {
    test(`${sampleRate} Hz has no sample drift across irregular chunks`, () => {
      const input = Float32Array.from(
        { length: sampleRate * 3 },
        (_, i) => Math.sin((i / sampleRate) * 2000 * Math.PI) * 0.5,
      );
      const whole = new StreamingPcmResampler(sampleRate).push(input);
      const stream = new StreamingPcmResampler(sampleRate);
      const chunks: number[] = [];
      let position = 0;
      for (let i = 0; position < input.length; i++) {
        const length = [128, 1024, 333, 2048, 57][i % 5]!;
        chunks.push(...stream.push(input.subarray(position, position + length)));
        position += length;
      }
      expect(whole.length).toBe(48000);
      expect(chunks).toEqual(Array.from(whole));
      expect(audioRms(whole)).toBeGreaterThan(0.34);
      expect(audioRms(whole)).toBeLessThan(0.36);
    });
  }

  test("fractional window retains an incomplete sample until the next chunk", () => {
    const resampler = new StreamingPcmResampler(48000);
    expect(Array.from(resampler.push(new Float32Array([0.25, 0.25])))).toEqual([]);
    expect(Array.from(resampler.push(new Float32Array([0.25])))).toEqual([0.25]);
  });

  test("PCM uses signed little endian bytes, clips and rejects partial samples", () => {
    const encoded = encodePcm16(new Float32Array([-2, 0, 2, Number.NaN]));
    expect(Array.from(atob(encoded), (c) => c.charCodeAt(0))).toEqual([
      0, 128, 0, 0, 255, 127, 0, 0,
    ]);
    expect(Array.from(decodePcm16(encoded))).toEqual([-1, 0, 32767 / 32768, 0]);
    expect(() => decodePcm16(btoa("x"))).toThrow("complete 16-bit");
    expect(() => new StreamingPcmResampler(0)).toThrow("sample rate");
  });

  test("speech onset ignores short clicks and resets after 700ms silence", () => {
    const vad = new SpeechStartDetector();
    expect(vad.push(0.4, 20)).toBe(false);
    expect(vad.push(0, 20)).toBe(false);
    expect(vad.push(0.04, 100)).toBe(false);
    expect(vad.push(0.04, 50)).toBe(true);
    expect(vad.push(0.04, 200)).toBe(false);
    expect(vad.push(0, 699)).toBe(false);
    expect(vad.push(0.04, 200)).toBe(false);
    expect(vad.push(0, 700)).toBe(false);
    expect(vad.push(0.04, 150)).toBe(true);
  });
});

class FakeNode {
  disconnected = 0;
  connect<T>(node: T): T {
    return node;
  }
  disconnect() {
    this.disconnected++;
  }
}
class FakeBuffer {
  readonly data: Float32Array;
  readonly duration: number;
  constructor(length: number, rate: number) {
    this.data = new Float32Array(length);
    this.duration = length / rate;
  }
  getChannelData() {
    return this.data;
  }
}
class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  onended: (() => void) | null = null;
  startTime: number | null = null;
  stopped = 0;
  start(when: number) {
    this.startTime = when;
  }
  stop() {
    this.stopped++;
    this.onended?.();
  }
}
class FakeProcessor extends FakeNode {
  onaudioprocess: ((event: { inputBuffer: FakeBuffer }) => void) | null = null;
}
class FakeContext {
  static instances: FakeContext[] = [];
  state = "suspended";
  sampleRate = 48000;
  currentTime = 10;
  destination = new FakeNode();
  sources: FakeSource[] = [];
  processor: FakeProcessor | null = null;
  resumed = 0;
  closed = 0;
  module: Promise<void> = Promise.resolve();
  decoding: Promise<FakeBuffer> = Promise.resolve(new FakeBuffer(2400, 24000));
  audioWorklet = {
    addModule: (url: string) => {
      expect(url).toBe("/voice-pcm-worklet.js");
      return this.module;
    },
  };
  constructor() {
    FakeContext.instances.push(this);
  }
  async resume() {
    this.resumed++;
    this.state = "running";
  }
  async close() {
    this.closed++;
    this.state = "closed";
  }
  createMediaStreamSource() {
    return new FakeNode();
  }
  createGain() {
    return Object.assign(new FakeNode(), { gain: { value: 1 } });
  }
  createAnalyser() {
    return Object.assign(new FakeNode(), {
      fftSize: 512,
      getFloatTimeDomainData: (samples: Float32Array) => samples.fill(0.2),
    });
  }
  createScriptProcessor() {
    this.processor = new FakeProcessor();
    return this.processor;
  }
  createBuffer(_channels: number, length: number, rate: number) {
    return new FakeBuffer(length, rate);
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  decodeAudioData() {
    return this.decoding;
  }
}
class FakeWorklet extends FakeNode {
  static instances: FakeWorklet[] = [];
  port = {
    onmessage: null as ((event: { data: Float32Array }) => void) | null,
    closed: false,
    close: () => {
      this.port.closed = true;
    },
  };
  constructor(_context: unknown, name: string) {
    super();
    expect(name).toBe("statbridge-pcm-input");
    FakeWorklet.instances.push(this);
  }
}

describe("call audio lifecycle with synthetic browser devices", () => {
  const original = new Map<string, PropertyDescriptor | undefined>();
  const active: LiveVoiceAudio[] = [];
  let stopped: number;
  let permission: ReturnType<typeof deferred<MediaStream>>;
  let stream: MediaStream;
  let constraints: MediaStreamConstraints | undefined;

  function callbacks() {
    const input: string[] = [];
    const playback: boolean[] = [];
    let speech = 0;
    const value: LiveVoiceAudioCallbacks = {
      onInput: (data) => input.push(data),
      onInputLevel: () => undefined,
      onOutputLevel: () => undefined,
      onPlaybackChange: (playing) => playback.push(playing),
      onSpeechStart: () => {
        speech++;
      },
    };
    const audio = new LiveVoiceAudio(value);
    active.push(audio);
    return { audio, input, playback, speech: () => speech };
  }

  beforeEach(() => {
    for (const key of ["navigator", "AudioContext", "AudioWorkletNode"])
      original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    FakeContext.instances = [];
    FakeWorklet.instances = [];
    stopped = 0;
    constraints = undefined;
    permission = deferred<MediaStream>();
    stream = {
      getTracks: () => [
        {
          stop: () => {
            stopped++;
          },
        },
      ],
    } as unknown as MediaStream;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: (value: MediaStreamConstraints) => {
            constraints = value;
            return permission.promise;
          },
        },
      },
    });
    Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: FakeContext });
    Object.defineProperty(globalThis, "AudioWorkletNode", {
      configurable: true,
      value: FakeWorklet,
    });
  });

  afterEach(() => {
    for (const audio of active.splice(0)) audio.close();
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    original.clear();
  });

  test("ending while permission is pending releases the late stream without starting capture", async () => {
    const { audio, input } = callbacks();
    const starting = audio.start();
    const rejected = starting.catch((error: unknown) => error);
    await Promise.resolve();
    audio.close();
    permission.resolve(stream);
    expect(await rejected).toMatchObject({ name: "AbortError" });
    expect(stopped).toBe(1);
    expect(FakeWorklet.instances).toHaveLength(0);
    expect(input).toHaveLength(0);
    expect(FakeContext.instances[0]!.closed).toBe(1);
    await expect(audio.start()).rejects.toMatchObject({ name: "AbortError" });
  });

  test("ending during worklet loading releases acquired input and cannot start late", async () => {
    const { audio } = callbacks();
    const starting = audio.start();
    const module = deferred<void>();
    FakeContext.instances[0]!.module = module.promise;
    permission.resolve(stream);
    await Promise.resolve();
    await Promise.resolve();
    const rejected = starting.catch((error: unknown) => error);
    audio.close();
    module.resolve();
    expect(await rejected).toMatchObject({ name: "AbortError" });
    expect(stopped).toBe(1);
    expect(FakeWorklet.instances).toHaveLength(0);
  });

  test("worklet captures continuous PCM, uses real stream rate, and detaches callbacks on close", async () => {
    const { audio, input, speech } = callbacks();
    const starting = audio.start();
    expect(audio.start()).toBe(starting);
    permission.resolve(stream);
    await starting;
    expect(constraints?.audio).toEqual({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    });
    const node = FakeWorklet.instances[0]!;
    for (let i = 0; i < 8; i++) node.port.onmessage!({ data: new Float32Array(1024).fill(0.1) });
    expect(input.reduce((sum, chunk) => sum + decodePcm16(chunk).length, 0)).toBe(
      Math.floor(8192 / 3),
    );
    expect(speech()).toBe(1);
    expect(audio.inputLevel).toBeCloseTo(0.1);
    audio.close();
    expect(node.port.onmessage).toBeNull();
    expect(node.port.closed).toBe(true);
    expect(stopped).toBe(1);
    expect(audio.inputLevel).toBe(0);
  });

  test("script processor fallback keeps continuous input when worklets are unavailable", async () => {
    Object.defineProperty(globalThis, "AudioWorkletNode", { configurable: true, value: undefined });
    const { audio, input } = callbacks();
    permission.resolve(stream);
    await audio.start();
    const processor = FakeContext.instances[0]!.processor!;
    const buffer = new FakeBuffer(2048, 48000);
    buffer.data.fill(0.1);
    processor.onaudioprocess!({ inputBuffer: buffer });
    expect(decodePcm16(input[0]!).length).toBe(682);
    audio.close();
    expect(processor.onaudioprocess).toBeNull();
  });

  test("PCM chunks are scheduled gaplessly and interruption synchronously clears queued sources", async () => {
    const { audio, playback } = callbacks();
    permission.resolve(stream);
    await audio.start();
    const pcm = encodePcm16(new Float32Array(2400));
    audio.queue(pcm);
    audio.queue(pcm);
    const context = FakeContext.instances[0]!;
    expect(context.sources[0]!.startTime).toBeCloseTo(10.005);
    expect(context.sources[1]!.startTime).toBeCloseTo(10.105);
    expect(playback).toEqual([true]);
    audio.stopPlayback();
    expect(context.sources.map((source) => source.stopped)).toEqual([1, 1]);
    expect(playback).toEqual([true, false]);
    expect(stopped).toBe(0);
    audio.queue(pcm);
    expect(context.sources[2]!.startTime).toBeCloseTo(10.005);
    audio.close();
    expect(context.sources[2]!.stopped).toBe(1);
    expect(stopped).toBe(1);
  });

  test("encoded audio finishing decode after interruption cannot restart playback", async () => {
    const { audio, playback } = callbacks();
    permission.resolve(stream);
    await audio.start();
    const decoded = deferred<FakeBuffer>();
    const context = FakeContext.instances[0]!;
    context.decoding = decoded.promise;
    const playing = audio.playEncoded(new ArrayBuffer(8));
    await Promise.resolve();
    audio.stopPlayback();
    decoded.resolve(new FakeBuffer(2400, 24000));
    await playing;
    expect(context.sources).toHaveLength(0);
    expect(playback).toEqual([]);
  });

  test("permission refusal closes context and does not open any capture node", async () => {
    const { audio } = callbacks();
    const starting = audio.start();
    const refused = starting.catch((error: unknown) => error);
    permission.reject(new DOMException("No microphone permission", "NotAllowedError"));
    expect(await refused).toMatchObject({ name: "NotAllowedError" });
    expect(FakeContext.instances[0]!.closed).toBe(1);
    expect(FakeWorklet.instances).toHaveLength(0);
  });
});

test("audio worklet preserves sample order across render blocks", async () => {
  const source = await Bun.file(new URL("../public/voice-pcm-worklet.js", import.meta.url)).text();
  const posted: Float32Array[] = [];
  let Processor!: new () => { process(inputs: Float32Array[][]): boolean };
  class FakeWorkletProcessor {
    port = { postMessage: (samples: Float32Array) => posted.push(samples.slice()) };
  }
  new Function("AudioWorkletProcessor", "registerProcessor", source)(
    FakeWorkletProcessor,
    (_name: string, value: typeof Processor) => {
      Processor = value;
    },
  );
  const instance = new Processor();
  for (let i = 0; i < 9; i++)
    expect(instance.process([[Float32Array.from({ length: 128 }, (_, j) => i * 128 + j)]])).toBe(
      true,
    );
  expect(posted).toHaveLength(1);
  expect(Array.from(posted[0]!)).toEqual(Array.from({ length: 1024 }, (_, i) => i));
});
