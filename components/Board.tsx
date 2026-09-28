'use client';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Tile } from '@/lib/board';
import { KIND_NAMES } from '@/lib/tiles';
import { TILE, TILE_H, TILE_W } from '@/lib/spriteSplitter';

/**
 * La griglia lavora sulla FACCIA quadrata della tessera; lo spessore e l'ombra sono già cotti
 * nel PNG e sporgono oltre la faccia (sotto e a destra), coperti dalla riga successiva.
 */
const ASPECT = 1;
const SX = 0.985; // facce quasi a contatto
const SY = 0.985;
const DX = 0.07; // spostamento per strato: si vede lo spessore della tessera sopra
const DY = 0.085;
const DEPTH = (TILE.depth + 3) / TILE.face; // margine per lo spessore dell'ultima riga

interface Props {
  tiles: Tile[];
  sprites: string[];
  free: Set<number>;
  selected: number | null;
  hint: number[];
  vanishing: Map<number, number>; // id -> id del compagno
  shakeId: { id: number; n: number } | null;
  dealKey: string;
  onTile: (t: Tile) => void;
}

export function Board({ tiles, sprites, free, selected, hint, vanishing, shakeId, dealKey, onTile }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // la geometria dipende dal layout del livello, non dalle tessere rimaste: niente salti quando si svuota
  const [geom, setGeom] = useState({ spanX: 2, spanY: 2, layers: 0 });
  useEffect(() => {
    if (!tiles.length) return;
    setGeom({
      spanX: Math.max(...tiles.map((t) => t.x)) + 2,
      spanY: Math.max(...tiles.map((t) => t.y)) + 2,
      layers: Math.max(...tiles.map((t) => t.z)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealKey]);

  const size = useMemo(() => {
    const wu = (geom.spanX / 2 - 1) * SX + 1 + geom.layers * DX;
    const hu = (geom.spanY / 2 - 1) * SY + 1 + geom.layers * DY + DEPTH;
    const w = Math.max(24, Math.min(box.w / wu, (box.h * ASPECT) / hu, 118));
    return { w, h: w / ASPECT, bw: wu * w, bh: (hu * w) / ASPECT };
  }, [box, geom]);

  const pos = (t: Tile) => ({
    left: (t.x / 2) * SX * size.w + (geom.layers - t.z) * DX * size.w,
    top: (t.y / 2) * SY * size.h + (geom.layers - t.z) * DY * size.h,
  });
  const dealAt = useMemo(() => Date.now(), [dealKey]);
  const staggered = Date.now() - dealAt < 1800;
  const byId = useMemo(() => new Map(tiles.map((t) => [t.id, t])), [tiles]);

  return (
    <div ref={ref} className="relative h-full w-full">
      {box.w > 0 && (
        <div className="absolute left-1/2 top-1/2" style={{ width: size.bw, height: size.bh, transform: 'translate(-50%, -50%)' }}>
          {tiles.map((t, i) => {
            const p = pos(t);
            const partner = vanishing.get(t.id);
            const isFree = free.has(t.id);
            const isSel = selected === t.id;
            const isHint = hint.includes(t.id);
            let exitTo: { x: number; y: number } | null = null;
            if (partner !== undefined) {
              const o = byId.get(partner);
              if (o) {
                const q = pos(o);
                exitTo = { x: (q.left - p.left) / 2, y: (q.top - p.top) / 2 };
              }
            }
            const shake = shakeId?.id === t.id ? shakeId.n : 0;
            return (
              <motion.div
                key={`${dealKey}-${t.id}`}
                className="absolute"
                style={{
                  left: p.left,
                  top: p.top,
                  width: size.w,
                  height: size.h,
                  zIndex: exitTo ? 9999 : t.z * 1000 + t.y * 20 + t.x,
                }}
                initial={{ opacity: 0, y: -size.h * 0.5, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: staggered ? Math.min(1.6, t.z * 0.22 + (i % 24) * 0.014) : 0, type: 'spring', stiffness: 300, damping: 24 }}
              >
                <motion.button
                  type="button"
                  data-nosfx
                  aria-label={`${KIND_NAMES[t.kind]}${isFree ? '' : ', bloccata'}`}
                  disabled={partner !== undefined}
                  onClick={() => onTile(t)}
                  className="relative block h-full w-full p-0 outline-none"
                  style={{ borderRadius: size.w * TILE.radius, cursor: isFree ? 'pointer' : 'default' }}
                  animate={
                    exitTo
                      ? { opacity: 0, x: exitTo.x, y: exitTo.y - size.h * 0.35, scale: 0.75, transition: { duration: 0.42, ease: [0.4, 0, 0.2, 1] } }
                      : { opacity: 1, x: 0, y: isSel ? -size.h * 0.08 : 0, scale: isSel ? 1.04 : 1 }
                  }
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                  whileHover={isFree && !exitTo && !isSel ? { y: -size.h * 0.035 } : undefined}
                >
                  <span key={shake} className={`relative block h-full w-full ${shake ? 'tile-shake' : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sprites[t.kind]}
                      alt=""
                      draggable={false}
                      className={`pointer-events-none absolute max-w-none select-none transition-[filter] duration-300 ${isFree ? 'tile-free' : 'tile-blocked'}`}
                      style={{
                        left: -(TILE.padL / TILE.face) * size.w,
                        top: -(TILE.padT / TILE.face) * size.w,
                        width: (TILE_W / TILE.face) * size.w,
                        height: (TILE_H / TILE.face) * size.w,
                      }}
                    />
                  </span>
                  {isSel && (
                    <span
                      className="pointer-events-none absolute inset-0"
                      style={{ borderRadius: 'inherit', boxShadow: '0 0 0 3px #f26b1d, 0 0 20px 6px rgba(242,107,29,.45)' }}
                    />
                  )}
                  {isHint && !isSel && <span className="hint-glow pointer-events-none absolute inset-0" style={{ borderRadius: 'inherit' }} />}
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
