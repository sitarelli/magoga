import { PENTA, Synth, midi, rand } from './synth';

/**
 * Ogni suono del gioco è una "ricetta": viene renderizzata una volta sola in un AudioBuffer.
 * prio: 0 = interazione con le tessere (pronta per prima), 1 = jingle e feedback, 2 = ambienti.
 * Le ricette usano t=0 come inizio; il ritardo si decide alla riproduzione.
 */
export interface Recipe {
  id: string;
  dur: number;
  prio: 0 | 1 | 2;
  ch?: 1 | 2;
  /** sample rate del buffer: gli ambienti sono scuri, bastano 22 kHz */
  sr?: number;
  build: (s: Synth) => void;
}

export const KIND_IDS = ['oar', 'boat', 'horn', 'fizz', 'glass', 'bell', 'bird', 'gull', 'sparkle', 'crab', 'water', 'default'] as const;

const variants = (n: number) => Array.from({ length: n }, (_, i) => i);

export const RECIPES: Recipe[] = [
  /* ---------- UI e tessere (prio 0) ---------- */
  { id: 'click', prio: 0, ch: 1, dur: 0.14, build: (s) => s.tone({ freq: 1100, glideTo: 680, glideTime: 0.05, t: 0, dur: 0.08, gain: 0.13 }) },
  { id: 'select', prio: 0, ch: 1, dur: 0.18, build: (s) => s.knock(0, 640, 0.28) },
  { id: 'deselect', prio: 0, ch: 1, dur: 0.18, build: (s) => s.knock(0, 440, 0.2) },
  {
    id: 'blocked',
    prio: 0,
    ch: 1,
    dur: 0.22,
    build: (s) => {
      s.tone({ freq: 190, glideTo: 150, t: 0, dur: 0.12, gain: 0.22 });
      s.noiseBurst({ t: 0, dur: 0.05, gain: 0.05, type: 'lowpass', from: 600 });
    },
  },

  // Abbinamento: due colpi di bambù + due campanelle. La nota sale con la serie (combo 0..8)
  ...variants(9).map<Recipe>((n) => ({
    id: `match${n}`,
    prio: 0,
    dur: 1.4,
    build: (s) => {
      s.knock(0, 640, 0.22, -0.2);
      s.knock(0.05, 700, 0.22, 0.2);
      s.bell(midi(PENTA[n] + 12), 0.09, 0.9, 0.07, 0.35, 0, 2.01);
      s.bell(midi(PENTA[n + 2] + 12), 0.17, 1.1, 0.06, 0.4, 0, 2.01);
    },
  })),

  // Carattere del soggetto abbinato (si somma al suono base, 0.12 s dopo)
  {
    id: 'kind_fizz', // spritz, prosecco: cin cin e bollicine
    prio: 0,
    dur: 1.8,
    build: (s) => {
      s.clink(0, 0.13, -0.15);
      s.clink(0.07, 0.1, 0.15, 1.08);
      for (let i = 0; i < 18; i++) {
        const f = rand(2200, 5200);
        s.tone({ freq: f, glideTo: f * 1.3, t: 0.1 + rand(0, 0.8), dur: 0.03, gain: rand(0.01, 0.025), pan: rand(-0.5, 0.5) });
      }
    },
  },
  { id: 'kind_glass', prio: 0, dur: 1.6, build: (s) => s.clink(0, 0.14, 0) },
  {
    id: 'kind_oar',
    prio: 0,
    dur: 0.65,
    build: (s) => {
      s.noiseBurst({ t: 0, dur: 0.4, gain: 0.1, from: 1300, to: 380, q: 0.8, attack: 0.08, send: 0.3 });
      s.plip(0.25, 0.08);
    },
  },
  {
    id: 'kind_boat',
    prio: 0,
    dur: 0.9,
    build: (s) => {
      s.noiseBurst({ t: 0, dur: 0.6, gain: 0.08, type: 'lowpass', from: 900, to: 400, q: 0.6, attack: 0.2, send: 0.3 });
      s.plip(0.3, 0.07, -0.3);
      s.plip(0.42, 0.05, 0.3);
    },
  },
  {
    id: 'kind_horn',
    prio: 0,
    dur: 1.2,
    build: (s) => {
      const f = s.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      s.out(f, 0.45);
      s.tone({ freq: 196, t: 0, dur: 0.55, gain: 0.08, type: 'sawtooth', attack: 0.06, dest: f });
      s.tone({ freq: 247, t: 0, dur: 0.55, gain: 0.06, type: 'sawtooth', attack: 0.06, dest: f });
    },
  },
  { id: 'kind_bell', prio: 0, dur: 2.5, build: (s) => s.bell(midi(67), 0, 2.2, 0.09, 0.6, 0, 1.4) },
  {
    id: 'kind_bird',
    prio: 0,
    dur: 0.6,
    build: (s) =>
      [0, 0.09, 0.2].forEach((d, i) => s.tone({ freq: 2600 + i * 200, glideTo: 3900, glideTime: 0.05, t: d, dur: 0.07, gain: 0.05, send: 0.3, pan: 0.2 })),
  },
  { id: 'kind_gull', prio: 0, dur: 0.7, build: (s) => s.gullCall(0, 0.22, 1.1, 0.09, 0.4, 0.3) },
  {
    id: 'kind_sparkle',
    prio: 0,
    dur: 1.2,
    build: (s) => [91, 96, 100, 103].forEach((m, i) => s.bell(midi(m), i * 0.05, 0.6, 0.035, 0.6, (i - 1.5) * 0.3, 2.01)),
  },
  {
    id: 'kind_crab',
    prio: 0,
    ch: 1,
    dur: 0.22,
    build: (s) => {
      s.noiseBurst({ t: 0, dur: 0.02, gain: 0.12, type: 'highpass', from: 2500 });
      s.noiseBurst({ t: 0.09, dur: 0.02, gain: 0.12, type: 'highpass', from: 2800 });
    },
  },
  {
    id: 'kind_water',
    prio: 0,
    dur: 0.55,
    build: (s) => {
      s.plip(0, 0.08, -0.2);
      s.plip(0.13, 0.06, 0.25);
    },
  },
  { id: 'kind_default', prio: 0, dur: 0.4, build: (s) => s.plip(0.05, 0.05) },

  // Distribuzione a inizio livello: tre densità in base al numero di tessere
  ...([
    ['dealS', 5],
    ['dealM', 12],
    ['dealL', 26],
  ] as const).map<Recipe>(([id, n]) => ({
    id,
    prio: 0,
    dur: 1.8,
    build: (s) => {
      for (let i = 0; i < n; i++) s.knock((i / n) * 1.6 + rand(0, 0.03), rand(560, 820), 0.06, rand(-0.6, 0.6));
    },
  })),

  /* ---------- Feedback e jingle (prio 1) ---------- */
  {
    id: 'hint',
    prio: 1,
    dur: 1.3,
    build: (s) => {
      s.bell(midi(88), 0, 0.8, 0.05, 0.5, -0.3, 2.01);
      s.bell(midi(91), 0.12, 1, 0.05, 0.5, 0.3, 2.01);
    },
  },
  {
    id: 'shuffle',
    prio: 1,
    dur: 0.95,
    build: (s) => {
      for (let i = 0; i < 14; i++) s.knock(i * 0.045 + rand(0, 0.02), rand(520, 760), 0.1, rand(-0.6, 0.6));
      s.noiseBurst({ t: 0, dur: 0.7, gain: 0.05, from: 1500, to: 3500, q: 0.8, attack: 0.3 });
    },
  },
  {
    id: 'undo',
    prio: 1,
    ch: 1,
    dur: 0.45,
    build: (s) => {
      s.noiseBurst({ t: 0, dur: 0.22, gain: 0.08, from: 3800, to: 900, q: 0.9, attack: 0.03 });
      s.knock(0.16, 520, 0.18);
      s.knock(0.21, 520, 0.18);
    },
  },
  { id: 'timeWarn0', prio: 1, ch: 1, dur: 0.16, build: (s) => s.knock(0, 760, 0.12) },
  { id: 'timeWarn1', prio: 1, ch: 1, dur: 0.16, build: (s) => s.knock(0, 900, 0.12) },
  {
    // riferimento a midi 84: alla riproduzione si alza di tono col bonus di tempo
    id: 'timeGain',
    prio: 1,
    dur: 0.5,
    build: (s) => s.tone({ freq: midi(84), glideTo: midi(91), glideTime: 0.08, t: 0, dur: 0.18, gain: 0.05, send: 0.3 }),
  },
  {
    id: 'wings',
    prio: 1,
    dur: 1.6,
    build: (s) => {
      for (let i = 0; i < 9; i++) s.noiseBurst({ t: i * 0.15, dur: 0.14, gain: 0.12, type: 'lowpass', from: 900, to: 300, q: 0.7, attack: 0.04, send: 0.1 });
    },
  },
  {
    id: 'magoga',
    prio: 1,
    dur: 1.75,
    build: (s) => {
      s.gullCall(0, 0.5, 1, 0.34, 0.3, 0.1);
      [0.96, 0.92, 0.88, 0.84, 0.8].forEach((p, i) => s.gullCall(0.62 + i * 0.17, 0.13, p, 0.26, 0.28, 0.1 - i * 0.04));
    },
  },
  {
    id: 'levelComplete',
    prio: 1,
    dur: 3.1,
    build: (s) => {
      [72, 76, 79, 84, 88].forEach((m, i) => s.bell(midi(m), i * 0.13, 1.6, 0.07, 0.5, (i - 2) * 0.2, 2.01));
      [60, 64, 67, 71].forEach((m) => s.tone({ freq: midi(m), t: 0, dur: 2.6, gain: 0.04, attack: 0.4, type: 'triangle', send: 0.5 }));
    },
  },
  {
    id: 'confetti',
    prio: 1,
    dur: 3.0,
    build: (s) => {
      [0, 0.12, 0.2].forEach((d, i) => {
        s.noiseBurst({ t: d, dur: 0.12, gain: 0.16, from: 1800, to: 600, q: 0.9, pan: (i - 1) * 0.6, send: 0.3 });
        s.tone({ freq: 180, glideTo: 90, t: d, dur: 0.12, gain: 0.18, pan: (i - 1) * 0.6 });
      });
      [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => s.bell(midi(m), 0.15 + i * 0.07, 1.1, 0.07, 0.45, (i - 3) * 0.2, 2.01));
      [60, 64, 67, 72].forEach((m) => s.tone({ freq: midi(m), t: 0.15, dur: 1.8, gain: 0.045, attack: 0.08, type: 'triangle', send: 0.45 }));
      for (let i = 0; i < 22; i++) s.noiseBurst({ t: 0.4 + rand(0, 1.4), dur: 0.04, gain: rand(0.01, 0.03), from: rand(3500, 7500), q: 2.5, pan: rand(-0.9, 0.9) });
    },
  },
  {
    id: 'timeout',
    prio: 1,
    dur: 2.0,
    build: (s) => {
      [76, 72, 69, 64].forEach((m, i) => s.tone({ freq: midi(m), t: i * 0.18, dur: i === 3 ? 0.7 : 0.22, gain: 0.12, type: 'triangle', send: 0.3 }));
      [0.9, 0.86, 0.82, 0.78].forEach((p, i) => s.gullCall(0.9 + i * 0.16, 0.12, p, 0.2, 0.3, 0));
    },
  },

  /* ---------- Eventi degli ambienti (prio 2): più varianti, così non si ripetono ---------- */
  ...variants(4).map<Recipe>((i) => ({
    id: `amb_lap${i}`, // sciabordio
    prio: 2,
    sr: 22050,
    dur: 1.7,
    build: (s) => {
      s.noiseBurst({ t: 0, dur: rand(0.7, 1.3), gain: rand(0.05, 0.1), from: rand(500, 800), to: rand(250, 400), q: 0.9, attack: rand(0.25, 0.45), pan: rand(-0.7, 0.7) });
      if (Math.random() < 0.35) s.plip(rand(0.3, 0.8), 0.025, rand(-0.8, 0.8));
    },
  })),
  ...variants(3).map<Recipe>((i) => ({
    id: `amb_gull${i}`, // gabbiani lontani
    prio: 2,
    sr: 22050,
    dur: 1.8,
    build: (s) => {
      const p = rand(0.9, 1.1);
      const pan = rand(-0.9, 0.9);
      const n = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) s.gullCall(k * 0.3, k ? 0.18 : 0.38, p - k * 0.04, 0.05, 0.9, pan);
    },
  })),
  {
    id: 'amb_vaporetto',
    prio: 2,
    sr: 22050,
    dur: 6.8,
    build: (s) => {
      const f = s.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 520;
      const g = s.ctx.createGain();
      g.gain.value = 0.6;
      f.connect(g);
      s.out(g, 0.9, rand(-0.6, 0.6));
      [110, 138.6].forEach((fr) => s.tone({ freq: fr, t: 0, dur: 2.4, gain: 0.07, type: 'sawtooth', attack: 0.5, dest: f }));
      s.noiseBurst({ t: 0.4, dur: 6, gain: 0.03, type: 'lowpass', from: 160, q: 0.5, attack: 2 });
    },
  },
  {
    id: 'amb_church',
    prio: 2,
    sr: 22050,
    dur: 8.6,
    build: (s) => {
      for (let i = 0; i < 3; i++) s.bell(196, i * 2.2, 4.0, 0.05, 0.9, -0.3, 1.4);
    },
  },
  ...variants(4).map<Recipe>((i) => ({
    id: `amb_bird${i}`, // uccellini
    prio: 2,
    sr: 22050,
    dur: 1.0,
    build: (s) => {
      const base = rand(2800, 4200);
      const pan = rand(-0.8, 0.8);
      const n = 2 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) s.tone({ freq: base, glideTo: base * rand(1.1, 1.4), t: k * rand(0.08, 0.14), dur: 0.06, gain: 0.018, pan, send: 0.5 });
    },
  })),
  ...variants(3).map<Recipe>((i) => ({
    id: `amb_cow${i}`, // campanacci
    prio: 2,
    sr: 22050,
    dur: 2.1,
    build: (s) => {
      const pan = rand(-0.7, 0.7);
      for (let k = 0; k < 3; k++) s.bell(rand(560, 640), k * rand(0.35, 0.6), 0.7, 0.02, 0.8, pan, 2.4);
    },
  })),
];
