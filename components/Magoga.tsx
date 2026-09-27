'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sound } from '@/lib/sound';

export type GullMode = 'fly' | 'stand' | 'squawk';

const WING = 'M118 100 Q132 52 176 8 Q196 -8 214 -14 Q206 6 190 22 Q200 22 206 18 Q194 44 170 58 Q160 82 150 104 Z';

/** Il magòga: gabbiano reale adulto, grande e con l'aria di chi sta per rubarti il cicchetto */
export function Gull({ mode, width = 220, flip = false }: { mode: GullMode; width?: number; flip?: boolean }) {
  const flying = mode === 'fly';
  return (
    <svg viewBox="0 -20 240 220" width={width} height={(width * 220) / 240} style={{ transform: flip ? 'scaleX(-1)' : undefined, overflow: 'visible' }} aria-hidden>
      {/* ala lontana */}
      {flying && (
        <motion.g
          style={{ originX: '130px', originY: '100px' }}
          animate={{ rotate: [-18, 34, -18] }}
          transition={{ duration: 0.42, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path d={WING} fill="#7f8991" transform="translate(-10 -4)" />
        </motion.g>
      )}
      {/* coda */}
      <path d="M176 100 L232 90 L228 120 L180 124 Z" fill="#fbfaf6" stroke="#d6d2c8" strokeWidth="1.5" />
      <path d="M220 91 L232 90 L228 120 L217 120 Z" fill="#2b2b2b" />
      {/* zampe */}
      {!flying ? (
        <g stroke="#e8b93a" strokeWidth="5" strokeLinecap="round" fill="#e8b93a">
          <line x1="122" y1="140" x2="118" y2="180" />
          <line x1="146" y1="140" x2="150" y2="180" />
          <path d="M104 182 L118 178 L130 184 Z" strokeWidth="2" />
          <path d="M136 184 L150 178 L164 182 Z" strokeWidth="2" />
        </g>
      ) : (
        <g stroke="#e8b93a" strokeWidth="4.5" strokeLinecap="round">
          <line x1="150" y1="138" x2="176" y2="150" />
          <line x1="140" y1="140" x2="166" y2="156" />
        </g>
      )}
      {/* corpo */}
      <ellipse cx="135" cy="112" rx="62" ry="36" fill="#fbfaf6" stroke="#d6d2c8" strokeWidth="1.5" />
      <ellipse cx="128" cy="126" rx="48" ry="18" fill="#efece4" />
      {/* ala chiusa */}
      {!flying && (
        <g>
          <path d="M98 94 Q150 72 206 98 Q194 130 140 130 Q108 122 98 94 Z" fill="#9ea7ae" />
          <path d="M184 100 Q212 100 228 110 Q206 124 180 122 Z" fill="#2b2b2b" />
          <circle cx="206" cy="110" r="3" fill="#fbfaf6" />
          <circle cx="194" cy="114" r="2.5" fill="#fbfaf6" />
          <path d="M112 118 Q150 126 190 116" stroke="#fbfaf6" strokeWidth="3" fill="none" opacity="0.8" />
        </g>
      )}
      {/* testa */}
      <ellipse cx="96" cy="94" rx="24" ry="20" fill="#fbfaf6" />
      <circle cx="78" cy="78" r="27" fill="#fbfaf6" stroke="#d6d2c8" strokeWidth="1.5" />
      <circle cx="70" cy="72" r="4.6" fill="#f2d45c" stroke="#d9453c" strokeWidth="1.3" />
      <circle cx="69.5" cy="72" r="2" fill="#1b1b1b" />
      <path d="M60 64 L80 68" stroke="#5f5f5f" strokeWidth="3" strokeLinecap="round" />
      {/* becco */}
      <path d="M55 79 L22 83 Q13 85 17 91 L24 92 L55 88 Z" fill="#f4c542" />
      <motion.g
        style={{ originX: '55px', originY: '88px' }}
        animate={{ rotate: mode === 'squawk' ? [0, -22, -6, -22, 0] : 0 }}
        transition={{ duration: 0.9, repeat: mode === 'squawk' ? Infinity : 0 }}
      >
        <path d="M55 88 L24 91 Q30 98 55 95 Z" fill="#eab236" />
        <circle cx="31" cy="93" r="3.2" fill="#d9342b" />
      </motion.g>
      {/* ala vicina */}
      {flying && (
        <motion.g
          style={{ originX: '130px', originY: '100px' }}
          animate={{ rotate: [-24, 30, -24] }}
          transition={{ duration: 0.42, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path d={WING} fill="#a3acb3" stroke="#8a939a" strokeWidth="1" />
          <path d="M176 8 Q196 -8 214 -14 Q206 6 190 22 Z" fill="#2b2b2b" />
        </motion.g>
      )}
    </svg>
  );
}

/** Fine livello: il magòga arriva, gracchia e ruba l'ultima tessera */
export function MagogaSteal({ tileSrc, onDone }: { tileSrc?: string; onDone: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    t.push(
      setTimeout(() => {
        setStep(1);
        sound.wings(8, 0.15);
      }, 600),
    );
    t.push(
      setTimeout(() => {
        setStep(2);
        sound.magoga();
      }, 1900),
    );
    t.push(
      setTimeout(() => {
        setStep(3);
        sound.wings(9, 0.14);
      }, 3500),
    );
    t.push(setTimeout(() => sound.levelComplete(), 3900));
    t.push(setTimeout(onDone, 5000));
    return () => t.forEach(clearTimeout);
  }, [onDone]);

  const gullAnim =
    step === 0
      ? { x: '70vw', y: '-70vh', rotate: -12 }
      : step === 1 || step === 2
        ? { x: 0, y: 0, rotate: 0 }
        : { x: '-80vw', y: '-85vh', rotate: -18 };

  return (
    <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-legno-900/25" />
      <div className="absolute left-1/2 top-[55%] h-0 w-0">
        {/* tessera trofeo */}
        <AnimatePresence>
          {step < 3 && tileSrc && (
            <motion.img
              key="trophy"
              src={tileSrc}
              alt=""
              className="tile-shadow absolute -left-[38px] -top-[44px] h-[88px] w-[76px] max-w-none"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: step === 2 ? [0, -4, 4, 0] : 0 }}
              exit={{ opacity: 0, transition: { duration: 0.05 } }}
              transition={{ scale: { type: 'spring', stiffness: 260, damping: 16 }, rotate: { duration: 0.6 } }}
            />
          )}
        </AnimatePresence>
        {/* gabbiano */}
        <motion.div
          className="absolute -left-[120px] -top-[226px]"
          initial={{ x: '70vw', y: '-70vh' }}
          animate={gullAnim}
          transition={{ duration: step === 3 ? 1.4 : 1.25, ease: step === 3 ? [0.5, 0, 0.8, 0.4] : [0.2, 0.8, 0.3, 1] }}
        >
          <Gull mode={step === 2 ? 'squawk' : 'fly'} width={240} />
          {step === 3 && tileSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tileSrc} alt="" className="tile-shadow absolute left-[96px] top-[150px] h-[88px] w-[76px] max-w-none rotate-12" />
          )}
          <AnimatePresence>
            {step === 2 && (
              <motion.div
                initial={{ scale: 0, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 16 }}
                className="glass absolute -left-10 -top-8 rounded-2xl px-4 py-2 font-display text-2xl font-bold italic text-legno-800"
              >
                Gràaa!
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}
