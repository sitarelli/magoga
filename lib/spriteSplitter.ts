/**
 * Taglia lo sprite sheet 9x6 in 54 tessere (dataURL) e "cuoce" su ognuna lo spessore 3D e l'ombra.
 * Cella base = width/9 x height/6. Se il foglio ha lo sfondo trasparente il contorno si trova
 * dall'alpha (bordi puliti, niente alone bianco); altrimenti si usa il colore beige come prima.
 */
export interface SplitOptions {
  cols?: number;
  rows?: number;
}

/** Geometria delle tessere generate (in pixel del canvas di uscita) */
export const TILE = {
  face: 176, // faccia quadrata
  depth: 9, // spessore visibile sotto la faccia
  padL: 10,
  padT: 6,
  padR: 16,
  padB: 30,
  radius: 0.085, // raggio angoli, frazione della faccia (per l'anello di selezione)
};
export const TILE_W = TILE.face + TILE.padL + TILE.padR;
export const TILE_H = TILE.face + TILE.padT + TILE.padB;

type Box = { x: number; y: number; w: number; h: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Impossibile caricare lo sprite sheet: ${src}`));
    img.src = src;
  });
}

function pickRun(flags: boolean[], center: number, maxGap = 1): [number, number] | null {
  const f = flags.slice();
  const n = f.length;
  let i = 0;
  while (i < n) {
    if (!f[i]) {
      let j = i;
      while (j < n && !f[j]) j++;
      if (i > 0 && j < n && j - i <= maxGap) for (let k = i; k < j; k++) f[k] = true;
      i = j;
    } else i++;
  }
  if (center < 0 || center >= n || !f[center]) return null;
  let a = center;
  let b = center;
  while (a > 0 && f[a - 1]) a--;
  while (b < n - 1 && f[b + 1]) b++;
  return [a, b];
}

const median = (v: number[]) => {
  const s = v.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

function tint(src: HTMLCanvasElement, color: string) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const x = c.getContext('2d')!;
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

export async function splitSpriteSheet(src: string, opts: SplitOptions = {}): Promise<string[]> {
  const { cols = 9, rows = 6 } = opts;
  const img = await loadImage(src);
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;
  const cellW = W / cols;
  const cellH = H / rows;

  const sheet = document.createElement('canvas');
  sheet.width = W;
  sheet.height = H;
  const sctx = sheet.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(img, 0, 0);
  const data = sctx.getImageData(0, 0, W, H).data;

  // sfondo trasparente? (controllo gli angoli e le fughe tra le celle)
  let transparentSamples = 0;
  const probes = [
    [2, 2],
    [W - 3, 2],
    [2, H - 3],
    [W - 3, H - 3],
    [Math.round(cellW), 3],
    [3, Math.round(cellH)],
  ];
  probes.forEach(([x, y]) => {
    if (data[(y * W + x) * 4 + 3] < 40) transparentSamples++;
  });
  const useAlpha = transparentSamples >= 4;

  const isTile = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    if (useAlpha) return data[i + 3] > 128;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    return r - b >= 28 || Math.max(r, g, b) - Math.min(r, g, b) > 55;
  };

  // 1) bounding box di ogni tessera
  const boxes: (Box | null)[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.max(0, Math.floor(c * cellW - cellW * 0.1));
      const x1 = Math.min(W, Math.ceil((c + 1) * cellW + cellW * 0.1));
      const y0 = Math.max(0, Math.floor(r * cellH - cellH * 0.1));
      const y1 = Math.min(H, Math.ceil((r + 1) * cellH + cellH * 0.1));
      const rowFlags: boolean[] = [];
      for (let y = y0; y < y1; y++) {
        let n = 0;
        for (let x = x0; x < x1; x += 2) if (isTile(x, y)) n++;
        rowFlags.push(n > (useAlpha ? 0.3 : 0.45) * ((x1 - x0) / 2));
      }
      const colFlags: boolean[] = [];
      for (let x = x0; x < x1; x++) {
        let n = 0;
        for (let y = y0; y < y1; y += 2) if (isTile(x, y)) n++;
        colFlags.push(n > 0.3 * ((y1 - y0) / 2));
      }
      const rr = pickRun(rowFlags, Math.floor((r + 0.5) * cellH) - y0);
      const cc = pickRun(colFlags, Math.floor((c + 0.5) * cellW) - x0);
      boxes.push(rr && cc ? { x: x0 + cc[0], y: y0 + rr[0], w: cc[1] - cc[0] + 1, h: rr[1] - rr[0] + 1 } : null);
    }
  }

  // 2) correzione dei ritagli anomali con le mediane di riga/colonna
  for (let r = 0; r < rows; r++) {
    const rowBoxes = boxes.slice(r * cols, r * cols + cols).filter(Boolean) as Box[];
    const mY = median(rowBoxes.map((b) => b.y));
    const mH = median(rowBoxes.map((b) => b.h));
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const colBoxes = boxes.filter((b, j) => b && j % cols === c) as Box[];
      const mX = median(colBoxes.map((b) => b.x));
      const mW = median(colBoxes.map((b) => b.w));
      const b = boxes[i];
      const fixed: Box = b ? { ...b } : { x: mX, y: mY, w: mW, h: mH };
      if (!b || Math.abs(fixed.h - mH) > mH * 0.12 || Math.abs(fixed.y - mY) > mH * 0.12) {
        fixed.y = mY;
        fixed.h = mH;
      }
      if (!b || Math.abs(fixed.w - mW) > mW * 0.14) {
        fixed.x = b ? b.x + b.w / 2 - mW / 2 : mX;
        fixed.w = mW;
      }
      boxes[i] = fixed;
    }
  }

  // 3) faccia normalizzata + spessore + ombra morbida, tutto cotto nel PNG
  const F = TILE.face;
  const face = document.createElement('canvas');
  face.width = F;
  face.height = F;
  const fctx = face.getContext('2d', { willReadFrequently: true })!;
  fctx.imageSmoothingQuality = 'high';

  const out = document.createElement('canvas');
  out.width = TILE_W;
  out.height = TILE_H;
  const octx = out.getContext('2d')!;

  const result: string[] = [];
  for (const b of boxes as Box[]) {
    fctx.clearRect(0, 0, F, F);
    fctx.save();
    if (!useAlpha) {
      // foglio senza trasparenza: angoli arrotondati ritagliati a mano
      fctx.beginPath();
      if (typeof fctx.roundRect === 'function') fctx.roundRect(0, 0, F, F, F * TILE.radius);
      else fctx.rect(0, 0, F, F);
      fctx.clip();
      fctx.drawImage(sheet, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 0, 0, F, F);
    } else {
      fctx.drawImage(sheet, b.x, b.y, b.w, b.h, 0, 0, F, F);
    }
    fctx.restore();
    // la faccia deve essere pienamente opaca (l'alpha del foglio è 250-253)
    const fd = fctx.getImageData(0, 0, F, F);
    for (let i = 3; i < fd.data.length; i += 4) if (fd.data[i] > 150) fd.data[i] = 255;
    fctx.putImageData(fd, 0, 0);

    const dark = tint(face, '#7d6240');
    const mid = tint(face, '#a88a5c');
    const rim = tint(face, '#d9c49c');

    octx.clearRect(0, 0, TILE_W, TILE_H);
    // ombra portata morbida sul tavolo
    octx.save();
    octx.shadowColor = 'rgba(40, 24, 12, 0.5)';
    octx.shadowBlur = 14;
    octx.shadowOffsetX = 3;
    octx.shadowOffsetY = 8;
    octx.drawImage(dark, TILE.padL, TILE.padT + TILE.depth);
    octx.restore();
    // spessore: strati dal più scuro (base) al più chiaro (sotto la faccia)
    for (let d = TILE.depth; d >= 1; d--) {
      const layer = d > TILE.depth * 0.55 ? dark : d > 2 ? mid : rim;
      octx.drawImage(layer, TILE.padL + d * 0.25, TILE.padT + d);
    }
    // faccia
    octx.drawImage(face, TILE.padL, TILE.padT);
    // leggerissima luce dall'alto sulla faccia
    octx.save();
    octx.globalCompositeOperation = 'source-atop';
    const g = octx.createLinearGradient(0, TILE.padT, 0, TILE.padT + F);
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(60,35,15,0.06)');
    octx.fillStyle = g;
    octx.fillRect(TILE.padL, TILE.padT, F, F);
    octx.restore();

    result.push(out.toDataURL('image/png'));
  }
  return result;
}
