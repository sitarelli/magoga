'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Board } from './Board';
import { Scene } from './Scene';
import { MagogaSteal } from './Magoga';
import { Confetti } from './Confetti';
import type { Mode } from '@/lib/progress';
import type { TileSprites } from '@/lib/spriteSplitter';
import { SoundToggle } from './SoundToggle';
import { availablePairs, dealSolvable, freeTiles, pickKinds, reshuffle, type Tile } from '@/lib/board';
import { buildLayout, sceneFor, type SceneKey } from '@/lib/layout';
import { kindSound } from '@/lib/tiles';
import { sound, type Ambient } from '@/lib/sound';

const AMBIENT: Record<SceneKey, Ambient> = {
  tramonto: 'water',
  burano: 'water',
  nebbia: 'fog',
  colli: 'hills',
  garda: 'water',
  dolomiti: 'mountain',
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Sfida: tempo iniziale e velocità con cui scende */
const challengeTime = (tiles: number) => Math.max(28, Math.min(150, Math.round(18 + tiles * 1.0)));
const drainFor = (level: number) => 1 + Math.min(0.6, (level - 1) * 0.035);
const STREAK_MS = 4000; // abbinamenti entro 4 s tengono viva la serie
const MASTER_COUNT = 5; // colpo da maestro: 5 coppie...
const MASTER_MS = 9000; // ...entro 9 secondi

interface Props {
  mode: Mode;
  sprites: TileSprites;
  startLevel: number;
  startScore: number;
  onProgress: (level: number, score: number) => void;
  onExit: () => void;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center px-2 sm:px-3">
      <span className="text-[10px] font-semibold text-legno-600/70 sm:text-[11px]">{label}</span>
      <motion.span key={String(value)} initial={{ y: -4, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="font-display text-base font-semibold tabular-nums text-legno-800 sm:text-lg">
        {value}
      </motion.span>
    </div>
  );
}

/** Legge un valore da un ref a intervalli: solo questo piccolo componente si ridisegna, non tutta la partita */
function useRefValue(ref: { current: number }, active: boolean, ms: number, resetKey: string) {
  const [v, setV] = useState(ref.current);
  useEffect(() => {
    setV(ref.current);
    if (!active) return;
    const iv = setInterval(() => setV(ref.current), ms);
    return () => clearInterval(iv);
  }, [ref, active, ms, resetKey]);
  return v;
}

function TimeStat({ timeRef, active, resetKey }: { timeRef: { current: number }; active: boolean; resetKey: string }) {
  const v = useRefValue(timeRef, active, 250, resetKey);
  return <Stat label="Resta" value={fmt(Math.ceil(v))} />;
}

function TimeFill({ timeRef, maxRef, active, resetKey }: { timeRef: { current: number }; maxRef: { current: number }; active: boolean; resetKey: string }) {
  const v = useRefValue(timeRef, active, 100, resetKey);
  const pct = Math.max(0, Math.min(1, v / maxRef.current));
  const low = pct < 0.25;
  return (
    <div className="glass relative h-3.5 overflow-hidden rounded-full p-[3px]" role="progressbar" aria-label="Tempo rimasto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
      <div
        className={`h-full rounded-full transition-[width] duration-100 ease-linear ${low ? 'animate-pulse' : ''}`}
        style={{ width: `${pct * 100}%`, background: low ? 'linear-gradient(90deg,#d4550f,#e4572e)' : 'linear-gradient(90deg,#2f7f86,#e9c46a 55%,#f26b1d)' }}
      />
    </div>
  );
}

function ToolButton({ onClick, disabled, label, short, children }: { onClick: () => void; disabled?: boolean; label: string; short?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} className="btn-soft flex items-center gap-1.5 rounded-2xl px-3 py-2.5 text-[13px] font-semibold text-legno-800 transition disabled:opacity-45 sm:gap-2 sm:px-4 sm:text-sm">
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{short ?? label}</span>
    </button>
  );
}

export function Game({ mode, sprites, startLevel: initialLevel, startScore, onProgress, onExit }: Props) {
  const [level, setLevel] = useState(initialLevel);
  const initialLevelRef = useRef(initialLevel);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [dealKey, setDealKey] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [vanishing, setVanishing] = useState<Map<number, number>>(new Map());
  const [hint, setHint] = useState<number[]>([]);
  const [shake, setShake] = useState<{ id: number; n: number } | null>(null);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(startScore);
  const [levelScore, setLevelScore] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<'playing' | 'magoga' | 'cleared' | 'timeout'>('playing');
  const [trophy, setTrophy] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [gains, setGains] = useState<{ id: number; v: number }[]>([]);
  const [confetti, setConfetti] = useState<number | null>(null);
  const sfida = mode === 'sfida';
  const maxTime = useRef(60);
  const timeRef = useRef(0);
  const streak = useRef({ n: 0, at: 0 });
  const recent = useRef<number[]>([]);
  const gainId = useRef(0);

  const history = useRef<{ a: Tile; b: Tile; points: number }[]>([]);
  const combo = useRef({ n: 0, at: 0 });
  const totalTiles = useRef(0);
  const levelStartScore = useRef(startScore);
  const scoreRef = useRef(startScore);
  scoreRef.current = score;
  const hintTimer = useRef<ReturnType<typeof setTimeout>>();

  const scene = sceneFor(level);
  const timerActive = sfida && phase === 'playing' && !paused;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }, []);

  const startLevel = useCallback((n: number) => {
    const portrait = window.innerHeight > window.innerWidth * 1.05;
    const pos = buildLayout(n, portrait);
    const dealt = dealSolvable(pos, pickKinds(pos.length / 2));
    totalTiles.current = dealt.length;
    history.current = [];
    combo.current = { n: 0, at: 0 };
    levelStartScore.current = scoreRef.current;
    setLevel(n);
    setTiles(dealt);
    setDealKey(`${n}-${Date.now()}`);
    setSelected(null);
    setVanishing(new Map());
    setHint([]);
    setMoves(0);
    setLevelScore(0);
    setBonus(0);
    setElapsed(0);
    setTrophy(null);
    maxTime.current = challengeTime(dealt.length);
    timeRef.current = maxTime.current;
    streak.current = { n: 0, at: 0 };
    recent.current = [];
    setPhase('playing');
    sound.setAmbient(AMBIENT[sceneFor(n).key]);
    setTimeout(() => sound.deal(dealt.length, 1.6), 120);
  }, []);

  useEffect(() => {
    startLevel(initialLevelRef.current);
  }, [startLevel]);

  const effective = useMemo(() => tiles.filter((t) => !vanishing.has(t.id)), [tiles, vanishing]);
  const free = useMemo(() => new Set(freeTiles(effective).map((t) => t.id)), [effective]);
  const pairsLeft = useMemo(() => availablePairs(effective).length, [effective]);

  /* ---------- timer discreto ---------- */
  useEffect(() => {
    if (phase !== 'playing' || paused) return;
    const iv = setInterval(() => {
      if (!document.hidden) setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, paused]);

  /* ---------- Sfida: il tempo scende ---------- */
  const addTime = useCallback((v: number) => {
    timeRef.current = Math.max(0, Math.min(maxTime.current, timeRef.current + v));
    const id = ++gainId.current;
    setGains([{ id, v }]);
    setTimeout(() => setGains((g) => g.filter((x) => x.id !== id)), 1100);
  }, []);

  useEffect(() => {
    if (!sfida || phase !== 'playing' || paused || !dealKey) return;
    const drain = drainFor(level);
    const iv = setInterval(() => {
      if (document.hidden) return;
      const before = timeRef.current;
      timeRef.current = Math.max(0, before - 0.1 * drain);
      const sec = Math.ceil(timeRef.current);
      if (sec < Math.ceil(before) && sec <= 10 && sec > 0) sound.timeWarn(sec <= 3);
      if (timeRef.current <= 0) {
        setSelected(null);
        setPhase('timeout');
        sound.timeout();
      }
    }, 100);
    return () => clearInterval(iv);
  }, [sfida, phase, paused, dealKey, level]);

  /* ---------- fine livello o nessuna mossa ---------- */
  useEffect(() => {
    if (phase !== 'playing' || !dealKey) return;
    if (tiles.length === 0) {
      const last = history.current[history.current.length - 1];
      setTrophy(last ? last.a.kind : 0);
      const b = sfida ? 50 + Math.round(timeRef.current * 5) : 50 + Math.max(0, totalTiles.current * 3 - elapsed);
      setBonus(b);
      const total = scoreRef.current + b;
      setScore(total);
      onProgress(level + 1, total);
      setPhase('magoga');
      return;
    }
    if (vanishing.size === 0 && availablePairs(tiles).length === 0) {
      showToast('Nessuna coppia libera: rimescolo le tessere');
      const t = setTimeout(() => {
        setTiles((ts) => reshuffle(ts));
        setDealKey(`${level}-${Date.now()}`);
        history.current = [];
        sound.shuffle();
      }, 1100);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, vanishing.size, phase, dealKey]);

  /* ---------- azioni ---------- */
  const doMatch = (a: Tile, b: Tile) => {
    const now = Date.now();
    const c = now - combo.current.at < 5000 ? Math.min(combo.current.n + 1, 8) : 0;
    combo.current = { n: c, at: now };
    const pts = 10 + c * 5;
    history.current.push({ a, b, points: pts });
    setScore((s) => s + pts);
    setLevelScore((s) => s + pts);
    setMoves((m) => m + 1);
    setSelected(null);
    setHint((h) => (h.length ? [] : h));
    sound.match(kindSound(a.kind), c);

    // colpo da maestro: 5 coppie di fila in pochi secondi
    recent.current = [...recent.current, now].slice(-MASTER_COUNT);
    const master = recent.current.length === MASTER_COUNT && now - recent.current[0] <= MASTER_MS;
    if (master) {
      recent.current = [];
      setConfetti(now);
      setTimeout(() => sound.confetti(), 180);
      setScore((s) => s + 50);
      setLevelScore((s) => s + 50);
    }
    if (sfida) {
      const st = now - streak.current.at < STREAK_MS ? streak.current.n + 1 : 0;
      streak.current = { n: st, at: now };
      const gain = Math.round((2 + Math.min(st, 6) * 0.8 + (master ? 5 : 0)) * 10) / 10;
      addTime(gain);
      sound.timeGain(gain);
    }
    setVanishing((v) => new Map(v).set(a.id, b.id).set(b.id, a.id));
    setTimeout(() => {
      setVanishing((v) => {
        const n = new Map(v);
        n.delete(a.id);
        n.delete(b.id);
        return n;
      });
      setTiles((ts) => ts.filter((x) => x.id !== a.id && x.id !== b.id));
    }, 440);
  };

  const handleTile = (t: Tile) => {
    if (phase !== 'playing' || paused || vanishing.has(t.id)) return;
    if (!free.has(t.id)) {
      sound.blocked();
      setShake((s) => ({ id: t.id, n: (s?.n ?? 0) + 1 }));
      return;
    }
    if (selected === t.id) {
      sound.deselect();
      setSelected(null);
      return;
    }
    const sel = selected !== null ? effective.find((x) => x.id === selected) : undefined;
    if (sel && sel.kind === t.kind) {
      doMatch(sel, t);
      return;
    }
    sound.select();
    setSelected(t.id);
  };

  // callback stabile: la plancia (memoizzata) non si ridisegna a ogni tick del timer
  const tileHandler = useRef(handleTile);
  tileHandler.current = handleTile;
  const onTile = useCallback((t: Tile) => tileHandler.current(t), []);

  const doHint = () => {
    const pairs = availablePairs(effective);
    if (!pairs.length) return;
    const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
    setHint([a.id, b.id]);
    recent.current = []; // il suggerimento interrompe la serie
    if (sfida) addTime(-5);
    sound.hint();
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint([]), 3200);
  };

  const doShuffle = () => {
    if (vanishing.size || !tiles.length) return;
    setTiles(reshuffle(tiles));
    setDealKey(`${level}-${Date.now()}`);
    setSelected(null);
    setHint([]);
    history.current = [];
    recent.current = [];
    setMoves((m) => m + 1);
    if (sfida) addTime(-5);
    sound.shuffle();
  };

  const doUndo = () => {
    if (vanishing.size || sfida) return;
    const last = history.current.pop();
    if (!last) return;
    setTiles((ts) => [...ts, last.a, last.b].sort((p, q) => p.id - q.id));
    setScore((s) => s - last.points);
    setLevelScore((s) => s - last.points);
    setMoves((m) => m + 1);
    setSelected(null);
    combo.current = { n: 0, at: 0 };
    recent.current = [];
    sound.undo();
  };

  const nextLevel = () => startLevel(level + 1);
  const restartLevel = () => {
    setScore(levelStartScore.current);
    scoreRef.current = levelStartScore.current;
    setPaused(false);
    startLevel(level);
  };

  useEffect(() => {
    if (!confetti) return;
    const t = setTimeout(() => setConfetti(null), 3800);
    return () => clearTimeout(t);
  }, [confetti]);

  const onMagogaDone = useCallback(() => setPhase('cleared'), []);

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden">
      <Scene scene={scene.key} />

      {/* HUD */}
      <header className="relative z-10 flex items-start justify-between gap-2 px-3 pt-[max(env(safe-area-inset-top),10px)] sm:px-5">
        <div className="flex items-center gap-2">
          <button onClick={() => setPaused(true)} className="btn-soft grid h-10 w-10 place-items-center rounded-2xl text-legno-800" aria-label="Pausa">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
              <rect x="6.5" y="5" width="3.6" height="14" rx="1.4" />
              <rect x="13.9" y="5" width="3.6" height="14" rx="1.4" />
            </svg>
          </button>
          <SoundToggle />
          <div className="glass hidden rounded-2xl px-3 py-1.5 sm:block">
            <p className="font-display text-lg font-bold italic leading-none text-legno-800">Magòga</p>
            <p className="text-[11px] text-legno-600/80">
              {sfida ? 'Sfida' : 'Zen'}, {scene.name}
            </p>
          </div>
        </div>
        <div className="glass flex items-center divide-x divide-legno-600/15 rounded-2xl py-1.5">
          <Stat label="Livello" value={level} />
          {sfida ? <TimeStat timeRef={timeRef} active={timerActive} resetKey={dealKey} /> : <Stat label="Tempo" value={fmt(elapsed)} />}
          <Stat label="Mosse" value={moves} />
          <Stat label="Punti" value={score} />
        </div>
      </header>

      {sfida && (
        <div className="relative z-10 mx-auto mt-2 w-full max-w-md px-4">
          <TimeFill timeRef={timeRef} maxRef={maxTime} active={timerActive} resetKey={dealKey} />
          <AnimatePresence>
            {gains.map((g) => (
              <motion.span
                key={g.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: -14 }}
                exit={{ opacity: 0, y: -24 }}
                className={`absolute -top-1 right-4 font-display text-lg font-bold drop-shadow ${g.v >= 0 ? 'text-crema' : 'text-spritz-300'}`}
              >
                {g.v >= 0 ? `+${g.v}s` : `${g.v}s`}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Tavola */}
      <main className="relative z-10 min-h-0 flex-1 px-2 py-3 sm:px-8 sm:py-5">
        <Board tiles={tiles} sprites={sprites} free={free} selected={selected} hint={hint} vanishing={vanishing} shakeId={shake} dealKey={dealKey} onTile={onTile} />
      </main>

      {/* Strumenti */}
      <nav className="relative z-10 flex flex-wrap items-center justify-center gap-2 px-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <ToolButton onClick={doHint} disabled={phase !== 'playing' || !pairsLeft} label="Suggerimento" short="Aiuto">
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
        </ToolButton>
        <ToolButton onClick={doShuffle} disabled={phase !== 'playing'} label="Mescola">
          <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
        </ToolButton>
        {!sfida && (
        <ToolButton onClick={doUndo} disabled={phase !== 'playing' || !history.current.length} label="Annulla">
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </ToolButton>
        )}
        <span className="btn-soft rounded-2xl px-3 py-2.5 text-xs font-semibold text-legno-600">
          <span className="hidden sm:inline">{pairsLeft === 1 ? '1 coppia libera' : `${pairsLeft} coppie libere`}</span>
          <span className="sm:hidden">{pairsLeft === 1 ? '1 coppia' : `${pairsLeft} coppie`}</span>
        </span>
      </nav>

      {/* Avvisi */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass fixed left-1/2 top-[84px] z-40 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold text-legno-800"
            role="status"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {confetti && <Confetti key={confetti} id={confetti} />}

      {/* Sfida: tempo scaduto */}
      <AnimatePresence>
        {phase === 'timeout' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-legno-900/35 p-4">
            <motion.div initial={{ y: 24, scale: 0.97 }} animate={{ y: 0, scale: 1 }} className="glass w-full max-w-sm rounded-[28px] p-6 text-center" role="dialog" aria-label="Tempo scaduto">
              <p className="font-display text-3xl font-semibold italic text-legno-800">Tempo scaduto</p>
              <p className="mt-1 text-sm text-legno-600">
                Mancavano {tiles.length} tessere. Il magòga ride dal tetto.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button onClick={restartLevel} className="btn-spritz rounded-2xl py-3 font-bold">
                  Riprova il livello {level}
                </button>
                <button onClick={onExit} className="btn-soft rounded-2xl py-3 font-semibold text-legno-800">
                  Schermata iniziale
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{phase === 'magoga' && <MagogaSteal tileSrc={trophy !== null ? sprites.free[trophy] : undefined} onDone={onMagogaDone} />}</AnimatePresence>

      {/* Livello completato */}
      <AnimatePresence>
        {phase === 'cleared' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-legno-900/30 p-4">
            <motion.div initial={{ y: 24, scale: 0.97 }} animate={{ y: 0, scale: 1 }} className="glass w-full max-w-sm rounded-[28px] p-6 text-center" role="dialog" aria-label="Livello completato">
              <p className="font-display text-3xl font-semibold italic text-legno-800">Livello {level} completato</p>
              <p className="mt-1 text-sm text-legno-600">Il magòga si è preso l’ultima tessera. Pazienza.</p>
              <dl className="mt-5 grid grid-cols-3 gap-2">
                {[
                  ['Tempo', fmt(elapsed)],
                  ['Mosse', moves],
                  ['Punti', levelScore + bonus],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-2xl bg-white/45 py-2">
                    <dt className="text-[11px] font-semibold text-legno-600/75">{k}</dt>
                    <dd className="font-display text-xl font-semibold tabular-nums text-legno-800">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-legno-600">
                {sfida ? 'Bonus tempo rimasto' : 'Bonus fine livello'} +{bonus}. Totale {score}.
              </p>
              <button onClick={nextLevel} className="btn-spritz mt-5 w-full rounded-2xl py-3 text-base font-bold">
                Livello {level + 1}: {sceneFor(level + 1).name}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pausa */}
      <AnimatePresence>
        {paused && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-legno-900/35 p-4 backdrop-blur-[2px]">
            <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="glass w-full max-w-xs rounded-[28px] p-6 text-center" role="dialog" aria-label="Pausa">
              <p className="font-display text-3xl font-semibold italic text-legno-800">Pausa</p>
              <p className="mt-1 text-sm text-legno-600">
                Livello {level}, {scene.name}
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button onClick={() => setPaused(false)} className="btn-spritz rounded-2xl py-3 font-bold">
                  Riprendi
                </button>
                <button onClick={restartLevel} className="btn-soft rounded-2xl py-3 font-semibold text-legno-800">
                  Ricomincia il livello
                </button>
                <button onClick={onExit} className="btn-soft rounded-2xl py-3 font-semibold text-legno-800">
                  Schermata iniziale
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
