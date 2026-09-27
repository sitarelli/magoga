export interface Pos {
  x: number; // mezze tessere
  y: number;
  z: number;
}
export interface Tile extends Pos {
  id: number;
  kind: number;
}

export function isFree(t: Pos & { id?: number }, tiles: (Pos & { id?: number })[]): boolean {
  let left = false;
  let right = false;
  for (const b of tiles) {
    if (b === t || (b.id !== undefined && b.id === t.id)) continue;
    const dy = Math.abs(b.y - t.y);
    if (b.z > t.z && Math.abs(b.x - t.x) < 2 && dy < 2) return false; // coperta
    if (b.z === t.z && dy < 2) {
      if (b.x === t.x - 2) left = true;
      else if (b.x === t.x + 2) right = true;
      if (left && right) return false;
    }
  }
  return true;
}

export function freeTiles(tiles: Tile[]): Tile[] {
  return tiles.filter((t) => isFree(t, tiles));
}

/** Coppie abbinabili adesso */
export function availablePairs(tiles: Tile[]): [Tile, Tile][] {
  const free = freeTiles(tiles);
  const byKind = new Map<number, Tile[]>();
  free.forEach((t) => byKind.set(t.kind, [...(byKind.get(t.kind) ?? []), t]));
  const pairs: [Tile, Tile][] = [];
  byKind.forEach((list) => {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) pairs.push([list[i], list[j]]);
  });
  return pairs;
}

function shuffle<T>(a: T[]): T[] {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function weightedPick<T extends Pos>(list: T[], avoid?: T): T {
  const pool = avoid ? list.filter((t) => t !== avoid) : list;
  // più probabilità per le tessere in alto: evita di chiudersi da soli
  const weights = pool.map((t) => 1 + t.z * 1.5);
  let r = Math.random() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/**
 * Distribuzione SEMPRE risolvibile: si parte dal layout pieno, si scelgono due tessere libere,
 * si assegna loro lo stesso soggetto e si tolgono. L'ordine di rimozione è una soluzione valida.
 */
export function dealSolvable(positions: (Pos & { id: number })[], pairKinds: number[]): Tile[] {
  for (let attempt = 0; attempt < 300; attempt++) {
    let remaining = positions.map((p) => ({ ...p, kind: -1 }));
    const kinds = shuffle(pairKinds);
    const done: Tile[] = [];
    let ok = true;
    for (const kind of kinds) {
      const free = remaining.filter((t) => isFree(t, remaining));
      if (free.length < 2) {
        ok = false;
        break;
      }
      const a = weightedPick(free);
      const b = weightedPick(free, a);
      a.kind = kind;
      b.kind = kind;
      remaining = remaining.filter((t) => t !== a && t !== b);
      done.push(a, b);
    }
    if (ok) return done.sort((p, q) => p.id - q.id);
  }
  // fallback teorico (non dovrebbe capitare)
  const flat = shuffle(pairKinds.flatMap((k) => [k, k]));
  return positions.map((p, i) => ({ ...p, kind: flat[i] }));
}

/** Soggetti per un livello: ogni soggetto compare 2 volte (4 se servono più di 54 coppie) */
export function pickKinds(pairs: number): number[] {
  const all = shuffle(Array.from({ length: 54 }, (_, i) => i));
  const out: number[] = [];
  for (let i = 0; i < pairs; i++) out.push(all[i % 54]);
  return out;
}

/** Rimescola le tessere rimaste mantenendo la partita risolvibile */
export function reshuffle(tiles: Tile[]): Tile[] {
  const counts = new Map<number, number>();
  tiles.forEach((t) => counts.set(t.kind, (counts.get(t.kind) ?? 0) + 1));
  const pairs: number[] = [];
  counts.forEach((n, k) => {
    for (let i = 0; i < Math.floor(n / 2); i++) pairs.push(k);
  });
  return dealSolvable(tiles, pairs);
}
