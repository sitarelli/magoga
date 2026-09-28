/**
 * Primitive di sintesi (oscillatori, rumore, campane FM, gabbiano...).
 * NON girano più durante il gioco: vengono eseguite UNA volta su un OfflineAudioContext
 * (vedi bake.ts) e il risultato diventa un AudioBuffer. In partita si riproduce solo il buffer.
 */

export const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** Pentatonica: impossibile stonare */
export const PENTA = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];

export interface ToneOpts {
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

export interface NoiseOpts {
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

export class Synth {
  private nyq: number;

  constructor(
    readonly ctx: BaseAudioContext,
    private dry: AudioNode,
    private getVerb: () => AudioNode,
    private noise: AudioBuffer,
  ) {
    this.nyq = ctx.sampleRate * 0.45;
  }

  /** Instrada un nodo verso il bus (con pan e mandata al riverbero opzionali) */
  out(node: AudioNode, send = 0, pan = 0, dest?: AudioNode) {
    let last: AudioNode = node;
    if (pan && typeof this.ctx.createStereoPanner === 'function') {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p);
      last = p;
    }
    last.connect(dest ?? this.dry);
    if (send > 0) {
      const s = this.ctx.createGain();
      s.gain.value = send;
      last.connect(s).connect(this.getVerb());
    }
  }

  tone(o: ToneOpts) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.min(o.freq, this.nyq), o.t);
    if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.min(o.glideTo, this.nyq), o.t + (o.glideTime ?? o.dur * 0.6));
    if (o.detune) osc.detune.value = o.detune;
    const a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.linearRampToValueAtTime(o.gain, o.t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    osc.connect(g);
    this.out(g, o.send, o.pan, o.dest);
    osc.start(o.t);
    osc.stop(o.t + o.dur + 0.05);
  }

  noiseBurst(o: NoiseOpts) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
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
    this.out(g, o.send, o.pan, o.dest);
    src.start(o.t, Math.random() * 2);
    src.stop(o.t + o.dur + 0.05);
  }

  /** Campanella FM: vetro/cristallo */
  bell(freq: number, t: number, dur: number, gain: number, send = 0.4, pan = 0, ratio = 3.5, dest?: AudioNode) {
    const ctx = this.ctx;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    const g = ctx.createGain();
    car.frequency.value = Math.min(freq, this.nyq);
    mod.frequency.value = Math.min(freq * ratio, this.nyq);
    mg.gain.setValueAtTime(freq * 1.6, t);
    mg.gain.exponentialRampToValueAtTime(freq * 0.04, t + dur * 0.6);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g);
    this.out(g, send, pan, dest);
    car.start(t);
    mod.start(t);
    car.stop(t + dur + 0.05);
    mod.stop(t + dur + 0.05);
  }

  /** Colpo di bambù: la voce delle tessere */
  knock(t: number, f: number, gain: number, pan = 0) {
    this.tone({ freq: f, glideTo: f * 0.92, t, dur: 0.1, gain, pan, send: 0.08 });
    this.tone({ freq: f * 2.31, t, dur: 0.04, gain: gain * 0.25, type: 'triangle', pan });
    this.noiseBurst({ t, dur: 0.018, gain: gain * 0.35, from: 3200, q: 2, pan });
  }

  plip(t: number, gain: number, pan = 0, dest?: AudioNode) {
    const f = rand(420, 560);
    this.tone({ freq: f, glideTo: f * 2.6, glideTime: 0.06, t, dur: 0.1, gain, pan, send: 0.35, dest });
  }

  /** Tintinnio di bicchiere: parziali inarmoniche di un calice */
  clink(t: number, gain: number, pan: number, k = 1) {
    [1, 2.76, 5.4].forEach((r, i) => this.tone({ freq: 2350 * k * r, t, dur: 1.4 / (i + 1), gain: gain / (i + 1.4), pan, send: 0.35 }));
    this.noiseBurst({ t, dur: 0.012, gain: gain * 0.6, type: 'highpass', from: 5000, pan });
  }

  /** Richiamo di gabbiano: dente di sega + quadra con vibrato, filtrati su due formanti */
  gullCall(t: number, len: number, pitch: number, gain: number, send: number, pan: number, dest?: AudioNode) {
    const ctx = this.ctx;
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
    this.out(env, send, pan, dest);

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
    this.noiseBurst({ t, dur: len, gain: gain * 0.18, from: 2600 * pitch, q: 2, attack: 0.02, send, pan, dest });
  }
}
