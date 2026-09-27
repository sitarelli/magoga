/** 54 tessere uniche: indice = riga * 9 + colonna dello sprite sheet */
export const KIND_NAMES = [
  // Riga 1: remi
  '1 remo', '2 remi', '3 remi', '4 remi', '5 remi', '6 remi', '7 remi', '8 remi', '9 remi',
  // Riga 2: Venezia
  'Gondola', 'Leone di San Marco', 'Ponte di Rialto', 'Ponte dei Sospiri', 'Basilica di San Marco',
  'Campanile', 'Palazzo Ducale', 'Madonna della Salute', 'Vaporetto',
  // Riga 3: cicchetti e bicchieri
  'Spritz', 'Prosecco', 'Cicchetto', 'Tiramisù', 'Polenta', 'Radicchio', 'Asiago', 'Vino bianco', 'Vetro di Murano',
  // Riga 4: laguna e feste
  'Case di Burano', 'Merletto', 'Maschera', 'Piume di Carnevale', 'Cappello da gondoliere', 'Regata storica',
  'Fuochi del Redentore', 'Palina', 'Sessola',
  // Riga 5: città venete
  'Arena di Verona', 'Balcone di Giulietta', 'San Zeno', 'Basilica del Santo', 'Prato della Valle',
  'Cappella degli Scrovegni', 'Basilica Palladiana', 'Teatro Olimpico', 'Villa palladiana',
  // Riga 6: natura
  'Dolomiti', 'Lago di Garda', 'Lago', 'Colline del Prosecco', 'Airone', 'Moeca', 'Camoscio', 'Olivo', 'Cavaliere d’Italia',
];

export type KindSound = 'oar' | 'boat' | 'horn' | 'fizz' | 'glass' | 'bell' | 'bird' | 'fireworks' | 'crab' | 'water' | 'default';

export function kindSound(k: number): KindSound {
  if (k <= 8) return 'oar';
  if (k === 17) return 'horn';
  if (k === 9 || k === 32) return 'boat';
  if (k === 18 || k === 19) return 'fizz';
  if (k === 25 || k === 26) return 'glass';
  if (k === 13 || k === 14 || k === 16 || k === 38) return 'bell';
  if (k === 49 || k === 53) return 'bird';
  if (k === 33) return 'fireworks';
  if (k === 50) return 'crab';
  if (k === 34 || k === 35 || k === 46 || k === 47) return 'water';
  return 'default';
}
