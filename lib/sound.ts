/**
 * Motore audio procedurale di Magòga (Web Audio API, zero file).
 * Stessa architettura della Scopa: AudioContext lazy, unlock al primo gesto, mute in localStorage,
 * compressore sul master, riverbero generato. In più: ambienti vivi (laguna, nebbia, colli, montagna)
 * e un gabbiano sintetizzato.
 */
import type { KindSound } from './tiles';

export type Ambient = 'water' | 'fog' | 'hills' | 'mountain';

const MUTE_KEY = 'magoga.muted';
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const PENTA = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface ToneOpts {
  freq: number;
  t: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  attack?: number;
  glideTo?: number;
  glideTime?: number;
  detune?: number;
  send?: number;
  pan?: number;
  dest?: AudioNode;
}
interface NoiseOpts {
  t: number;
  dur: number;
  gain: number;
  type?: BiquadFilterType;
  from: number;
  to?: number;
  q?: number;
  attack?: number;
  send?: number;
  pan?: number;
  dest?: AudioNode;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bus!: GainNode;
  private ambBus!: GainNode;
  private verb!: ConvolverNode;
  private noise!: AudioBuffer;
  private listeners = new Set<() => void>();
  private unlockAttached = false;
  private ambient: Ambient | null = null;
  private ambToken = 0;
  private ambNodes: AudioScheduledSourceNode[] = [];
  private ambTimers: ReturnType<typeof setTimeout>[] = [];
  muted = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.muted = localStorage.getItem(MUTE_KEY) === '1';
      } catch {}
    }
  }

  /* ---------------- mute ---------------- */
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getMuted = () => this.muted;
  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {}
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.08);
    if (!m) {
      this.ensure();
      if (this.ambient && !this.ambNodes.length) this.startAmbient(this.ambient);
    }
    this.listeners.forEach((l) => l());
  }
  toggleMute() {
    this.setMuted(!this.muted);
  }

  /* ---------------- context ---------------- */
  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC({ latencyHint: 'interactive' });
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 14;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.25;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      comp.connect(this.master).connect(ctx.destination);

      const soft = ctx.createBiquadFilter();
      soft.type = 'lowpass';
      soft.frequency.value = 10000;
      this.bus = ctx.createGain();
      this.bus.connect(soft).connect(comp);

      this.ambBus = ctx.createGain();
      this.ambBus.gain.value = 0;
      this.ambBus.connect(comp);

      this.verb = ctx.createConvolver();
      this.verb.buffer = this.makeImpulse(ctx, 2.6, 2.6);
      const ret = ctx.createGain();
      ret.gain.value = 0.6;
      this.verb.connect(ret).connect(comp);

      const len = ctx.sampleRate * 3;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private makeImpulse(ctx: AudioContext, seconds: number, decay: number) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp = lp * 0.55 + (Math.random() * 2 - 1) * 0.45;
        data[i] = lp * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  attachUnlock() {
    if (this.unlockAttached || typeof window === 'undefined') return;
    this.unlockAttached = true;
    const unlock = () => {
      const ctx = this.ensure();
      if (!ctx) return;
      const b = ctx.createBufferSource();
      b.buffer = ctx.createBuffer(1, 1, 22050);
      b.connect(ctx.destination);
      b.start(0);
      if (this.ambient && !this.ambNodes.length) this.startAmbient(this.ambient);
    };
    const opts = { capture: true, passive: true } as AddEventListenerOptions;
    window.addEventListener('pointerdown', unlock, opts);
    window.addEventListener('touchend', unlock, opts);
    window.addEventListener('keydown', unlock, opts);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else this.ctx.resume().catch(() => {});
    });
  }

  private live(): AudioContext | null {
    if (this.muted || !this.ctx) return null;
    const state: string = this.ctx.state;
    if (state !== 'running') {
      this.ctx.resume().catch(() => {});
      return null;
    }
    return this.ctx;
  }

  /* ---------------- primitive ---------------- */
  private out(ctx: AudioContext, node: AudioNode, send = 0, pan = 0, dest?: AudioNode) {
    let last: AudioNode = node;
    if (pan && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p);
      last = p;
    }
    last.connect(dest ?? this.bus);
    if (send > 0) {
      const s = ctx.createGain();
      s.gain.value = send;
      last.connect(s).connect(this.verb);
    }
  }

  private tone(ctx: AudioContext, o: ToneOpts) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, o.t);
    if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, o.t + (o.glideTime ?? o.dur * 0.6));
    if (o.detune) osc.detune.value = o.detune;
    const a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.linearRampToValueAtTime(o.gain, o.t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    osc.connect(g);
    this.out(ctx, g, o.send, o.pan, o.dest);
    osc.start(o.t);
    osc.stop(o.t + o.dur + 0.05);
  }

  private noiseBurst(ctx: AudioContext, o: NoiseOpts) {
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.Q.value = o.q ?? 1.2;
    f.frequency.setValueAtTime(o.from, o.t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, o.t + o.dur);
    const g = ctx.createGain();
    const a = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.linearRampToValueAtTime(o.gain, o.t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    src.connect(f).connect(g);
    this.out(ctx, g, o.send, o.pan, o.dest);
    src.start(o.t, Math.random() * 2);
    src.stop(o.t + o.dur + 0.05);
  }

  private bell(ctx: AudioContext, freq: number, t: number, dur: number, gain: number, send = 0.4, pan = 0, ratio = 3.5, dest?: AudioNode) {
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    const g = ctx.createGain();
    car.frequency.value = freq;
    mod.frequency.value = freq * ratio;
    mg.gain.setValueAtTime(freq * 1.6, t);
    mg.gain.exponentialRampToValueAtTime(freq * 0.04, t + dur * 0.6);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g);
    this.out(ctx, g, send, pan, dest);
    car.start(t);
    mod.start(t);
    car.stop(t + dur + 0.05);
    mod.stop(t + dur + 0.05);
  }

  /** Colpo di bambù: la voce delle tessere */
  private knock(ctx: AudioContext, t: number, f: number, gain: number, pan = 0) {
    this.tone(ctx, { freq: f, glideTo: f * 0.92, t, dur: 0.1, gain, pan, send: 0.08 });
    this.tone(ctx, { freq: f * 2.31, t, dur: 0.04, gain: gain * 0.25, type: 'triangle', pan });
    this.noiseBurst(ctx, { t, dur: 0.018, gain: gain * 0.35, from: 3200, q: 2, pan });
  }

  private plip(ctx: AudioContext, t: number, gain: number, pan = 0, dest?: AudioNode) {
    const f = rand(420, 560);
    this.tone(ctx, { freq: f, glideTo: f * 2.6, glideTime: 0.06, t, dur: 0.1, gain, pan, send: 0.35, dest });
  }

  /** Tintinnio di bicchiere: parziali inarmoniche di un calice */
  private clink(ctx: AudioContext, t: number, gain: number, pan: number, k = 1) {
    [1, 2.76, 5.4].forEach((r, i) =>
      this.tone(ctx, { freq: Math.min(16000, 2350 * k * r), t, dur: 1.4 / (i + 1), gain: gain / (i + 1.4), pan, send: 0.35 }),
    );
    this.noiseBurst(ctx, { t, dur: 0.012, gain: gain * 0.6, type: 'highpass', from: 5000, pan });
  }

  /* ---------------- gabbiano ---------------- */
  private gullCall(ctx: AudioContext, t: number, len: number, pitch: number, gain: number, send: number, pan: number, dest?: AudioNode) {
    const sum = ctx.createGain();
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.02);
    env.gain.setValueAtTime(gain, t + len * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = 1750 * pitch;
    f1.Q.value = 3;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 3100 * pitch;
    f2.Q.value = 4;
    sum.connect(f1).connect(env);
    sum.connect(f2).connect(env);
    this.out(ctx, env, send, pan, dest);

    const vib = ctx.createOscillator();
    const vibG = ctx.createGain();
    vib.frequency.value = 27;
    vibG.gain.value = 38 * pitch;
    vib.connect(vibG);
    (['sawtooth', 'square'] as OscillatorType[]).forEach((type, i) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = i ? 14 : 0;
      o.frequency.setValueAtTime(820 * pitch, t);
      o.frequency.exponentialRampToValueAtTime(1380 * pitch, t + len * 0.25);
      o.frequency.exponentialRampToValueAtTime(640 * pitch, t + len);
      vibG.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.value = i ? 0.35 : 0.6;
      o.connect(g).connect(sum);
      o.start(t);
      o.stop(t + len + 0.05);
    });
    vib.start(t);
    vib.stop(t + len + 0.05);
    this.noiseBurst(ctx, { t, dur: len, gain: gain * 0.18, from: 2600 * pitch, q: 2, attack: 0.02, send, pan, dest });
  }

  /** Il verso del Magòga: un grido lungo e la sua "risata" */
  magoga() {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.gullCall(ctx, t, 0.5, 1, 0.34, 0.3, 0.1);
    [0.96, 0.92, 0.88, 0.84, 0.8].forEach((p, i) => this.gullCall(ctx, t + 0.62 + i * 0.17, 0.13, p, 0.26, 0.28, 0.1 - i * 0.04));
  }

  /** Battito d'ali */
  wings(count = 6, gap = 0.16) {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < count; i++) {
      this.noiseBurst(ctx, { t: t + i * gap, dur: 0.14, gain: 0.12, type: 'lowpass', from: 900, to: 300, q: 0.7, attack: 0.04, send: 0.1 });
    }
  }

  /* ---------------- UI e tessere ---------------- */
  click() {
    const ctx = this.live();
    if (!ctx) return;
    this.tone(ctx, { freq: 1100, glideTo: 680, glideTime: 0.05, t: ctx.currentTime, dur: 0.08, gain: 0.13 });
  }

  select() {
    const ctx = this.live();
    if (!ctx) return;
    this.knock(ctx, ctx.currentTime, rand(600, 680), 0.28);
  }

  deselect() {
    const ctx = this.live();
    if (!ctx) return;
    this.knock(ctx, ctx.currentTime, 440, 0.2);
  }

  /** Tessera bloccata: un "tunk" ovattato, mai fastidioso */
  blocked() {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(ctx, { freq: 190, glideTo: 150, t, dur: 0.12, gain: 0.22 });
    this.noiseBurst(ctx, { t, dur: 0.05, gain: 0.05, type: 'lowpass', from: 600 });
  }

  /** Abbinamento: tap-tap + campanella pentatonica che sale col combo + carattere del soggetto */
  match(kind: KindSound, combo: number) {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.knock(ctx, t, 640, 0.22, -0.2);
    this.knock(ctx, t + 0.05, 700, 0.22, 0.2);
    const n = Math.min(combo, PENTA.length - 3);
    this.bell(ctx, midi(PENTA[n] + 12), t + 0.09, 0.9, 0.07, 0.35, 0, 2.01);
    this.bell(ctx, midi(PENTA[n + 2] + 12), t + 0.17, 1.1, 0.06, 0.4, 0, 2.01);

    const s = t + 0.12;
    switch (kind) {
      case 'fizz': {
        // cin cin + bollicine
        this.clink(ctx, s, 0.13, -0.15);
        this.clink(ctx, s + 0.07, 0.1, 0.15, 1.08);
        for (let i = 0; i < 18; i++) {
          const f = rand(2200, 5200);
          this.tone(ctx, { freq: f, glideTo: f * 1.3, t: s + 0.1 + rand(0, 0.8), dur: 0.03, gain: rand(0.01, 0.025), pan: rand(-0.5, 0.5) });
        }
        break;
      }
      case 'glass':
        this.clink(ctx, s, 0.14, 0);
        break;
      case 'oar':
        this.noiseBurst(ctx, { t: s, dur: 0.4, gain: 0.1, from: 1300, to: 380, q: 0.8, attack: 0.08, send: 0.3 });
        this.plip(ctx, s + 0.25, 0.08);
        break;
      case 'boat':
        this.noiseBurst(ctx, { t: s, dur: 0.6, gain: 0.08, type: 'lowpass', from: 900, to: 400, q: 0.6, attack: 0.2, send: 0.3 });
        this.plip(ctx, s + 0.3, 0.07, -0.3);
        this.plip(ctx, s + 0.42, 0.05, 0.3);
        break;
      case 'horn': {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 900;
        this.out(ctx, f, 0.45);
        this.tone(ctx, { freq: 196, t: s, dur: 0.55, gain: 0.08, type: 'sawtooth', attack: 0.06, dest: f });
        this.tone(ctx, { freq: 247, t: s, dur: 0.55, gain: 0.06, type: 'sawtooth', attack: 0.06, dest: f });
        break;
      }
      case 'bell':
        this.bell(ctx, midi(67), s, 2.2, 0.09, 0.6, 0, 1.4);
        break;
      case 'bird':
        [0, 0.09, 0.2].forEach((d, i) => this.tone(ctx, { freq: 2600 + i * 200, glideTo: 3900, glideTime: 0.05, t: s + d, dur: 0.07, gain: 0.05, send: 0.3, pan: 0.2 }));
        break;
      case 'sparkle':
        [91, 96, 100, 103].forEach((m, i) => this.bell(ctx, midi(m), s + i * 0.05, 0.6, 0.035, 0.6, (i - 1.5) * 0.3, 2.01));
        break;
      case 'gull':
        this.gullCall(ctx, s, 0.22, 1.1, 0.09, 0.4, 0.3);
        break;
      case 'crab':
        this.noiseBurst(ctx, { t: s, dur: 0.02, gain: 0.12, type: 'highpass', from: 2500 });
        this.noiseBurst(ctx, { t: s + 0.09, dur: 0.02, gain: 0.12, type: 'highpass', from: 2800 });
        break;
      case 'water':
        this.plip(ctx, s, 0.08, -0.2);
        this.plip(ctx, s + 0.13, 0.06, 0.25);
        break;
      default:
        this.plip(ctx, s + 0.05, 0.05);
    }
  }

  /** Colpo da maestro: 5 abbinamenti di fila, festa di coriandoli */
  confetti() {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    // piccoli "pop" di cannoncini
    [0, 0.12, 0.2].forEach((d, i) => {
      this.noiseBurst(ctx, { t: t + d, dur: 0.12, gain: 0.16, from: 1800, to: 600, q: 0.9, pan: (i - 1) * 0.6, send: 0.3 });
      this.tone(ctx, { freq: 180, glideTo: 90, t: t + d, dur: 0.12, gain: 0.18, pan: (i - 1) * 0.6 });
    });
    // arpeggio festoso che sale
    [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => this.bell(ctx, midi(m), t + 0.15 + i * 0.07, 1.1, 0.07, 0.45, (i - 3) * 0.2, 2.01));
    [60, 64, 67, 72].forEach((m) => this.tone(ctx, { freq: midi(m), t: t + 0.15, dur: 1.8, gain: 0.045, attack: 0.08, type: 'triangle', send: 0.45 }));
    // fruscio di carta che cade
    for (let i = 0; i < 22; i++) {
      this.noiseBurst(ctx, { t: t + 0.4 + rand(0, 1.4), dur: 0.04, gain: rand(0.01, 0.03), from: rand(3500, 7500), q: 2.5, pan: rand(-0.9, 0.9) });
    }
  }

  /** Sfida: tempo recuperato (più alto se il guadagno è grande) */
  timeGain(seconds: number) {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    const up = Math.min(5, Math.round(seconds));
    this.tone(ctx, { freq: midi(84 + up), glideTo: midi(91 + up), glideTime: 0.08, t: t + 0.2, dur: 0.18, gain: 0.05, send: 0.3 });
  }

  /** Sfida: tic d'allarme negli ultimi secondi, morbido */
  timeWarn(last: boolean) {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.knock(ctx, t, last ? 900 : 760, 0.12);
  }

  /** Sfida: tempo scaduto. Il magòga se la ride */
  timeout() {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    [76, 72, 69, 64].forEach((m, i) => this.tone(ctx, { freq: midi(m), t: t + i * 0.18, dur: i === 3 ? 0.7 : 0.22, gain: 0.12, type: 'triangle', send: 0.3 }));
    [0.9, 0.86, 0.82, 0.78].forEach((p, i) => this.gullCall(ctx, t + 0.9 + i * 0.16, 0.12, p, 0.2, 0.3, 0));
  }

  hint() {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.bell(ctx, midi(88), t, 0.8, 0.05, 0.5, -0.3, 2.01);
    this.bell(ctx, midi(91), t + 0.12, 1, 0.05, 0.5, 0.3, 2.01);
  }

  shuffle() {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 14; i++) this.knock(ctx, t + i * 0.045 + rand(0, 0.02), rand(520, 760), 0.1, rand(-0.6, 0.6));
    this.noiseBurst(ctx, { t, dur: 0.7, gain: 0.05, from: 1500, to: 3500, q: 0.8, attack: 0.3 });
  }

  undo() {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noiseBurst(ctx, { t, dur: 0.22, gain: 0.08, from: 3800, to: 900, q: 0.9, attack: 0.03 });
    this.knock(ctx, t + 0.16, 520, 0.18);
    this.knock(ctx, t + 0.21, 520, 0.18);
  }

  /** Posa delle tessere a inizio livello: pioggerella di bambù */
  deal(count: number, seconds: number) {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    const n = Math.min(28, Math.ceil(count / 3));
    for (let i = 0; i < n; i++) this.knock(ctx, t + (i / n) * seconds + rand(0, 0.03), rand(560, 820), 0.06, rand(-0.6, 0.6));
  }

  /** Livello completato: arpeggio sereno sopra un pad */
  levelComplete() {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    [72, 76, 79, 84, 88].forEach((m, i) => this.bell(ctx, midi(m), t + i * 0.13, 1.6, 0.07, 0.5, (i - 2) * 0.2, 2.01));
    [60, 64, 67, 71].forEach((m) => this.tone(ctx, { freq: midi(m), t, dur: 2.6, gain: 0.04, attack: 0.4, type: 'triangle', send: 0.5 }));
  }

  /* ---------------- ambienti ---------------- */
  setAmbient(a: Ambient) {
    if (this.ambient === a && this.ambNodes.length) return;
    this.ambient = a;
    const ctx = this.ctx;
    if (!ctx) return;
    const state: string = ctx.state;
    if (state === 'running') this.startAmbient(a);
    else
      ctx
        .resume()
        .then(() => {
          if (this.ambient === a && !this.ambNodes.length) this.startAmbient(a);
        })
        .catch(() => {});
  }

  stopAmbient() {
    this.ambient = null;
    this.clearAmbient();
  }

  private clearAmbient() {
    this.ambToken++;
    this.ambTimers.forEach(clearTimeout);
    this.ambTimers = [];
    const ctx = this.ctx;
    const nodes = this.ambNodes;
    this.ambNodes = [];
    if (ctx) {
      this.ambBus.gain.cancelScheduledValues(ctx.currentTime);
      this.ambBus.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      nodes.forEach((n) => {
        try {
          n.stop(ctx.currentTime + 2);
        } catch {}
      });
    }
  }

  private startAmbient(a: Ambient) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.clearAmbient();
    const token = this.ambToken;
    const bus = ctx.createGain();
    bus.connect(this.ambBus);
    this.ambBus.gain.setTargetAtTime(0.5, ctx.currentTime + 0.8, 1.5);

    const loop = (type: BiquadFilterType, freq: number, q: number, gain: number, lfoHz: number, lfoDepth: number, filterLfo = 0) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = lfoHz;
      const lg = ctx.createGain();
      lg.gain.value = lfoDepth;
      lfo.connect(lg).connect(g.gain);
      if (filterLfo) {
        const fg = ctx.createGain();
        fg.gain.value = filterLfo;
        lfo.connect(fg).connect(f.frequency);
      }
      src.connect(f).connect(g).connect(bus);
      src.start();
      lfo.start();
      this.ambNodes.push(src, lfo);
    };

    const every = (min: number, max: number, fn: (c: AudioContext) => void, first = min) => {
      const run = (delay: number) => {
        const id = setTimeout(() => {
          if (token !== this.ambToken) return;
          const c = this.live();
          if (c) fn(c);
          run(rand(min, max));
        }, delay * 1000);
        this.ambTimers.push(id);
      };
      run(first);
    };

    const lap = (c: AudioContext) => {
      const t = c.currentTime;
      this.noiseBurst(c, { t, dur: rand(0.7, 1.3), gain: rand(0.05, 0.1), from: rand(500, 800), to: rand(250, 400), q: 0.9, attack: rand(0.25, 0.45), pan: rand(-0.7, 0.7), dest: bus });
      if (Math.random() < 0.35) this.plip(c, t + rand(0.3, 0.8), 0.025, rand(-0.8, 0.8), bus);
    };
    const farGull = (c: AudioContext) => {
      const t = c.currentTime;
      const p = rand(0.9, 1.1);
      const pan = rand(-0.9, 0.9);
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.gullCall(c, t + i * 0.3, i ? 0.18 : 0.38, p - i * 0.04, 0.05, 0.9, pan, bus);
    };
    const vaporetto = (c: AudioContext) => {
      const t = c.currentTime;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 520;
      const g = c.createGain();
      g.gain.value = 0.6;
      f.connect(g);
      this.out(c, g, 0.9, rand(-0.6, 0.6), bus);
      [110, 138.6].forEach((fr) => this.tone(c, { freq: fr, t, dur: 2.4, gain: 0.07, type: 'sawtooth', attack: 0.5, dest: f }));
      this.noiseBurst(c, { t: t + 0.4, dur: 6, gain: 0.03, type: 'lowpass', from: 160, q: 0.5, attack: 2, dest: bus });
    };
    const churchBell = (c: AudioContext) => {
      const t = c.currentTime;
      for (let i = 0; i < 3; i++) this.bell(c, 196, t + i * 2.2, 4.5, 0.05, 0.9, -0.3, 1.4, bus);
    };
    const bird = (c: AudioContext) => {
      const t = c.currentTime;
      const base = rand(2800, 4200);
      const pan = rand(-0.8, 0.8);
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++)
        this.tone(c, { freq: base, glideTo: base * rand(1.1, 1.4), t: t + i * rand(0.08, 0.14), dur: 0.06, gain: 0.018, pan, send: 0.5, dest: bus });
    };
    const cowbell = (c: AudioContext) => {
      const t = c.currentTime;
      const pan = rand(-0.7, 0.7);
      for (let i = 0; i < 3; i++) this.bell(c, rand(560, 640), t + i * rand(0.35, 0.6), 0.7, 0.02, 0.8, pan, 2.4, bus);
    };

    if (a === 'water' || a === 'fog') {
      loop('lowpass', 420, 0.6, 0.09, 0.09, 0.05);
      loop('bandpass', 1100, 0.7, 0.025, 0.17, 0.018, 250);
      every(1.4, 3.8, lap, 0.8);
      every(22, 45, farGull, 6);
      every(50, 90, vaporetto, 18);
      if (a === 'fog') every(40, 70, churchBell, 10);
    } else if (a === 'hills') {
      loop('bandpass', 700, 0.5, 0.035, 0.07, 0.025, 300);
      every(3, 8, bird, 1.5);
      every(35, 70, farGull, 25);
    } else {
      loop('bandpass', 900, 0.6, 0.05, 0.05, 0.035, 600);
      loop('lowpass', 250, 0.5, 0.04, 0.03, 0.02);
      every(12, 26, cowbell, 5);
      every(6, 14, bird, 8);
    }
  }
}

export const sound = new SoundEngine();
