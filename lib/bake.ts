import { Synth } from './synth';
import type { Recipe } from './recipes';

export const BAKE_SR = 32000;

type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

function offlineCtor(): OfflineCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { OfflineAudioContext?: OfflineCtor; webkitOfflineAudioContext?: OfflineCtor };
  return w.OfflineAudioContext ?? w.webkitOfflineAudioContext ?? null;
}

export const bakingSupported = () => offlineCtor() !== null;

/* Dati grezzi condivisi tra tutti i render (generati una volta per sample rate) */
const irCache = new Map<number, [Float32Array, Float32Array]>();
const noiseCache = new Map<number, Float32Array>();

function impulse(sr: number): [Float32Array, Float32Array] {
  let ir = irCache.get(sr);
  if (!ir) {
    const len = Math.floor(sr * 1.8);
    ir = [new Float32Array(len), new Float32Array(len)];
    for (const ch of ir) {
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp = lp * 0.55 + (Math.random() * 2 - 1) * 0.45; // coda leggermente scura
        ch[i] = lp * Math.pow(1 - i / len, 2.6);
      }
    }
    irCache.set(sr, ir);
  }
  return ir;
}

function noiseData(sr: number): Float32Array {
  let n = noiseCache.get(sr);
  if (!n) {
    n = new Float32Array(sr * 3);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
    noiseCache.set(sr, n);
  }
  return n;
}

function render(oc: OfflineAudioContext): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    // Safari vecchi: niente Promise, solo l'evento oncomplete
    oc.oncomplete = (e) => resolve(e.renderedBuffer);
    try {
      const p = oc.startRendering() as Promise<AudioBuffer> | undefined;
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    } catch (err) {
      reject(err);
    }
  });
}

/** Esegue la ricetta su un OfflineAudioContext (thread di rendering separato) e ne ricava un buffer */
export async function bakeRecipe(r: Recipe): Promise<AudioBuffer> {
  const OC = offlineCtor();
  if (!OC) throw new Error('OfflineAudioContext non supportato');
  const sr = r.sr ?? BAKE_SR;
  const ch = r.ch ?? 2;
  const oc = new OC(ch, Math.ceil(r.dur * sr), sr);

  // compressore + lowpass "soft" cotti dentro al buffer: in gioco non servono più
  const comp = oc.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 14;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.25;
  comp.connect(oc.destination);
  const soft = oc.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = Math.min(10000, sr * 0.45);
  soft.connect(comp);
  const dry = oc.createGain();
  dry.connect(soft);

  // riverbero creato solo se la ricetta lo usa
  let verb: ConvolverNode | null = null;
  const getVerb = () => {
    if (!verb) {
      verb = oc.createConvolver();
      const [l, rr] = impulse(sr);
      const buf = oc.createBuffer(2, l.length, sr);
      buf.getChannelData(0).set(l);
      buf.getChannelData(1).set(rr);
      verb.buffer = buf;
      const ret = oc.createGain();
      ret.gain.value = 0.58;
      verb.connect(ret).connect(comp);
    }
    return verb;
  };

  const nd = noiseData(sr);
  const noise = oc.createBuffer(1, nd.length, sr);
  noise.getChannelData(0).set(nd);

  r.build(new Synth(oc, dry, getVerb, noise));
  const out = await render(oc);

  // dissolvenza finale di 25 ms: niente click quando il buffer finisce
  const n = Math.min(out.length, Math.floor(sr * 0.025));
  for (let c = 0; c < out.numberOfChannels; c++) {
    const d = out.getChannelData(c);
    for (let i = 0; i < n; i++) d[out.length - 1 - i] *= i / n;
  }
  return out;
}
