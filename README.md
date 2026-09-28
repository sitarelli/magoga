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
- `lib/spriteSplitter.ts` taglio in canvas (cella width/9 x height/6): con sfondo trasparente usa l'alpha per bordi puliti, poi cuoce su ogni tessera spessore 3D e ombra morbida
- `lib/layout.ts` livelli: piano, poi piramidi sempre più alte con forme a rotazione (rombo, ponte, torri, croce, anello, isola); in verticale su mobile la griglia ruota
- `lib/board.ts` regole (tessera libera = non coperta e con un lato libero), distribuzione sempre risolvibile, rimescolo risolvibile
- `lib/sound.ts` motore audio: riproduce buffer pre-renderizzati (vedi sezione Audio); ambienti (laguna, nebbia con campane, colli con uccellini, montagna con vento e campanacci), vaporetto e gabbiani lontani, bambù, cin cin di spritz e prosecco, verso del magòga
- `components/Scene.tsx` sei paesaggi in SVG animato
- `components/Magoga.tsx` il gabbiano e l'animazione di fine livello
- Progressi e record separati per modalità in localStorage (`magoga.progress.v2`), audio muto in `magoga.muted`

## Audio e prestazioni su mobile
L'audio è sempre procedurale (nessun file audio), ma non viene più sintetizzato al momento del tocco:
- `lib/recipes.ts` descrive ogni suono (bambù, campanelle, cin cin, gabbiano, eventi degli ambienti...) e `lib/synth.ts` contiene i mattoncini di sintesi.
- `lib/bake.ts` li esegue **una volta** su un `OfflineAudioContext` (thread di rendering separato), 2 alla volta, all'avvio della pagina, prima i suoni delle tessere. Compressore e riverbero sono cotti dentro ai buffer (circa 17 MB in RAM, 8 s per completare su un telefono lento).
- `lib/sound.ts` in partita crea un solo `AudioBufferSourceNode` per suono. Restano vivi solo uno o due strati di rumore filtrato per l'atmosfera (uno solo sui dispositivi con 4 core o meno), spenti se metti il mute. Limite di 14 voci contemporanee e anti-ripetizione sui suoni rapidi.
- Le tessere usano solo animazioni CSS, sono memoizzate e i filtri CSS sono sostituiti da due varianti dello sprite (libera / in ombra) cotte in canvas e servite come blob URL. Il timer della Sfida aggiorna solo la propria barra, non tutta la plancia.
