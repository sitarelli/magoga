'use client';
import { useEffect, useState } from 'react';
import { splitSpriteSheet } from '@/lib/spriteSplitter';

export function useSprites(src = '/tiles.png') {
  const [sprites, setSprites] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    splitSpriteSheet(src)
      .then((s) => alive && setSprites(s))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [src]);
  return { sprites, error };
}
