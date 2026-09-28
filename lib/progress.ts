export type Mode = 'zen' | 'sfida';

export interface ModeProgress {
  level: number;
  score: number;
  bestLevel: number;
  bestScore: number;
}
export type Progress = Record<Mode, ModeProgress>;

const KEY = 'magoga.progress.v2';
const OLD_KEY = 'magoga.progress.v1';
const fresh: ModeProgress = { level: 1, score: 0, bestLevel: 1, bestScore: 0 };
export const freshProgress: Progress = { zen: fresh, sfida: fresh };

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { zen: { ...fresh, ...p.zen }, sfida: { ...fresh, ...p.sfida } };
    }
    // i progressi della versione precedente diventano quelli della modalità Zen
    const old = localStorage.getItem(OLD_KEY);
    if (old) return { zen: { ...fresh, ...JSON.parse(old) }, sfida: fresh };
  } catch {}
  return freshProgress;
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}
