'use client';
import { AnimatePresence, motion } from 'framer-motion';
import type { SceneKey } from '@/lib/layout';

const VB = '0 0 1600 1000';

function Tramonto() {
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <defs>
        <linearGradient id="tr-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f2350" />
          <stop offset="0.35" stopColor="#8a3f63" />
          <stop offset="0.52" stopColor="#e2683f" />
          <stop offset="0.62" stopColor="#f8b66a" />
        </linearGradient>
        <linearGradient id="tr-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c35a4d" />
          <stop offset="0.4" stopColor="#7a3656" />
          <stop offset="1" stopColor="#2c1a3c" />
        </linearGradient>
        <radialGradient id="tr-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff1c9" />
          <stop offset="0.45" stopColor="#ffd08a" />
          <stop offset="1" stopColor="#ffb05a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="620" fill="url(#tr-sky)" />
      <circle cx="1060" cy="575" r="230" fill="url(#tr-sun)" opacity="0.7" />
      <circle cx="1060" cy="580" r="78" fill="#ffe0a3" />
      <g className="anim-drift" opacity="0.4" fill="#f7a58a">
        <ellipse cx="300" cy="230" rx="220" ry="16" />
        <ellipse cx="520" cy="300" rx="160" ry="10" />
        <ellipse cx="1300" cy="260" rx="200" ry="14" />
      </g>
      {/* skyline: Salute, campanile, San Giorgio */}
      <g fill="#3b2143" opacity="0.9">
        <path d="M0 610 L0 590 L120 590 L130 575 L260 575 L260 560 L300 560 L300 600 L420 600 L420 585 L470 585 L470 610 Z" />
        <rect x="560" y="440" width="26" height="170" />
        <path d="M552 440 L573 390 L594 440 Z" />
        <path d="M640 610 L640 560 Q700 490 760 560 L760 610 Z" />
        <path d="M690 510 Q700 480 710 510 Z" />
        <path d="M770 610 L770 575 Q800 540 830 575 L830 610 Z" />
        <path d="M1320 610 L1320 570 Q1360 525 1400 570 L1400 610 Z" />
        <rect x="1430" y="500" width="18" height="110" />
        <path d="M1424 500 L1439 468 L1454 500 Z" />
        <rect x="840" y="596" width="480" height="14" />
      </g>
      <rect y="610" width="1600" height="390" fill="url(#tr-water)" />
      <g fill="#ffc27a">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect key={i} className="anim-shimmer" style={{ animationDelay: `${i * 0.4}s` }} x={1060 - (120 - i * 12)} y={630 + i * 40} width={(120 - i * 12) * 2} height="6" rx="3" opacity="0.5" />
        ))}
      </g>
      {/* bricole */}
      <g fill="#2a1630">
        {[140, 168, 196].map((x) => (
          <rect key={x} x={x} y={690 + (x - 140) / 6} width="12" height="260" rx="3" />
        ))}
        {[1380, 1406].map((x) => (
          <rect key={x} x={x} y={760} width="12" height="240" rx="3" />
        ))}
      </g>
      <g className="anim-bob" fill="#24142c">
        <path d="M600 760 Q700 790 820 752 L828 742 Q818 768 700 776 Q640 776 600 760 Z" />
        <rect x="786" y="700" width="4" height="56" transform="rotate(18 788 728)" />
      </g>
    </svg>
  );
}

const BURANO_COLORS = ['#e4572e', '#f3a712', '#2e86ab', '#8ac926', '#db3a34', '#ffc857', '#6a4c93', '#1982c4', '#ff595e', '#43aa8b', '#ff924c', '#c05299', '#f6d55c'];

function Burano() {
  const houses = BURANO_COLORS.map((c, i) => ({ c, x: i * 124 - 10, w: 124, h: 250 + ((i * 53) % 110) }));
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <defs>
        <linearGradient id="bu-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fc9e8" />
          <stop offset="1" stopColor="#f7efdf" />
        </linearGradient>
        <linearGradient id="bu-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a9a98" />
          <stop offset="1" stopColor="#1d5359" />
        </linearGradient>
      </defs>
      <rect width="1600" height="660" fill="url(#bu-sky)" />
      <g className="anim-drift-slow" fill="#fff" opacity="0.75">
        <ellipse cx="300" cy="140" rx="120" ry="30" />
        <ellipse cx="370" cy="120" rx="80" ry="34" />
        <ellipse cx="1200" cy="190" rx="140" ry="28" />
      </g>
      {/* campanile storto di San Martino */}
      <g transform="rotate(4 1480 380)" fill="#d9c7a7">
        <rect x="1460" y="200" width="40" height="200" />
        <path d="M1456 200 L1480 150 L1504 200 Z" fill="#b99d73" />
      </g>
      {houses.map((h) => (
        <g key={h.x}>
          <rect x={h.x} y={640 - h.h} width={h.w} height={h.h} fill={h.c} />
          <rect x={h.x} y={640 - h.h} width={h.w} height="10" fill="#000" opacity="0.12" />
          <rect x={h.x + h.w - 26} y={640 - h.h - 26} width="12" height="26" fill="#9c5a3c" />
          {[0, 1].map((row) =>
            [0, 1].map((col) => (
              <g key={`${row}${col}`}>
                <rect x={h.x + 22 + col * 50} y={640 - h.h + 40 + row * 80} width="26" height="40" rx="3" fill="#fdf6e8" />
                <rect x={h.x + 16 + col * 50} y={640 - h.h + 40 + row * 80} width="6" height="40" fill="#2f6b3a" />
                <rect x={h.x + 48 + col * 50} y={640 - h.h + 40 + row * 80} width="6" height="40" fill="#2f6b3a" />
              </g>
            )),
          )}
          <rect x={h.x + 46} y={590} width="30" height="50" rx="14" fill="#5a3825" />
        </g>
      ))}
      <rect y="640" width="1600" height="22" fill="#d8cbb4" />
      <rect y="662" width="1600" height="338" fill="url(#bu-water)" />
      <g opacity="0.22" transform="translate(0 1324) scale(1 -1)">
        {houses.map((h) => (
          <rect key={h.x} x={h.x} y={662 - h.h * 0.8} width={h.w} height={h.h * 0.8} fill={h.c} />
        ))}
      </g>
      <g fill="#e8fbf8">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <rect key={i} className="anim-shimmer" style={{ animationDelay: `${i * 0.35}s` }} x={(i * 197) % 1500} y={700 + ((i * 67) % 260)} width={80 + (i % 3) * 40} height="4" rx="2" opacity="0.5" />
        ))}
      </g>
      <g className="anim-bob">
        <path d="M980 760 Q1080 800 1210 760 L1200 790 Q1090 810 990 786 Z" fill="#1e4e8c" />
        <path d="M990 786 Q1090 810 1200 790 L1196 800 Q1090 818 994 796 Z" fill="#f3a712" />
      </g>
    </svg>
  );
}

function Nebbia() {
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <defs>
        <linearGradient id="ne-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e4dfd3" />
          <stop offset="1" stopColor="#bdb6a8" />
        </linearGradient>
        <filter id="ne-blur" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="40" />
        </filter>
        <filter id="ne-soft">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
      <rect width="1600" height="1000" fill="url(#ne-sky)" />
      {/* piano lontano */}
      <g fill="#a8a193" opacity="0.45" filter="url(#ne-soft)">
        <rect x="560" y="170" width="92" height="520" />
        <path d="M548 170 L606 70 L664 170 Z" />
        <rect x="575" y="200" width="62" height="60" fill="#968f80" />
        <path d="M760 690 L760 470 L1300 470 L1300 690 Z" />
        {[820, 950, 1080, 1210].map((x) => (
          <path key={x} d={`M${x - 60} 470 Q${x} 360 ${x + 60} 470 Z`} />
        ))}
      </g>
      {/* Procuratie: arcate */}
      <g fill="#9a9384" opacity="0.55" filter="url(#ne-soft)">
        <rect x="0" y="520" width="520" height="190" />
        {Array.from({ length: 11 }).map((_, i) => (
          <path key={i} d={`M${14 + i * 46} 710 L${14 + i * 46} 620 Q${34 + i * 46} 590 ${54 + i * 46} 620 L${54 + i * 46} 710 Z`} fill="#c9c2b3" />
        ))}
      </g>
      {/* pavimento della piazza */}
      <rect y="700" width="1600" height="300" fill="#b3ac9e" />
      <g stroke="#a39c8d" strokeWidth="3" opacity="0.6">
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={i} x1={800} y1={700} x2={-600 + i * 250} y2={1000} />
        ))}
        <line x1="0" y1="780" x2="1600" y2="780" />
        <line x1="0" y1="880" x2="1600" y2="880" />
      </g>
      {/* nebbia che scorre */}
      <g filter="url(#ne-blur)" fill="#f5f2ea">
        <ellipse className="anim-drift-slow" cx="400" cy="480" rx="700" ry="120" opacity="0.7" />
        <ellipse className="anim-drift" cx="1200" cy="650" rx="800" ry="140" opacity="0.65" />
        <ellipse className="anim-drift-slow" style={{ animationDelay: '-12s' }} cx="800" cy="300" rx="900" ry="160" opacity="0.5" />
      </g>
    </svg>
  );
}

function Colli() {
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <defs>
        <linearGradient id="co-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6d7a1" />
          <stop offset="1" stopColor="#fbecd2" />
        </linearGradient>
        <clipPath id="co-near">
          <path d="M0 760 Q300 620 620 700 T1200 690 T1600 640 L1600 1000 L0 1000 Z" />
        </clipPath>
      </defs>
      <rect width="1600" height="1000" fill="url(#co-sky)" />
      <circle cx="1240" cy="260" r="70" fill="#fff4d6" opacity="0.9" />
      <path d="M0 560 Q180 420 360 500 Q520 380 700 480 Q880 400 1060 470 Q1260 380 1600 480 L1600 1000 L0 1000 Z" fill="#a9b98c" opacity="0.8" />
      <path d="M0 640 Q260 520 520 600 Q760 500 1000 590 Q1280 510 1600 580 L1600 1000 L0 1000 Z" fill="#86a566" />
      <path d="M0 760 Q300 620 620 700 T1200 690 T1600 640 L1600 1000 L0 1000 Z" fill="#6a9249" />
      <g clipPath="url(#co-near)" stroke="#4d7433" strokeWidth="6" opacity="0.55">
        {Array.from({ length: 30 }).map((_, i) => (
          <line key={i} x1={-400 + i * 70} y1={1000} x2={200 + i * 60} y2={620} />
        ))}
      </g>
      {/* villa sul colle */}
      <g transform="translate(980 560)">
        <rect x="0" y="30" width="110" height="60" fill="#f2e3c6" />
        <path d="M-8 32 L55 0 L118 32 Z" fill="#b5533b" />
        <rect x="20" y="48" width="14" height="22" fill="#6b4a33" />
        <rect x="48" y="48" width="14" height="22" fill="#6b4a33" />
        <rect x="76" y="48" width="14" height="22" fill="#6b4a33" />
      </g>
      {[[860, 560], [890, 575], [1150, 590], [300, 610], [330, 620]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="14" ry="62" fill="#2f4f2a" />
      ))}
      <g className="anim-drift-slow" fill="#fff" opacity="0.5">
        <ellipse cx="400" cy="200" rx="160" ry="24" />
        <ellipse cx="900" cy="150" rx="120" ry="18" />
      </g>
    </svg>
  );
}

function Garda() {
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <defs>
        <linearGradient id="ga-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fcfe6" />
          <stop offset="1" stopColor="#eef5ef" />
        </linearGradient>
        <linearGradient id="ga-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#56b4b6" />
          <stop offset="1" stopColor="#1f6f7d" />
        </linearGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#ga-sky)" />
      <path d="M0 560 L180 360 L300 440 L460 250 L620 420 L760 330 L900 470 L1600 470 L1600 600 L0 600 Z" fill="#7d9bb5" />
      <path d="M430 285 L460 250 L495 290 L470 300 Z" fill="#eef4f7" />
      <path d="M800 600 L1000 330 L1120 420 L1260 280 L1420 430 L1600 360 L1600 600 Z" fill="#5f809a" />
      <path d="M1225 320 L1260 280 L1298 326 L1262 334 Z" fill="#eef4f7" />
      <rect y="590" width="1600" height="410" fill="url(#ga-lake)" />
      <g fill="#ffffff">
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} className="anim-shimmer" style={{ animationDelay: `${i * 0.3}s` }} x={(i * 211) % 1540} y={620 + ((i * 83) % 330)} width={60 + (i % 4) * 30} height="4" rx="2" opacity="0.45" />
        ))}
      </g>
      <g className="anim-bob">
        <path d="M1040 700 L1040 560 L1120 700 Z" fill="#fffaf0" />
        <path d="M1030 700 L1030 600 L980 700 Z" fill="#f26b1d" opacity="0.9" />
        <path d="M960 706 Q1050 730 1140 706 L1128 722 Q1050 736 972 722 Z" fill="#4a2d17" />
      </g>
      {/* ulivo in primo piano */}
      <g transform="translate(60 640)">
        <path d="M120 360 Q110 250 140 170 Q150 120 120 90" stroke="#5a4632" strokeWidth="22" fill="none" strokeLinecap="round" />
        {[[80, 60], [150, 40], [210, 90], [110, 130], [190, 150], [40, 120]].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx="80" ry="44" fill={i % 2 ? '#7c9160' : '#90a574'} opacity="0.95" />
        ))}
      </g>
    </svg>
  );
}

function Dolomiti() {
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <defs>
        <linearGradient id="do-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6f7fb2" />
          <stop offset="0.55" stopColor="#e9a99a" />
          <stop offset="1" stopColor="#f6d2b4" />
        </linearGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#do-sky)" />
      {/* enrosadira: pareti rosa */}
      <path d="M0 700 L120 520 L200 560 L260 300 L320 420 L380 220 L440 380 L520 260 L600 520 L700 480 L760 600 L1600 600 L1600 760 L0 760 Z" fill="#e79c8a" />
      <path d="M260 300 L300 700 L200 700 L200 560 Z M380 220 L420 700 L330 700 Z M520 260 L560 700 L480 700 Z" fill="#b86f6b" opacity="0.55" />
      <path d="M820 700 L960 420 L1030 480 L1110 250 L1180 380 L1240 300 L1320 460 L1420 360 L1520 520 L1600 480 L1600 760 L820 760 Z" fill="#d88b7e" />
      <path d="M1110 250 L1150 700 L1060 700 Z M1240 300 L1280 700 L1200 700 Z" fill="#a9625f" opacity="0.5" />
      <path d="M0 720 L1600 700 L1600 820 L0 820 Z" fill="#c9b8a4" opacity="0.7" />
      {/* bosco */}
      <g fill="#2e4a3a">
        {Array.from({ length: 40 }).map((_, i) => {
          const x = i * 42 - 10;
          const h = 90 + ((i * 37) % 60);
          return <path key={i} d={`M${x} 840 L${x + 22} ${840 - h} L${x + 44} 840 Z`} />;
        })}
      </g>
      <path d="M0 830 Q400 800 800 830 T1600 820 L1600 1000 L0 1000 Z" fill="#6c9a55" />
      <path d="M0 900 Q500 870 1000 900 T1600 890 L1600 1000 L0 1000 Z" fill="#5b8a47" />
      <g className="anim-drift-slow" fill="#fff" opacity="0.35">
        <ellipse cx="700" cy="200" rx="200" ry="20" />
        <ellipse cx="1300" cy="150" rx="150" ry="16" />
      </g>
    </svg>
  );
}

const MAP: Record<SceneKey, () => JSX.Element> = {
  tramonto: Tramonto,
  burano: Burano,
  nebbia: Nebbia,
  colli: Colli,
  garda: Garda,
  dolomiti: Dolomiti,
};

export function Scene({ scene }: { scene: SceneKey }) {
  const S = MAP[scene];
  return (
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden>
      <AnimatePresence initial={false}>
        <motion.div key={scene} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.6 }}>
          <S />
        </motion.div>
      </AnimatePresence>
      {/* velo morbido per far risaltare le tessere */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 75% 65% at 50% 52%, rgba(46,28,15,0.10), rgba(46,28,15,0.38) 100%)' }} />
    </div>
  );
}
