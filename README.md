# Magòga

Solitario di tessere rilassante e infinito, ambientato tra Venezia e il Veneto.
Next.js 14 (App Router) + TypeScript + Tailwind + Framer Motion. Nessuna variabile d'ambiente.

## Avvio
```bash
npm install
npm run dev     # http://localhost:3000
```
Deploy: importa la cartella su Vercel (framework Next.js rilevato in automatico) oppure `npx vercel`.

## Struttura
- `public/tiles.png` sprite sheet 9x6 (54 tessere uniche)
- `lib/spriteSplitter.ts` taglio in canvas (cella width/9 x height/6), rifilatura del bordo bianco e dell'ombra, angoli trasparenti
- `lib/layout.ts` livelli: piano, poi piramidi sempre più alte con forme a rotazione (rombo, ponte, torri, croce, anello, isola); in verticale su mobile la griglia ruota
- `lib/board.ts` regole (tessera libera = non coperta e con un lato libero), distribuzione sempre risolvibile, rimescolo risolvibile
- `lib/sound.ts` audio procedurale Web Audio: ambienti (laguna, nebbia con campane, colli con uccellini, montagna con vento e campanacci), vaporetto e gabbiani lontani, bambù, cin cin di spritz e prosecco, verso del magòga
- `components/Scene.tsx` sei paesaggi in SVG animato
- `components/Magoga.tsx` il gabbiano e l'animazione di fine livello
- Progressi e record in localStorage (`magoga.progress.v1`), audio muto in `magoga.muted`
