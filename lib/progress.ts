export interface Progress {
  level: number;
  score: number;
  bestLevel: number;
  bestScore: number;
}
const KEY = 'magoga.progress.v1';
export const freshProgress: Progress = { level: 1, score: 0, bestLevel: 1, bestScore: 0 };

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...freshProgress, ...JSON.parse(raw) } : freshProgress;
  } catch {
    return freshProgress;
  }
}
export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}
