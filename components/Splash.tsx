'use client';
import { motion } from 'framer-motion';
import { Gull } from './Magoga';
import { Scene } from './Scene';
import { SoundToggle } from './SoundToggle';
import { sound } from '@/lib/sound';
import type { Progress } from '@/lib/progress';

export function Splash({ progress, ready, error, onStart, onRestart }: { progress: Progress; ready: boolean; error: string | null; onStart: () => void; onRestart: () => void }) {
  return (
    <div className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden p-4">
      <Scene scene="tramonto" />
      <div className="absolute right-3 top-[max(env(safe-area-inset-top),12px)] z-20">
        <SoundToggle />
      </div>
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        className="glass relative z-10 w-full max-w-md rounded-[32px] px-6 pb-7 pt-20 text-center sm:px-9"
      >
        <button
          type="button"
          data-nosfx
          onClick={() => sound.magoga()}
          className="absolute -top-[92px] left-1/2 -translate-x-[46%]"
          aria-label="Il magòga"
        >
          <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
            <Gull mode="stand" width={176} />
          </motion.div>
        </button>
        <h1 className="font-display text-6xl font-bold italic leading-none tracking-tight text-legno-800 sm:text-7xl">Magòga</h1>
        <p className="mx-auto mt-4 max-w-[30ch] font-display text-[17px] leading-relaxed text-legno-600">
          <b className="font-semibold text-legno-800">Magòga:</b> Gabbiano reale adulto, famoso per la sua stazza grande e il comportamento vorace sui tetti della città.
        </p>
        {error && <p className="mt-4 rounded-xl bg-spritz-500/15 px-3 py-2 text-sm text-legno-800">{error}. Controlla che public/tiles.png esista.</p>}
        <button disabled={!ready} onClick={onStart} className="btn-spritz mt-7 w-full rounded-2xl py-3.5 text-lg font-bold disabled:opacity-60">
          {ready ? 'Inizia' : 'Preparo le tessere…'}
        </button>
        {progress.level > 1 && (
          <p className="mt-3 text-sm text-legno-600">
            Riprendi dal livello {progress.level}, {progress.score} punti.{' '}
            <button onClick={onRestart} className="font-semibold text-spritz-600 underline-offset-2 hover:underline">
              Ricomincia dal livello 1
            </button>
          </p>
        )}
        {progress.bestLevel > 1 && (
          <p className="mt-2 text-xs text-legno-600/75">
            Record: livello {progress.bestLevel}, {progress.bestScore} punti
          </p>
        )}
      </motion.div>
    </div>
  );
}
