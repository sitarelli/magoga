'use client';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Tile } from '@/lib/board';
import { KIND_NAMES } from '@/lib/tiles';
import { TILE, TILE_H, TILE_W, type TileSprites } from '@/lib/spriteSplitter';

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
  sprites: TileSprites;
  free: Set<number>;
  selected: number | null;
  hint: number[];
  vanishing: Map<number, number>; // id -> id del compagno
  shakeId: { id: number; n: number } | null;
  dealKey: string;
  onTile: (t: Tile) => void;
}

interface TileViewProps {
  t: Tile;
  left: number;
  top: number;
  w: number;
  h: number;
  z: number;
  delay: number;
  src: string;
  isFree: boolean;
  isSel: boolean;
  isHint: boolean;
  exiting: boolean;
  ex: number;
  ey: number;
  shake: number;
  onTile: (t: Tile) => void;
}

/**
 * Una tessera. È memoizzata e usa solo transizioni/animazioni CSS: con 140 tessere in campo
 * un cambio di stato (selezione, timer, punteggio) ne ridisegna al massimo due, e nessuna
 * animazione gira su JavaScript. Su Android questo libera il thread principale per l'audio.
 */
const TileView = memo(function TileView(p: TileViewProps) {
  const radius = p.w * TILE.radius;
  const style = { borderRadius: radius, '--ex': `${p.ex}px`, '--ey': `${p.ey}px` } as CSSProperties;
  const imgBox: CSSProperties = {
    left: -(TILE.padL / TILE.face) * p.w,
    top: -(TILE.padT / TILE.face) * p.w,
    width: (TILE_W / TILE.face) * p.w,
    height: (TILE_H / TILE.face) * p.w,
  };
  return (
    <div className="tile-in absolute" style={{ left: p.left, top: p.top, width: p.w, height: p.h, zIndex: p.z, animationDelay: `${p.delay}ms` }}>
      <button
        type="button"
        data-nosfx
        aria-label={`${KIND_NAMES[p.t.kind]}${p.isFree ? '' : ', bloccata'}`}
        disabled={p.exiting}
        onClick={() => p.onTile(p.t)}
        className={`tile-btn relative block h-full w-full p-0 outline-none ${p.isFree ? 'is-free' : ''} ${p.isSel ? 'is-sel' : ''} ${p.exiting ? 'is-exit' : ''}`}
        style={style}
      >
        <span key={p.shake} className={`relative block h-full w-full ${p.shake ? 'tile-shake' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={imgBox} />
        </span>
        {p.isSel && (
          <span className="pointer-events-none absolute inset-0" style={{ borderRadius: 'inherit', boxShadow: '0 0 0 3px #f26b1d, 0 0 20px 6px rgba(242,107,29,.45)' }} />
        )}
        {p.isHint && !p.isSel && <span className="hint-glow pointer-events-none absolute inset-0" style={{ borderRadius: 'inherit' }} />}
      </button>
    </div>
  );
});

export const Board = memo(function Board({ tiles, sprites, free, selected, hint, vanishing, shakeId, dealKey, onTile }: Props) {
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

  // l'entrata a scaglioni vale solo nei primi istanti dopo la distribuzione
  const dealAt = useMemo(() => Date.now(), [dealKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const staggered = Date.now() - dealAt < 1800;
  const byId = useMemo(() => new Map(tiles.map((t) => [t.id, t])), [tiles]);

  return (
    <div ref={ref} className="relative h-full w-full">
      {box.w > 0 && (
        <div className="absolute left-1/2 top-1/2" style={{ width: size.bw, height: size.bh, transform: 'translate(-50%, -50%)' }}>
          {tiles.map((t, i) => {
            const p = pos(t);
            const partner = vanishing.get(t.id);
            let ex = 0;
            let ey = 0;
            if (partner !== undefined) {
              const o = byId.get(partner);
              if (o) {
                const q = pos(o);
                ex = (q.left - p.left) / 2;
                ey = (q.top - p.top) / 2 - size.h * 0.35;
              }
            }
            return (
              <TileView
                key={`${dealKey}-${t.id}`}
                t={t}
                left={p.left}
                top={p.top}
                w={size.w}
                h={size.h}
                z={partner !== undefined ? 9999 : t.z * 1000 + t.y * 20 + t.x}
                delay={staggered ? Math.round(Math.min(1600, t.z * 220 + (i % 24) * 14)) : 0}
                src={free.has(t.id) ? sprites.free[t.kind] : sprites.blocked[t.kind]}
                isFree={free.has(t.id)}
                isSel={selected === t.id}
                isHint={hint.includes(t.id)}
                exiting={partner !== undefined}
                ex={ex}
                ey={ey}
                shake={shakeId?.id === t.id ? shakeId.n : 0}
                onTile={onTile}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});
