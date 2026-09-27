'use client';
import { useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { sound } from '@/lib/sound';

export function useMuted() {
  return useSyncExternalStore(sound.subscribe, sound.getMuted, () => false);
}

export function SoundToggle({ className = '' }: { className?: string }) {
  const muted = useMuted();
  return (
    <button
      type="button"
      onClick={() => sound.toggleMute()}
      aria-pressed={!muted}
      aria-label={muted ? 'Attiva i suoni' : 'Disattiva i suoni'}
      title={muted ? 'Attiva i suoni' : 'Disattiva i suoni'}
      className={`btn-soft grid h-10 w-10 place-items-center rounded-2xl text-legno-800 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" fillOpacity=".18" />
        {muted ? (
          <path d="M16 9.5l5 5M21 9.5l-5 5" />
        ) : (
          <>
            <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} d="M15.5 9.2a4 4 0 0 1 0 5.6" />
            <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.08 }} d="M18.2 6.6a7.6 7.6 0 0 1 0 10.8" />
          </>
        )}
      </svg>
    </button>
  );
}
