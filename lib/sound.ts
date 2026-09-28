/**
 * Motore audio di Magòga, ottimizzato per mobile.
 *
 * Prima ogni suono creava da 15 a 100+ nodi Web Audio nel momento del tocco (oscillatori, filtri,
 * pan, riverbero), sul thread principale e proprio mentre React e le animazioni lavoravano.
 * Ora tutti i suoni vengono sintetizzati UNA volta sola in background su un OfflineAudioContext
 * (vedi recipes.ts e bake.ts) e diventano AudioBuffer. Durante la partita ogni suono è un solo
 * AudioBufferSourceNode: costo quasi nullo sia sul thread principale sia su quello audio.
 *
 * Restano vivi solo due strati di rumore filtrato per l'atmosfera (economici, senza riverbero).
 */
import type { KindSound } from './tiles';
import { bakeRecipe, bakingSupported } from './bake';
import { RECIPES } from './recipes';
import { rand } from './synth';

export type Ambient = 'water' | 'fog' | 'hills' | 'mountain';

const MUTE_KEY = 'magoga.muted';
const MAX_VOICES = 14; // oltre questa soglia i suoni non essenziali vengono saltati

interface PlayOpts {
  delay?: number;
  rate?: number;
  gain?: number;
  dest?: AudioNode;
  /** ignora se lo stesso suono è partito da meno di questi ms (anti "mitragliatrice") */
  minGap?: number;
  /** non viene mai scartato dal limite di voci */
  essential?: boolean;
  /** taglia il suono dopo questi secondi */
  maxDur?: number;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private noise!: AudioBuffer;
  private listeners = new Set<() => void>();
  private unlockAttached = false;

  private buffers = new Map<string, AudioBuffer>();
  private bakeStarted = false;
  private bakeMs = 0;
  private voices = 0;
  private lastPlay = new Map<string, number>();

  private ambient: Ambient | null = null;
  private ambToken = 0;
  private ambSession: GainNode | null = null;
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
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.06);
    if (m) {
      this.clearAmbient(); // da muto non serve far girare l'atmosfera
    } else {
      this.ensure();
      if (this.ambient) this.startAmbient(this.ambient);
    }
    this.listeners.forEach((l) => l());
  }
  toggleMute() {
    this.setMuted(!this.muted);
  }

  /* ---------------- preparazione dei buffer ---------------- */
  /** Da chiamare all'avvio: sintetizza i suoni in background, i più importanti per primi */
  prepare() {
    if (this.bakeStarted || typeof window === 'undefined' || !bakingSupported()) return;
    this.bakeStarted = true;
    // cede il thread principale per un attimo tra un suono e l'altro (la sintesi vera gira su un altro thread)
    const breathe = () => new Promise<void>((res) => setTimeout(res, 6));
    const queue = RECIPES.slice().sort((a, b) => a.prio - b.prio); // prima i suoni delle tessere
    const worker = async () => {
      while (queue.length) {
        const r = queue.shift()!;
        try {
          this.buffers.set(r.id, await bakeRecipe(r));
        } catch {
          /* un suono che non si genera viene semplicemente saltato */
        }
        await breathe();
      }
    };
    const t0 = performance.now();
    // due render alla volta: il thread di rendering non resta mai in attesa
    Promise.all([worker(), worker()]).then(() => {
      this.bakeMs = performance.now() - t0;
    });
  }

  stats() {
    let bytes = 0;
    let seconds = 0;
    this.buffers.forEach((b) => {
      bytes += b.length * b.numberOfChannels * 4;
      seconds += b.duration;
    });
    return { buffers: this.buffers.size, of: RECIPES.length, seconds, mb: bytes / 1048576, bakeMs: this.bakeMs };
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

      // catena minimale: bus -> limitatore morbido -> master. Niente compressore né riverbero live.
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        const a = Math.abs(x);
        curve[i] = Math.sign(x) * (a < 0.6 ? a : 0.6 + 0.4 * Math.tanh((a - 0.6) / 0.4));
      }
      shaper.curve = curve;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      shaper.connect(this.master).connect(ctx.destination);

      this.sfx = ctx.createGain();
      this.sfx.connect(shaper);
      this.amb = ctx.createGain();
      this.amb.gain.value = 0.5;
      this.amb.connect(shaper);

      const len = ctx.sampleRate * 3;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** Sblocca/riprende l'AudioContext al primo gesto e dopo le interruzioni (telefonate, cambio app) */
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
      if (this.ambient && !this.ambNodes.length && !this.muted) this.startAmbient(this.ambient);
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

  /* ---------------- riproduzione ---------------- */
  private play(id: string, o: PlayOpts = {}) {
    const ctx = this.live();
    if (!ctx) return;
    const buf = this.buffers.get(id);
    if (!buf) return; // non ancora pronto: meglio nessun suono che un ritardo
    if (o.minGap) {
      const now = performance.now();
      if (now - (this.lastPlay.get(id) ?? -1e9) < o.minGap) return;
      this.lastPlay.set(id, now);
    }
    if (this.voices >= MAX_VOICES && !o.essential) return;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (o.rate && o.rate !== 1) src.playbackRate.value = o.rate;
    let tail: AudioNode = src;
    if (o.gain && o.gain !== 1) {
      const g = ctx.createGain();
      g.gain.value = o.gain;
      src.connect(g);
      tail = g;
    }
    tail.connect(o.dest ?? this.sfx);
    this.voices++;
    src.onended = () => {
      this.voices--;
      try {
        src.disconnect();
        tail.disconnect();
      } catch {}
    };
    const at = ctx.currentTime + (o.delay ?? 0);
    src.start(at);
    if (o.maxDur) src.stop(at + o.maxDur);
  }

  /* ---------------- suoni di gioco (stessa API di prima) ---------------- */
  click() {
    this.play('click', { minGap: 30 });
  }
  select() {
    this.play('select', { rate: rand(0.94, 1.1), minGap: 30 });
  }
  deselect() {
    this.play('deselect', { rate: rand(0.96, 1.04), minGap: 30 });
  }
  blocked() {
    this.play('blocked', { minGap: 70 });
  }

  /** Abbinamento: colpi di bambù + campanelle (salgono con la serie) + carattere del soggetto */
  match(kind: KindSound, combo: number) {
    this.play(`match${Math.max(0, Math.min(8, combo))}`, { essential: true });
    this.play(`kind_${kind}`, { delay: 0.12, essential: true });
  }

  hint() {
    this.play('hint');
  }
  shuffle() {
    this.play('shuffle', { essential: true });
  }
  undo() {
    this.play('undo');
  }

  /** Posa delle tessere a inizio livello */
  deal(count: number, _seconds?: number) {
    const n = Math.min(28, Math.ceil(count / 3));
    this.play(n <= 7 ? 'dealS' : n <= 16 ? 'dealM' : 'dealL', { delay: 0.05, essential: true });
  }

  levelComplete() {
    this.play('levelComplete', { essential: true });
  }
  confetti() {
    this.play('confetti', { essential: true });
  }
  timeGain(seconds: number) {
    const up = Math.min(5, Math.round(seconds));
    this.play('timeGain', { delay: 0.2, rate: Math.pow(2, up / 12) });
  }
  timeWarn(last: boolean) {
    this.play(last ? 'timeWarn1' : 'timeWarn0', { minGap: 200 });
  }
  timeout() {
    this.play('timeout', { essential: true });
  }
  magoga() {
    this.play('magoga', { essential: true, minGap: 400 });
  }
  wings(count = 6, gap = 0.16) {
    this.play('wings', { maxDur: count * gap + 0.25, essential: true });
  }

  /* ---------------- atmosfera ---------------- */
  setAmbient(a: Ambient) {
    if (this.ambient === a && this.ambNodes.length) return;
    this.ambient = a;
    if (this.muted || !this.ctx) return;
    const ctx = this.ctx;
    const state: string = ctx.state;
    if (state === 'running') this.startAmbient(a);
    else
      ctx
        .resume()
        .then(() => {
          if (this.ambient === a && !this.ambNodes.length && !this.muted) this.startAmbient(a);
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
    const session = this.ambSession;
    this.ambNodes = [];
    this.ambSession = null;
    if (ctx && session) {
      session.gain.cancelScheduledValues(ctx.currentTime);
      session.gain.setTargetAtTime(0, ctx.currentTime, 0.35);
      nodes.forEach((n) => {
        try {
          n.stop(ctx.currentTime + 2);
        } catch {}
      });
      // eventuali code di suoni ancora in riproduzione finiscono sul vecchio gain già a zero
      setTimeout(() => {
        try {
          session.disconnect();
        } catch {}
      }, 12000);
    }
  }

  private startAmbient(a: Ambient) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.clearAmbient();
    const token = this.ambToken;
    const session = ctx.createGain();
    session.gain.value = 0;
    session.connect(this.amb);
    session.gain.setTargetAtTime(1, ctx.currentTime + 0.5, 1.2);
    this.ambSession = session;

    // dispositivi modesti: un solo strato di rumore e meno eventi
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lite = (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory ?? 8) <= 3;

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
      src.connect(f).connect(g).connect(session);
      src.start();
      lfo.start();
      this.ambNodes.push(src, lfo);
    };

    const every = (min: number, max: number, fn: () => void, first = min) => {
      const run = (delay: number) => {
        const id = setTimeout(() => {
          if (token !== this.ambToken) return;
          if (!document.hidden && this.live()) fn();
          run(rand(min, max) * (lite ? 1.6 : 1));
        }, delay * 1000);
        this.ambTimers.push(id);
      };
      run(first);
    };
    const ev = (prefix: string, n: number, rate = 0.05) =>
      this.play(`${prefix}${Math.floor(Math.random() * n)}`, { dest: session, rate: 1 + rand(-rate, rate) });

    if (a === 'water' || a === 'fog') {
      loop('lowpass', 420, 0.6, 0.09, 0.09, 0.05);
      if (!lite) loop('bandpass', 1100, 0.7, 0.025, 0.17, 0.018, 250);
      every(1.6, 4.2, () => ev('amb_lap', 4), 0.8);
      every(22, 45, () => ev('amb_gull', 3), 6);
      every(50, 90, () => this.play('amb_vaporetto', { dest: session }), 18);
      if (a === 'fog') every(40, 70, () => this.play('amb_church', { dest: session }), 10);
    } else if (a === 'hills') {
      loop('bandpass', 700, 0.5, 0.035, 0.07, 0.025, 300);
      every(3, 8, () => ev('amb_bird', 4, 0.12), 1.5);
      every(35, 70, () => ev('amb_gull', 3), 25);
    } else {
      loop('bandpass', 900, 0.6, 0.05, 0.05, 0.035, 600);
      if (!lite) loop('lowpass', 250, 0.5, 0.04, 0.03, 0.02);
      every(12, 26, () => ev('amb_cow', 3), 5);
      every(6, 14, () => ev('amb_bird', 4, 0.12), 8);
    }
  }
}

export const sound = new SoundEngine();
