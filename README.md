# Magòga

Solitario di tessere rilassante e infinito, ambientato tra Venezia e il Veneto.
Next.js 14 (App Router) + TypeScript + Tailwind + Framer Motion. Nessuna variabile d'ambiente.

## Avvio
```bash
npm install
npm run dev     # http://localhost:3000
```
Deploy: importa la cartella su Vercel (framework Next.js rilevato in automatico) oppure `npx vercel`.

## Modalità
- **Zen**: nessun limite di tempo, con Suggerimento, Mescola e Annulla.
- **Sfida**: il tempo scende (sempre un po' più veloce a ogni livello). Ogni coppia ricarica 2 s, e le coppie fatte a meno di 4 s l'una dall'altra ne danno di più (fino a +6,8 s). Suggerimento e Mescola costano 5 s, Annulla non c'è. Il tempo avanzato diventa bonus punti.
- **Colpo da maestro** (entrambe): 5 coppie entro 9 secondi, senza suggerimenti, fanno esplodere i coriandoli (+50 punti, +5 s in Sfida).

## Struttura
- `public/tiles.png` sprite sheet 9x6 (54 tessere uniche)
- `lib/spriteSplitter.ts` taglio in canvas (cella width/9 x height/6), rifilatura del bordo bianco e dell'ombra, angoli trasparenti
- `lib/layout.ts` livelli: piano, poi piramidi sempre più alte con forme a rotazione (rombo, ponte, torri, croce, anello, isola); in verticale su mobile la griglia ruota
- `lib/board.ts` regole (tessera libera = non coperta e con un lato libero), distribuzione sempre risolvibile, rimescolo risolvibile
- `lib/sound.ts` audio procedurale Web Audio: ambienti (laguna, nebbia con campane, colli con uccellini, montagna con vento e campanacci), vaporetto e gabbiani lontani, bambù, cin cin di spritz e prosecco, verso del magòga
- `components/Scene.tsx` sei paesaggi in SVG animato
- `components/Magoga.tsx` il gabbiano e l'animazione di fine livello
- Progressi e record separati per modalità in localStorage (`magoga.progress.v2`), audio muto in `magoga.muted`
