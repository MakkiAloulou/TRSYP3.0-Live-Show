// Sci-fi HUD sound effects, synthesised with Web Audio (no audio files).
// Every sound takes an optional `at` delay in seconds so screens can line
// sounds up with their animations. Browsers only allow audio after the first
// key press / click, so the context is created lazily on the first sound.

const MUTE_KEY = "trsyp3-muted";
const MASTER = 0.75;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverb: ConvolverNode | null = null;
let muted = false;
const listeners = new Set<(m: boolean) => void>();

try {
  muted = typeof window !== "undefined" && localStorage.getItem(MUTE_KEY) === "1";
} catch {}

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER;
    master.connect(comp).connect(ctx.destination);
    // short generated room for the big hits
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 2.2, 2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    reverb.connect(wet).connect(master);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function impulse(c: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

let noiseBuf: AudioBuffer | null = null;
function noiseBuffer(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/* ─── building blocks ───────────────────────────────────────────────── */

interface ToneOpts {
  freq: number;
  to?: number; // pitch slide target
  dur: number;
  type?: OscillatorType;
  gain?: number;
  at?: number;
  attack?: number;
  wet?: boolean; // send to reverb too
}

function tone({ freq, to, dur, type = "sine", gain = 0.3, at = 0, attack = 0.005, wet }: ToneOpts) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  if (wet && reverb) g.connect(reverb);
  o.start(t);
  o.stop(t + dur + 0.05);
}

interface NoiseOpts {
  dur: number;
  filter?: BiquadFilterType;
  from: number; // filter frequency sweep
  to?: number;
  q?: number;
  gain?: number;
  at?: number;
  attack?: number;
  wet?: boolean;
}

function noise({ dur, filter = "bandpass", from, to, q = 1, gain = 0.3, at = 0, attack = 0.01, wet }: NoiseOpts) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  if (wet && reverb) g.connect(reverb);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/* ─── the sound set ─────────────────────────────────────────────────── */

export const sfx = {
  timerStart(at = 0) {
    tone({ freq: 660, dur: 0.08, type: "square", gain: 0.12, at });
    tone({ freq: 990, dur: 0.12, type: "square", gain: 0.12, at: at + 0.08 });
  },
  timerPause(at = 0) {
    tone({ freq: 880, dur: 0.08, type: "square", gain: 0.11, at });
    tone({ freq: 440, dur: 0.14, type: "square", gain: 0.11, at: at + 0.08 });
  },
  pointUp(at = 0) {
    tone({ freq: 880, to: 1320, dur: 0.12, type: "triangle", gain: 0.25, at });
    tone({ freq: 1760, dur: 0.18, gain: 0.08, at: at + 0.05 });
  },
  pointDown(at = 0) {
    tone({ freq: 420, to: 220, dur: 0.18, type: "triangle", gain: 0.25, at });
  },
  shapeRemove(at = 0) {
    tone({ freq: 1400, to: 90, dur: 0.22, type: "sawtooth", gain: 0.12, at });
    noise({ dur: 0.18, from: 4000, to: 600, q: 2, gain: 0.18, at });
  },
  shapeGrey(at = 0) {
    tone({ freq: 320, to: 260, dur: 0.07, type: "triangle", gain: 0.2, at });
  },
  shapeRestore(at = 0) {
    tone({ freq: 500, to: 1000, dur: 0.12, type: "triangle", gain: 0.16, at });
  },
  gridTick(at = 0) {
    tone({ freq: 1600, dur: 0.035, type: "square", gain: 0.06, at });
  },
  keyTick(at = 0) {
    tone({ freq: 2200, dur: 0.02, type: "square", gain: 0.035, at });
  },
  newMatch(at = 0) {
    [1320, 990, 660].forEach((f, i) => tone({ freq: f, dur: 0.1, type: "square", gain: 0.09, at: at + i * 0.07 }));
  },

  /** Scan-bar wipe: a filtered-noise sweep that rides the bar, plus a riser. */
  whoosh(dur = 0.82, at = 0) {
    noise({ dur, from: 250, to: 6000, q: 3, gain: 0.32, attack: dur * 0.45, at });
    noise({ dur: dur * 0.9, filter: "highpass", from: 3000, to: 9000, gain: 0.06, attack: dur * 0.5, at });
    tone({ freq: 140, to: 620, dur, type: "sawtooth", gain: 0.05, attack: dur * 0.5, at });
  },

  /** PINNED: a heavy metallic clamp. */
  pin(at = 0) {
    tone({ freq: 180, to: 90, dur: 0.35, type: "square", gain: 0.22, attack: 0.002, at, wet: true });
    noise({ dur: 0.12, filter: "highpass", from: 2500, gain: 0.25, attack: 0.002, at });
    tone({ freq: 1250, dur: 0.5, type: "triangle", gain: 0.06, at: at + 0.02, wet: true });
  },
  unpin(at = 0) {
    tone({ freq: 300, to: 700, dur: 0.15, type: "triangle", gain: 0.14, at });
  },

  /** Diving into a match card: rising sweep + bright lock-on. */
  zoomIn(at = 0) {
    noise({ dur: 0.7, from: 300, to: 7000, q: 2, gain: 0.3, attack: 0.55, at });
    tone({ freq: 110, to: 880, dur: 0.7, type: "sawtooth", gain: 0.07, attack: 0.5, at });
    tone({ freq: 1760, dur: 0.25, type: "triangle", gain: 0.12, at: at + 0.68, wet: true });
  },
  /** Pulling back out to the match list. */
  zoomOut(at = 0) {
    noise({ dur: 0.7, from: 6000, to: 250, q: 2, gain: 0.26, attack: 0.08, at });
    tone({ freq: 880, to: 110, dur: 0.7, type: "sawtooth", gain: 0.06, attack: 0.05, at });
  },

  /** Lines drawing: an electric scribble made of fast filtered grains. */
  scribble(dur = 1.4, at = 0) {
    const n = Math.floor(dur / 0.045);
    for (let i = 0; i < n; i++) {
      noise({ dur: 0.03, from: 2500 + Math.random() * 3500, q: 8, gain: 0.05 + Math.random() * 0.04, at: at + i * 0.045 });
    }
    tone({ freq: 60, dur, type: "sawtooth", gain: 0.025, attack: 0.2, at });
  },

  /** Numbers counting up: ticks that rise in pitch, ending on a lock-in blip. */
  countTicks(dur = 0.8, at = 0) {
    const n = Math.floor(dur / 0.05);
    for (let i = 0; i < n; i++) tone({ freq: 900 + (i / n) * 900, dur: 0.025, type: "square", gain: 0.05, at: at + i * 0.05 });
    tone({ freq: 1800, dur: 0.12, type: "triangle", gain: 0.12, at: at + dur });
  },

  /** Decoder chatter under the caption. */
  decode(dur = 0.95, at = 0) {
    const n = Math.floor(dur / 0.035);
    for (let i = 0; i < n; i++) tone({ freq: 400 + Math.random() * 2400, dur: 0.025, type: "square", gain: 0.045, at: at + i * 0.035 });
  },

  /** The big one: sub drop + blast + punch + rumble tail. */
  slam(at = 0) {
    tone({ freq: 140, to: 32, dur: 1.4, type: "sine", gain: 0.95, attack: 0.004, at, wet: true });
    tone({ freq: 70, to: 40, dur: 0.5, type: "square", gain: 0.25, attack: 0.002, at });
    noise({ dur: 0.6, filter: "lowpass", from: 5000, to: 180, gain: 0.6, attack: 0.002, at, wet: true });
    noise({ dur: 1.8, filter: "lowpass", from: 400, to: 60, gain: 0.25, attack: 0.05, at: at + 0.05, wet: true });
    // pre-hit suck-in riser
    noise({ dur: 0.35, from: 800, to: 5000, q: 2, gain: 0.18, attack: 0.3, at: at - 0.35 });
  },

  /** Shockwave ring: a bright metallic shimmer after the slam. */
  shimmer(at = 0) {
    [1046, 1568, 2093, 3136].forEach((f, i) => tone({ freq: f, dur: 1.2, gain: 0.05, at: at + i * 0.03, wet: true }));
  },

  /** +N badge on the leaderboard. */
  gain(at = 0) {
    [880, 1109, 1320, 1760].forEach((f, i) => tone({ freq: f, dur: 0.35, type: "triangle", gain: 0.12, at: at + i * 0.06, wet: true }));
  },
  rowSlide(at = 0) {
    noise({ dur: 0.9, from: 400, to: 2500, q: 2, gain: 0.16, attack: 0.4, at });
  },
  rankUp(at = 0) {
    [1320, 1760, 2637].forEach((f, i) => tone({ freq: f, dur: 0.4, gain: 0.1, at: at + i * 0.08, wet: true }));
  },
  rankDown(at = 0) {
    tone({ freq: 330, to: 196, dur: 0.4, type: "triangle", gain: 0.12, at });
  },
};

/* ─── mute ──────────────────────────────────────────────────────────── */

export const isMuted = () => muted;

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {}
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : MASTER, ctx.currentTime, 0.02);
  listeners.forEach((l) => l(m));
}

export function onMuteChange(l: (m: boolean) => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}
