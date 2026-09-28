/** 54 tessere uniche: indice = riga * 9 + colonna dello sprite sheet */
const num = (n: string, what: string) => Array.from({ length: 9 }, (_, i) => `${i + 1} ${i ? what.split('|')[1] : what.split('|')[0]} ${n}`.trim());

export const KIND_NAMES = [
  // Riga 1: bricole 1..9
  ...num('', 'bricola|bricole'),
  // Riga 2: ciambelle 1..9
  ...num('', 'ciambella|ciambelle'),
  // Riga 3: grappoli 1..9
  ...num('', 'grappolo|grappoli'),
  // Riga 4
  'Ferro di gondola', 'Leone di San Marco', 'Gabbiano', 'Stella', 'Spritz', 'Bauta', 'Forcola', 'Tramezzino', 'Corno dogale',
  // Riga 5
  'Radicchio', 'Medico della peste', 'Scudo crociato', 'Leone rampante', 'Dolomiti', 'Pane', 'Moeca', 'Rosa dei venti', 'Esse di Burano',
  // Riga 6
  'Ponte di Rialto', 'Arena di Verona', 'Colombina', 'Foglia di vite', 'Campanile', 'Gondola', 'Prosecco', 'Fenicottero', 'Rosone',
];

export type KindSound = 'oar' | 'boat' | 'horn' | 'fizz' | 'glass' | 'bell' | 'bird' | 'gull' | 'sparkle' | 'crab' | 'water' | 'default';

export function kindSound(k: number): KindSound {
  if (k <= 8) return 'oar'; // bricole: legno nell'acqua
  if (k <= 17) return 'water'; // ciambelle / salvagenti
  if (k <= 26) return 'default'; // grappoli
  if (k === 27 || k === 33 || k === 50) return 'boat';
  if (k === 29) return 'gull';
  if (k === 52) return 'bird';
  if (k === 31 || k === 51) return 'fizz';
  if (k === 35) return 'horn';
  if (k === 49 || k === 53) return 'bell';
  if (k === 30 || k === 43) return 'sparkle';
  if (k === 42) return 'crab';
  return 'default';
}
