let audioContext: AudioContext | undefined;

// Unlock during the submit gesture, before the planting request finishes.
export const prepareGardenAudio = (): AudioContext | undefined => {
  try {
    if (typeof window === "undefined" || !window.AudioContext) return;
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new AudioContext();
    }
    if (audioContext.state === "suspended") {
      void audioContext.resume().catch(() => {});
    }
    return audioContext;
  } catch {
    // Audio is optional; a blocked device must never interrupt a journal action.
    return undefined;
  }
};

const playTone = (
  context: AudioContext,
  start: number,
  frequency: number,
  endFrequency: number,
  duration: number,
  volume: number,
  type: OscillatorType,
) => {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration * 0.6);
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(volume, start + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  envelope.gain.linearRampToValueAtTime(0, start + duration + 0.01);
  oscillator.connect(envelope);
  envelope.connect(context.destination);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
  oscillator.start(start);
  oscillator.stop(start + duration + 0.015);
};

const playLeafRustle = (context: AudioContext, start: number) => {
  const duration = 0.085;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(2400, start);
  filter.frequency.exponentialRampToValueAtTime(1000, start + duration);
  filter.Q.value = 0.7;
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(0.045, start + 0.006);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration - 0.01);
  envelope.gain.linearRampToValueAtTime(0, start + duration);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(context.destination);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    envelope.disconnect();
  };
  source.start(start);
  source.stop(start + duration);
};

export const playGardenSound = (sound: "plant" | "click") => {
  const context = prepareGardenAudio();
  if (!context) return;

  const play = () => {
    if (context.state !== "running") return;
    const start = context.currentTime + 0.01;
    if (sound === "plant") {
      // A crisp arcade coin pickup: short high note, octave leap, metallic sparkle.
      playTone(context, start, 987.77, 987.77, 0.075, 0.045, "square");
      playTone(context, start + 0.07, 1975.53, 1975.53, 0.34, 0.055, "square");
      playTone(context, start + 0.075, 3951.07, 3951.07, 0.24, 0.025, "sine");
    } else {
      // A rounded stem pluck with a brief leafy rustle, distinct from the reward.
      playTone(context, start, 420, 170, 0.12, 0.12, "sine");
      playTone(context, start + 0.012, 740, 370, 0.065, 0.025, "triangle");
      playLeafRustle(context, start);
    }
  };

  // Resume may still be pending on the first interaction.
  void context.resume().then(play).catch(() => {});
};
