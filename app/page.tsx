'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSprites } from '@/hooks/useSprites';
import { Game } from '@/components/Game';
import { Splash } from '@/components/Splash';
import { sound } from '@/lib/sound';
import { freshProgress, loadProgress, saveProgress, type Mode, type Progress } from '@/lib/progress';

export default function Home() {
  const { sprites, error } = useSprites('/tiles.png');
  const [progress, setProgress] = useState<Progress>(freshProgress);
  const [mode, setMode] = useState<Mode | null>(null);
  const [session, setSession] = useState(0);

  useEffect(() => {
    setProgress(loadProgress());
    sound.attachUnlock();
    const bake = setTimeout(() => sound.prepare(), 500); // sintetizza i suoni in background
    sound.setAmbient('water'); // parte al primo tocco: la laguna accoglie
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('button:not([data-nosfx])');
      if (el && !(el as HTMLButtonElement).disabled) sound.click();
    };
    document.addEventListener('click', onClick);
    return () => {
      clearTimeout(bake);
      document.removeEventListener('click', onClick);
    };
  }, []);

  const onProgress = useCallback(
    (level: number, score: number) => {
      if (!mode) return;
      setProgress((p) => {
        const cur = p[mode];
        const next = { ...p, [mode]: { level, score, bestLevel: Math.max(cur.bestLevel, level), bestScore: Math.max(cur.bestScore, score) } };
        saveProgress(next);
        return next;
      });
    },
    [mode],
  );

  const start = (m: Mode) => {
    setSession((s) => s + 1);
    setMode(m);
  };
  const restart = (m: Mode) => {
    const next = { ...progress, [m]: { ...progress[m], level: 1, score: 0 } };
    saveProgress(next);
    setProgress(next);
    start(m);
  };

  if (mode && sprites) {
    return (
      <Game
        key={session}
        mode={mode}
        sprites={sprites}
        startLevel={progress[mode].level}
        startScore={progress[mode].score}
        onProgress={onProgress}
        onExit={() => {
          setMode(null);
          sound.setAmbient('water');
        }}
      />
    );
  }
  return <Splash progress={progress} ready={!!sprites} error={error} onStart={start} onRestart={restart} />;
}
