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

export type GardenSound = "plant" | "click" | "bloom" | "ribbit" | "purr" | "buzz" | "gift";

export const playGardenSound = (sound: GardenSound) => {
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
    } else if (sound === "bloom") {
      // A soft wind-chime: a rising major triad, each note ringing out.
      [523.25, 659.25, 783.99, 1046.5].forEach((note, index) => playTone(context, start + index * 0.11, note, note, 1.1, 0.035, "sine"));
    } else if (sound === "ribbit") {
      playTone(context, start, 180, 120, 0.09, 0.08, "sawtooth");
      playTone(context, start + 0.12, 200, 130, 0.11, 0.08, "sawtooth");
    } else if (sound === "purr") {
      // A low, slow rumble: a handful of soft pulses.
      for (let pulse = 0; pulse < 6; pulse++) playTone(context, start + pulse * 0.09, 55, 48, 0.08, 0.07, "triangle");
    } else if (sound === "buzz") {
      playTone(context, start, 220, 330, 0.5, 0.025, "sawtooth");
    } else if (sound === "gift") {
      [783.99, 987.77, 1318.51].forEach((note, index) => playTone(context, start + index * 0.07, note, note, 0.5, 0.04, "triangle"));
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

// ---------------------------------------------------------------------------
// Ambience: wind always, birds by day, crickets at night, rain on rainy days.
// Everything is synthesised, so there are no audio files to download.

export type AmbienceScene = { dayPart: "dawn" | "day" | "dusk" | "night"; weather: "sunny" | "fair" | "cloudy" | "rain" };

const noiseBuffer = (context: AudioContext, seconds: number) => {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  const samples = buffer.getChannelData(0);
  // Brown-ish noise: smoother than white, more like wind.
  let last = 0;
  for (let index = 0; index < samples.length; index++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    samples[index] = last * 3.5;
  }
  return buffer;
};

class Ambience {
  private context: AudioContext;
  private master: GainNode;
  private wind: GainNode;
  private rain: GainNode;
  private sources: AudioScheduledSourceNode[] = [];
  private timer: number | undefined;
  private scene: AmbienceScene = { dayPart: "day", weather: "fair" };

  constructor(context: AudioContext) {
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.master.connect(context.destination);

    // Wind: looping noise through a slowly swaying low-pass filter.
    const windSource = context.createBufferSource();
    windSource.buffer = noiseBuffer(context, 4);
    windSource.loop = true;
    const windFilter = context.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 420;
    const sway = context.createOscillator();
    const swayDepth = context.createGain();
    sway.frequency.value = 0.08;
    swayDepth.gain.value = 220;
    sway.connect(swayDepth).connect(windFilter.frequency);
    this.wind = context.createGain();
    this.wind.gain.value = 0.18;
    windSource.connect(windFilter).connect(this.wind).connect(this.master);

    // Rain: brighter noise, only audible on rainy days.
    const rainSource = context.createBufferSource();
    const rainBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const rainSamples = rainBuffer.getChannelData(0);
    for (let index = 0; index < rainSamples.length; index++) rainSamples[index] = Math.random() * 2 - 1;
    rainSource.buffer = rainBuffer;
    rainSource.loop = true;
    const rainFilter = context.createBiquadFilter();
    rainFilter.type = "bandpass";
    rainFilter.frequency.value = 2600;
    rainFilter.Q.value = 0.4;
    this.rain = context.createGain();
    this.rain.gain.value = 0;
    rainSource.connect(rainFilter).connect(this.rain).connect(this.master);

    windSource.start();
    rainSource.start();
    sway.start();
    this.sources.push(windSource, rainSource, sway);
  }

  start() {
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0.6, now + 2);
    this.scheduleCreatures();
  }

  setScene(scene: AmbienceScene) {
    this.scene = scene;
    const now = this.context.currentTime;
    this.rain.gain.setTargetAtTime(scene.weather === "rain" ? 0.07 : 0, now, 1.5);
    this.wind.gain.setTargetAtTime(scene.weather === "cloudy" || scene.weather === "rain" ? 0.26 : 0.16, now, 1.5);
  }

  // Birds and crickets: short calls at random intervals.
  private scheduleCreatures = () => {
    const { dayPart, weather } = this.scene;
    const start = this.context.currentTime + 0.05;
    if (dayPart === "night") {
      // A cricket: a fast trill of tiny high pulses.
      for (let pulse = 0; pulse < 7; pulse++) this.chirp(start + pulse * 0.045, 4400, 4300, 0.03, 0.012);
    } else if (weather !== "rain") {
      // A bird: two to four quick, falling whistles.
      const notes = 2 + Math.floor(Math.random() * 3);
      const base = 2400 + Math.random() * 1600;
      for (let note = 0; note < notes; note++) this.chirp(start + note * 0.13, base * (1 + Math.random() * 0.2), base * 0.7, 0.09, 0.02);
    }
    const gap = dayPart === "night" ? 900 + Math.random() * 1600 : dayPart === "dawn" ? 900 + Math.random() * 2000 : 2500 + Math.random() * 5000;
    this.timer = window.setTimeout(this.scheduleCreatures, gap);
  };

  private chirp(start: number, from: number, to: number, duration: number, volume: number) {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, start + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(this.master);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  stop() {
    window.clearTimeout(this.timer);
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 0.6);
    window.setTimeout(() => {
      for (const source of this.sources) source.stop();
      this.master.disconnect();
    }, 700);
  }
}

let ambience: Ambience | undefined;

// Must be called from a tap or click the first time (browsers block autoplay).
export const startAmbience = (scene: AmbienceScene) => {
  const context = prepareGardenAudio();
  if (!context) return false;
  ambience ??= new Ambience(context);
  ambience.setScene(scene);
  ambience.start();
  return true;
};

export const updateAmbience = (scene: AmbienceScene) => ambience?.setScene(scene);

export const stopAmbience = () => {
  ambience?.stop();
  ambience = undefined;
};
