'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSprites } from '@/hooks/useSprites';
import { Game } from '@/components/Game';
import { Splash } from '@/components/Splash';
import { sound } from '@/lib/sound';
import { freshProgress, loadProgress, saveProgress, type Progress } from '@/lib/progress';

export default function Home() {
  const { sprites, error } = useSprites('/tiles.png');
  const [progress, setProgress] = useState<Progress>(freshProgress);
  const [playing, setPlaying] = useState(false);
  const [session, setSession] = useState(0);

  useEffect(() => {
    setProgress(loadProgress());
    sound.attachUnlock();
    sound.setAmbient('water'); // parte al primo tocco: la laguna accoglie
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('button:not([data-nosfx])');
      if (el && !(el as HTMLButtonElement).disabled) sound.click();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const onProgress = useCallback((level: number, score: number) => {
    setProgress((p) => {
      const next = { level, score, bestLevel: Math.max(p.bestLevel, level), bestScore: Math.max(p.bestScore, score) };
      saveProgress(next);
      return next;
    });
  }, []);

  const start = () => {
    setSession((s) => s + 1);
    setPlaying(true);
  };
  const restart = () => {
    const next = { ...progress, level: 1, score: 0 };
    saveProgress(next);
    setProgress(next);
    setSession((s) => s + 1);
    setPlaying(true);
  };

  if (playing && sprites) {
    return (
      <Game
        key={session}
        sprites={sprites}
        startLevel={progress.level}
        startScore={progress.score}
        onProgress={onProgress}
        onExit={() => {
          setPlaying(false);
          sound.setAmbient('water');
        }}
      />
    );
  }
  return <Splash progress={progress} ready={!!sprites} error={error} onStart={start} onRestart={restart} />;
}
