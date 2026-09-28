/**
 * Taglia lo sprite sheet 9x6 in 54 tessere (dataURL).
 * Cella base = width/9 x height/6; poi rifila lo sfondo chiaro e l'ombra grigia
 * cercando il corpo beige della tessera, e ritaglia gli angoli arrotondati con alpha.
 */
export interface SplitOptions {
  cols?: number;
  rows?: number;
  outWidth?: number;
  outHeight?: number;
}

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

/** Pixel della tessera: beige/colorato. Lo sfondo è bianco e l'ombra è grigio neutro. */
const isTile = (r: number, g: number, b: number) => r - b >= 28 || Math.max(r, g, b) - Math.min(r, g, b) > 55;

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

export async function splitSpriteSheet(src: string, opts: SplitOptions = {}): Promise<string[]> {
  const { cols = 9, rows = 6, outWidth = 176, outHeight = 182 } = opts;
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
  const tile = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return isTile(data[i], data[i + 1], data[i + 2]);
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
        for (let x = x0; x < x1; x += 2) if (tile(x, y)) n++;
        rowFlags.push(n > 0.45 * ((x1 - x0) / 2));
      }
      const colFlags: boolean[] = [];
      for (let x = x0; x < x1; x++) {
        let n = 0;
        for (let y = y0; y < y1; y += 2) if (tile(x, y)) n++;
        colFlags.push(n > 0.3 * ((y1 - y0) / 2));
      }
      const rr = pickRun(rowFlags, Math.floor((r + 0.5) * cellH) - y0);
      const cc = pickRun(colFlags, Math.floor((c + 0.5) * cellW) - x0);
      boxes.push(rr && cc ? { x: x0 + cc[0], y: y0 + rr[0], w: cc[1] - cc[0] + 1, h: rr[1] - rr[0] + 1 } : null);
    }
  }

  // 2) correzione dei ritagli anomali (icone con molto grigio/blu) con le mediane di riga/colonna
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

  // 3) disegno normalizzato con angoli arrotondati trasparenti
  const out = document.createElement('canvas');
  out.width = outWidth;
  out.height = outHeight;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingQuality = 'high';
  const radius = outWidth * 0.12;
  const result: string[] = [];
  for (const b of boxes as Box[]) {
    octx.clearRect(0, 0, outWidth, outHeight);
    octx.save();
    octx.beginPath();
    if (typeof octx.roundRect === 'function') octx.roundRect(0, 0, outWidth, outHeight, radius);
    else octx.rect(0, 0, outWidth, outHeight);
    octx.clip();
    octx.drawImage(sheet, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 0, 0, outWidth, outHeight);
    octx.restore();
    result.push(out.toDataURL('image/png'));
  }
  return result;
}
