---
title: Fai screenshot di siti web dalla riga di comando
description: Usa la CLI di OpenScreenShot per salvare screenshot PNG con una viewport fissa, la cattura a pagina intera o l’output binario su stdout.
audience: developers
order: 4
published: 2026-09-18
updated: 2026-10-21
---

La CLI di OpenScreenShot cattura una pagina web in PNG usando un browser compatibile con Chrome installato in locale. È un pacchetto separato dall’estensione per il browser. Con Node.js, pnpm e Chrome installati, esegui:

```sh
pnpm dlx openscreenshot shot https://example.com --out screenshot.png --full
```

Il comando avvia un browser headless separato, apre l’URL, scrive l’immagine e chiude il browser. Non si collega alle schede o al profilo con accesso del browser che usi ogni giorno.

## Imposta la viewport in modo esplicito

Per uno screenshot della viewport, ometti `--full`. La larghezza predefinita è 1280 pixel e l’altezza predefinita è 800 pixel. Imposta entrambe quando un layout ha bisogno di una dimensione precisa:

```sh
pnpm dlx openscreenshot shot https://example.com --out desktop.png --width 1440 --height 900
pnpm dlx openscreenshot shot https://example.com --out narrow.png --width 390 --height 844
```

La larghezza accetta numeri interi da 200 a 3840; l’altezza accetta numeri interi da 200 a 2160. Una viewport stretta verifica il layout responsive a quella larghezza. Non emula l’input touch di un telefono, il rapporto di pixel del dispositivo o un browser mobile: la CLI usa uno user agent desktop.

Aggiungi `--full` per catturare oltre la viewport. La cattura a pagina intera del browser headless è diversa dall’implementazione a scorrimento e unione dell’estensione; non dare per scontato che ogni pagina dinamica appaia identica in entrambi i casi.

## Salva un file o scrivi su stdout

Senza `--out`, il comando scrive `screenshot.png` nella directory corrente. Usa un nome file esplicito per rendere gli artefatti facili da identificare. Crea l’eventuale directory di output superiore prima di eseguire il comando.

`--out -` scrive i byte PNG su stdout:

```sh
pnpm dlx openscreenshot shot https://example.com --out - > screenshot.png
```

Usa un reindirizzamento sicuro per i dati binari. Una cattura locale produce sempre PNG; chiamare l’output `capture.jpg` o `capture.pdf` non lo converte. Per immagini annotate o output PDF, usa l’[editor dell’estensione](/it/docs/#export). Per altri formati dalla CLI, usa `--cloud` con `--format`, come descritto più sotto.

## Oscura prima di salvare

Tre flag coprono i dati con riquadri neri nella pagina prima dello screenshot, così i pixel non oscurati non arrivano mai nel PNG. Ripeti ogni flag per aggiungere altri target:

```sh
pnpm dlx openscreenshot shot https://example.com --out safe.png \
  --redact "#account-menu" --redact-pattern email,secret --redact-rect 0,0,200,40
```

`--redact` copre ogni elemento che corrisponde a un selettore CSS, con tutti i suoi figli. `--redact-pattern` copre testo e valori dei moduli che corrispondono a `email`, `phone` (da 9 a 15 cifre) o `secret` (formati comuni di chiavi API e token, e hash lunghi). `--redact-rect x,y,w,h` copre un rettangolo in pixel dell’immagine di output; usalo per canvas, immagini e iframe cross-origin.

La cattura fallisce con codice di uscita 1 e non scrive alcun file se un selettore non trova corrispondenze, se un rettangolo è fuori dall’immagine o se la pagina sposta un target durante la cattura. I pattern possono non rilevare testo diviso tra più elementi o disegnato in un’immagine, quindi controlla il PNG prima di condividerlo.

## Renderizza su OpenScreenShot Cloud

[OpenScreenShot Cloud](https://cloud.openscreenshot.app) è un’API di screenshot ospitata e opzionale. Con `--cloud`, la pagina viene renderizzata sui server di Cloud, quindi sul computer non serve Chrome. La modalità locale resta quella predefinita e non richiede un account.

Accedi una volta:

```sh
pnpm dlx openscreenshot auth login
```

Il comando mostra un codice, come `ABCD-EFGH`, e apre `https://cloud.openscreenshot.app/device` nel browser. Accedi con il codice che Cloud invia alla tua email, poi approva il codice. La CLI salva una chiave API in `~/.openscreenshot.json`.

Poi aggiungi `--cloud` a una cattura:

```sh
pnpm dlx openscreenshot shot https://example.com --out page.png --full --cloud
pnpm dlx openscreenshot shot https://example.com --out page.pdf --cloud --format pdf
```

Con `--cloud`, `--format` accetta `png`, `jpeg`, `webp`, `pdf`, `html` e `markdown`. `--full`, `--width` e `--height` funzionano come in modalità locale. La CLI prende la chiave API prima da `--key osc_live_…`, poi dalla variabile d’ambiente `OPENSCREENSHOT_API_KEY`, infine dalla chiave salvata da `auth login`. `--cloud <url>` o `OPENSCREENSHOT_CLOUD_URL` imposta un altro URL di base.

I flag di oscuramento funzionano anche con `--cloud`. Il server di Cloud disegna i riquadri neri prima di restituire l’immagine. L’oscuramento richiede l’output PNG, e un selettore che non trova nulla fa fallire la cattura senza immagine.

In modalità Cloud, l’URL e le opzioni vanno a OpenScreenShot Cloud, e la pagina viene renderizzata sui suoi server; vedi l’[informativa sulla privacy di Cloud](https://cloud.openscreenshot.app/privacy). La modalità locale non invia nulla a OpenScreenShot. Il piano gratuito offre 100 catture al mese senza carta, e le catture non riuscite sono gratuite. La [pagina dei prezzi](https://cloud.openscreenshot.app/pricing) elenca gli altri piani, e la [documentazione dell’API](https://cloud.openscreenshot.app/docs) descrive ogni opzione.

## Risolvi gli errori comuni

Se Chrome non viene trovato, installalo o imposta `CHROME_PATH` sull’eseguibile del browser. Per esempio, su un sistema Linux dove Chromium è installato in quel percorso:

```sh
CHROME_PATH=/usr/bin/chromium pnpm dlx openscreenshot shot https://example.com --out screenshot.png
```

La navigazione aspetta `networkidle2` con un timeout di 30 secondi. Il comando attuale non ha opzioni per attese personalizzate, attese su selettori, cookie o login. Una cattura riuscita non dimostra nemmeno che l’applicazione si sia caricata correttamente: controlla nel PNG pagine di errore, stati di caricamento e risorse mancanti.

Il codice di uscita 0 indica che il comando di cattura è stato completato, 1 indica un errore di cattura e 2 indica un uso non valido o argomenti non validi. Usa questi codici quando concateni i comandi, poi controlla l’immagine stessa.

Per artefatti ripetibili, leggi [la guida alla cattura in CI](/it/blog/screenshots-for-ci/). Per un flusso guidato da un agente, vedi [la guida alla configurazione MCP](/it/blog/screenshot-mcp-server/). Il [sorgente della CLI](https://github.com/pghqdev/OpenScreenShot/tree/main/mcp/src) è il riferimento per i flag disponibili.
