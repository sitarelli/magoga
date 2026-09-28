'use client';
import { motion } from 'framer-motion';
import { Gull } from './Magoga';
import { Scene } from './Scene';
import { SoundToggle } from './SoundToggle';
import { sound } from '@/lib/sound';
import type { Mode, Progress } from '@/lib/progress';

const MODES: { mode: Mode; title: string; text: string }[] = [
  { mode: 'zen', title: 'Zen', text: 'Nessun limite di tempo. Solo tu, la laguna e le tessere.' },
  { mode: 'sfida', title: 'Sfida', text: 'Il tempo scende: abbina veloce e di fila per ricaricarlo.' },
];

export function Splash({
  progress,
  ready,
  error,
  onStart,
  onRestart,
}: {
  progress: Progress;
  ready: boolean;
  error: string | null;
  onStart: (m: Mode) => void;
  onRestart: (m: Mode) => void;
}) {
  return (
    <div className="relative flex h-[100dvh] w-full items-center justify-center overflow-y-auto p-4">
      <Scene scene="tramonto" />
      <div className="absolute right-3 top-[max(env(safe-area-inset-top),12px)] z-20">
        <SoundToggle />
      </div>
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        className="glass relative z-10 mt-20 w-full max-w-lg rounded-[32px] px-5 pb-6 pt-16 text-center sm:px-8"
      >
        <button type="button" data-nosfx onClick={() => sound.magoga()} className="absolute -top-[92px] left-1/2 -translate-x-[46%]" aria-label="Il magòga">
          <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
            <Gull mode="stand" width={176} />
          </motion.div>
        </button>
        <h1 className="font-display text-6xl font-bold italic leading-none tracking-tight text-legno-800 sm:text-7xl">Magòga</h1>
        <p className="mx-auto mt-4 max-w-[32ch] font-display text-[17px] leading-relaxed text-legno-600">
          <b className="font-semibold text-legno-800">Magòga:</b> Gabbiano reale adulto, famoso per la sua stazza grande e il comportamento vorace sui tetti della città.
        </p>
        {error && <p className="mt-4 rounded-xl bg-spritz-500/15 px-3 py-2 text-sm text-legno-800">{error}. Controlla che public/tiles.png esista.</p>}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {MODES.map(({ mode, title, text }) => {
            const p = progress[mode];
            return (
              <div key={mode} className="flex flex-col rounded-3xl bg-white/45 p-4 text-left ring-1 ring-white/70">
                <p className="font-display text-2xl font-semibold italic text-legno-800">{title}</p>
                <p className="mt-1 flex-1 text-[13px] leading-snug text-legno-600">{text}</p>
                <button
                  disabled={!ready}
                  onClick={() => onStart(mode)}
                  className={`mt-3 w-full rounded-2xl py-3 text-base font-bold disabled:opacity-60 ${mode === 'sfida' ? 'btn-spritz' : 'btn-soft text-legno-800'}`}
                >
                  {!ready ? 'Preparo…' : p.level > 1 ? `Continua dal livello ${p.level}` : 'Inizia'}
                </button>
                <div className="mt-2 flex min-h-[18px] items-center justify-between text-[11px] text-legno-600/80">
                  <span>{p.bestLevel > 1 ? `Record: liv. ${p.bestLevel}, ${p.bestScore} pt` : ''}</span>
                  {p.level > 1 && (
                    <button onClick={() => onRestart(mode)} className="font-semibold text-spritz-600 hover:underline">
                      Da capo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
