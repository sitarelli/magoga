'use client';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

const COLORS = ['#f26b1d', '#ff9a4d', '#e9c46a', '#2f7f86', '#e4572e', '#2e86ab', '#8ac926', '#c05299', '#fbf4e6'];

/** Coriandoli: esplosione dal centro, poi pioggia lenta con rotazioni */
export function Confetti({ id }: { id: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 110 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const power = 18 + Math.random() * 30;
        return {
          i,
          color: COLORS[i % COLORS.length],
          x: Math.cos(angle) * power,
          up: -(10 + Math.random() * 28),
          fall: 55 + Math.random() * 40,
          rot: (Math.random() - 0.5) * 1080,
          w: 6 + Math.random() * 7,
          round: Math.random() < 0.3,
          delay: Math.random() * 0.12,
          dur: 2.2 + Math.random() * 1.2,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.i}
          className="absolute left-1/2 top-[48%] block"
          style={{ width: p.w, height: p.round ? p.w : p.w * 0.45, background: p.color, borderRadius: p.round ? '50%' : 2 }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.4 }}
          animate={{
            x: [`0vw`, `${p.x * 0.8}vw`, `${p.x * 1.1}vw`],
            y: [`0vh`, `${p.up}vh`, `${p.fall}vh`],
            rotate: p.rot,
            scale: [0.4, 1, 1],
            opacity: [1, 1, 0],
          }}
          transition={{ duration: p.dur, delay: p.delay, times: [0, 0.22, 1], ease: 'easeOut' }}
        />
      ))}
      <div className="absolute inset-x-0 top-[40%] flex justify-center">
      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 1.12, 1, 1], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 2.2, times: [0, 0.2, 0.75, 1] }}
      >
        <div className="glass whitespace-nowrap rounded-3xl px-6 py-3 text-center">
          <p className="font-display text-3xl font-bold italic text-legno-800 sm:text-4xl">Colpo da maestro!</p>
          <p className="text-sm font-semibold text-spritz-600">5 coppie di fila</p>
        </div>
      </motion.div>
      </div>
    </div>
  );
}
