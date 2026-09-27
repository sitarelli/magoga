import type { Pos } from './board';

export type Shape = 'rect' | 'diamond' | 'bridge' | 'towers' | 'cross' | 'ring' | 'lagoon';

interface Spec {
  cols: number;
  rows: number;
  layers: number;
  shape: Shape;
}

const SHAPES: Shape[] = ['diamond', 'bridge', 'towers', 'cross', 'ring', 'lagoon', 'rect'];

/** Maschere in coordinate normalizzate: u, v in [0,1] = centro della tessera */
function inShape(shape: Shape, u: number, v: number): boolean {
  const du = Math.abs(u - 0.5) * 2;
  const dv = Math.abs(v - 0.5) * 2;
  switch (shape) {
    case 'rect':
      return true;
    case 'diamond':
      return du + dv <= 1.25;
    case 'bridge': // Rialto: arcata centrale in basso
      return !(du < 0.35 && v > 0.62);
    case 'towers':
      return du > 0.18;
    case 'cross':
      return du < 0.45 || dv < 0.45;
    case 'ring':
      return !(du < 0.3 && dv < 0.3);
    case 'lagoon': // isole: angoli smussati
      return du * du + dv * dv <= 1.45;
  }
}

function levelSpec(level: number, portrait: boolean): Spec {
  const fixed: Spec[] = [
    { cols: 4, rows: 3, layers: 1, shape: 'rect' },
    { cols: 6, rows: 4, layers: 1, shape: 'rect' },
    { cols: 6, rows: 4, layers: 2, shape: 'rect' },
    { cols: 8, rows: 5, layers: 2, shape: 'diamond' },
    { cols: 8, rows: 5, layers: 3, shape: 'bridge' },
    { cols: 8, rows: 6, layers: 3, shape: 'lagoon' },
    { cols: 9, rows: 6, layers: 3, shape: 'towers' },
    { cols: 9, rows: 6, layers: 4, shape: 'cross' },
    { cols: 10, rows: 6, layers: 4, shape: 'ring' },
  ];
  let s: Spec;
  if (level <= fixed.length) s = fixed[level - 1];
  else {
    // livelli infiniti: forme a rotazione, piramidi sempre alte
    const shape = SHAPES[(level * 7 + Math.floor(level / 3)) % SHAPES.length];
    s = { cols: 10 + (level % 2), rows: 6 + (level % 3 === 0 ? 1 : 0), layers: 4 + (level % 2), shape };
  }
  // in verticale si ruota la griglia di base
  return portrait ? { ...s, cols: s.rows, rows: s.cols } : s;
}

/** Posizioni del livello: base + strati a piramide sfalsati di mezza tessera */
export function buildLayout(level: number, portrait: boolean): (Pos & { id: number })[] {
  const spec = levelSpec(level, portrait);
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const present = new Set<string>();
  const out: Pos[] = [];
  for (let z = 0; z < spec.layers; z++) {
    const c = spec.cols - z;
    const r = spec.rows - z;
    if (c < 1 || r < 1) break;
    for (let j = 0; j < r; j++) {
      for (let i = 0; i < c; i++) {
        const x = 2 * i + z;
        const y = 2 * j + z;
        const u = (x / 2 + 0.5) / spec.cols;
        const v = (y / 2 + 0.5) / spec.rows;
        if (!inShape(spec.shape, u, v)) continue;
        if (z > 0) {
          // deve poggiare su 4 tessere sotto
          const ok = [
            [x - 1, y - 1],
            [x + 1, y - 1],
            [x - 1, y + 1],
            [x + 1, y + 1],
          ].every(([a, b]) => present.has(key(a, b, z - 1)));
          if (!ok) continue;
        }
        present.add(key(x, y, z));
        out.push({ x, y, z });
      }
    }
  }
  // tetto massimo di tessere per restare leggibili su mobile
  while (out.length > 144) out.pop();
  if (out.length % 2) out.pop(); // la tessera più in alto/ultima
  // normalizza a partire da 0
  const minX = Math.min(...out.map((p) => p.x));
  const minY = Math.min(...out.map((p) => p.y));
  return out.map((p, id) => ({ x: p.x - minX, y: p.y - minY, z: p.z, id }));
}

export const SCENES = [
  { key: 'tramonto', name: 'Laguna al tramonto' },
  { key: 'burano', name: 'Burano' },
  { key: 'nebbia', name: 'Nebbia in Piazza San Marco' },
  { key: 'colli', name: 'Colli Euganei' },
  { key: 'garda', name: 'Lago di Garda' },
  { key: 'dolomiti', name: 'Dolomiti' },
] as const;
export type SceneKey = (typeof SCENES)[number]['key'];
export const sceneFor = (level: number) => SCENES[(level - 1) % SCENES.length];
