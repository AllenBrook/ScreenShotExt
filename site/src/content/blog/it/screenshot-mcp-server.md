---
title: Configura un server MCP locale per screenshot per un agente AI
description: Collega OpenScreenShot a un client MCP stdio e richiedi screenshot PNG con opzioni esplicite per URL, viewport e pagina intera.
audience: developers
order: 5
published: 2026-09-18
updated: 2026-10-21
---

OpenScreenShot offre un server MCP locale con un solo strumento: `capture_screenshot`. Un client MCP può chiamarlo con l’URL di una pagina web e ricevere un’immagine PNG. Per impostazione predefinita, il server avvia sul tuo computer un browser headless separato compatibile con Chrome; l’estensione per il browser non è necessaria.

## Aggiungi il server al tuo client MCP

Installa prima Node.js, pnpm e un browser compatibile con Chrome. Aggiungi una voce per il server nel formato di configurazione del tuo client. I client che accettano un oggetto `mcpServers` possono usare:

```json
{
  "mcpServers": {
    "openscreenshot": {
      "command": "pnpm",
      "args": ["dlx", "openscreenshot"]
    }
  }
}
```

Il client deve riuscire a trovare `pnpm` nel suo percorso degli eseguibili. Riavvia o ricarica le sue connessioni MCP dopo aver salvato la configurazione. Il server usa stdio, quindi il client avvia un processo locale e non c’è un URL da inserire. Per i client che accettano solo URL MCP remoti, OpenScreenShot Cloud offre un endpoint remoto, descritto più sotto.

Se Chrome è installato in una posizione insolita, passa `CHROME_PATH` tramite la configurazione dell’ambiente del client. Usa il percorso completo dell’eseguibile, invece della cartella che contiene l’applicazione.

## Chiama capture_screenshot

Un input minimo per lo strumento è:

```json
{ "url": "https://example.com" }
```

Questo produce una cattura della viewport alla dimensione predefinita di 1280 × 800. Imposta in modo esplicito la viewport e l’opzione pagina intera per una richiesta riproducibile:

```json
{
  "url": "https://example.com",
  "fullPage": true,
  "width": 1440,
  "height": 900
}
```

`width` accetta numeri interi da 200 a 3840 e `height` da 200 a 2160. Lo strumento restituisce un contenuto immagine MCP con tipo MIME `image/png`. Questo strumento non ha un argomento per il percorso di output. Se il risultato viene mostrato o salvato dipende dal client; usa la [CLI](/it/blog/screenshot-cli/) quando ti serve direttamente un file con un nome.

## Oscura i dati prima che l’immagine lasci lo strumento

Aggiungi un oggetto `redact` per coprire i dati con riquadri neri nella pagina prima dello screenshot. Il client riceve solo l’immagine oscurata:

```json
{
  "url": "https://example.com",
  "redact": {
    "selectors": ["#account-menu"],
    "patterns": ["email", "phone", "secret"],
    "rects": [{ "x": 0, "y": 0, "width": 200, "height": 40 }]
  }
}
```

`selectors` copre ogni elemento corrispondente, con tutti i suoi figli. `patterns` copre testo e valori dei moduli corrispondenti: `email`, `phone` (da 9 a 15 cifre) e `secret` (formati comuni di chiavi API e token, e hash lunghi). `rects` copre rettangoli in pixel dell’immagine di output, per canvas, immagini e iframe cross-origin. Lo strumento restituisce un errore e nessuna immagine se un selettore non trova corrispondenze, se un rettangolo è fuori dall’immagine o se la pagina sposta un target durante la cattura. I pattern possono non rilevare testo diviso tra più elementi o disegnato in un’immagine.

## Renderizza su OpenScreenShot Cloud

Aggiungi `cloud: true` per renderizzare la pagina su [OpenScreenShot Cloud](https://cloud.openscreenshot.app), un’API di screenshot ospitata e opzionale, invece che nel Chrome locale:

```json
{ "url": "https://example.com", "fullPage": true, "cloud": true }
```

La modalità Cloud richiede una chiave API. Esegui una volta `pnpm dlx openscreenshot auth login` per salvarne una, oppure imposta `OPENSCREENSHOT_API_KEY` nella configurazione dell’ambiente del server, nel client. `redact` funziona in entrambe le modalità. In modalità Cloud, il server di Cloud disegna i riquadri neri prima di restituire l’immagine.

Cloud offre anche un endpoint MCP remoto via Streamable HTTP all’indirizzo `https://cloud.openscreenshot.app/mcp`, con lo stesso strumento `capture_screenshot`. Invia la chiave API in un header `Authorization: Bearer <key>`. Usalo con i client che accettano solo URL MCP remoti. Il piano gratuito offre 100 catture al mese senza carta; la [pagina dei prezzi](https://cloud.openscreenshot.app/pricing) elenca gli altri piani.

## Cosa l’agente può e non può vedere

La cattura parte in un browser headless nuovo. Non eredita i cookie né la sessione con accesso della tua normale finestra di Chrome. Una pagina dietro autenticazione può quindi produrre una schermata di login. Lo strumento attuale non offre passaggi di login, iniezione di cookie, attese su selettori o clic interattivi.

Chiedi all’agente di identificare cosa è visibile davvero nell’immagine restituita prima di trarre conclusioni. Uno screenshot può aiutare a controllare layout, spaziature ed errori visibili; non può stabilire che un modulo venga inviato correttamente o che la navigazione da tastiera funzioni.

## Dove va a finire lo screenshot?

Per impostazione predefinita, lo screenshot viene generato in locale e restituito al client MCP. Se quel client usa un modello ospitato, può trasmettere l’immagine restituita al fornitore del modello secondo le proprie impostazioni. La cattura locale non implica che l’intera conversazione con l’agente resti sul dispositivo. Usa `redact` per i dati che non devono arrivare al fornitore. Con `cloud: true`, l’URL e le opzioni vanno a OpenScreenShot Cloud, e la pagina viene renderizzata sui suoi server; vedi l’[informativa sulla privacy di Cloud](https://cloud.openscreenshot.app/privacy).

Per catture automatiche con dimensioni prevedibili, vedi [screenshot per la CI](/it/blog/screenshots-for-ci/). La [skill di cattura per agenti](/skills/capture-screenshot.md) e il [sorgente del server](https://github.com/pghqdev/OpenScreenShot/blob/main/mcp/src/serve.ts) forniscono le istruzioni pensate per le macchine e la definizione dello strumento. Il server è anche elencato su [Glama](https://glama.ai/mcp/servers/PGHQdev/OpenScreenShot).
