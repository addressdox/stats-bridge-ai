/* Microphone samples only. The output stays silent; no microphone monitoring. */
class StatBridgePcmInput extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Float32Array(1024);
    this.length = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    let offset = 0;
    while (offset < channel.length) {
      const count = Math.min(channel.length - offset, this.samples.length - this.length);
      this.samples.set(channel.subarray(offset, offset + count), this.length);
      this.length += count;
      offset += count;
      if (this.length === this.samples.length) {
        this.port.postMessage(this.samples, [this.samples.buffer]);
        this.samples = new Float32Array(1024);
        this.length = 0;
      }
    }
    return true;
  }
}

registerProcessor("statbridge-pcm-input", StatBridgePcmInput);
