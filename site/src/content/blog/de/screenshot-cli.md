---
title: Website-Screenshots über die Kommandozeile aufnehmen
description: Speichere PNG-Screenshots mit der OpenScreenShot-CLI mit festem Viewport, als Ganzseiten-Aufnahme oder als Binärausgabe nach stdout.
audience: developers
order: 4
published: 2026-09-18
updated: 2026-10-21
---

Die OpenScreenShot-CLI nimmt eine Webseite als PNG auf und nutzt dafür einen lokal installierten Chrome-kompatiblen Browser. Sie ist ein von der Browsererweiterung getrenntes Paket. Wenn Node.js, pnpm und Chrome installiert sind, führe aus:

```sh
pnpm dlx openscreenshot shot https://example.com --out screenshot.png --full
```

Der Befehl startet einen separaten Headless-Browser, ruft die URL auf, schreibt das Bild und schließt den Browser. Er hängt sich nicht an die Tabs oder das angemeldete Profil deines alltäglichen Browsers.

## Den Viewport ausdrücklich festlegen

Für einen Viewport-Screenshot lässt du `--full` weg. Die Breite ist standardmäßig 1280 Pixel, die Höhe 800 Pixel. Setze beide, wenn ein Layout eine bestimmte Größe braucht:

```sh
pnpm dlx openscreenshot shot https://example.com --out desktop.png --width 1440 --height 900
pnpm dlx openscreenshot shot https://example.com --out narrow.png --width 390 --height 844
```

Die Breite akzeptiert Ganzzahlen von 200 bis 3840, die Höhe Ganzzahlen von 200 bis 2160. Ein schmaler Viewport testet das responsive Layout bei dieser Breite. Er emuliert weder die Touch-Eingabe noch das Pixelverhältnis oder den mobilen Browser eines Smartphones: Die CLI nutzt einen Desktop-User-Agent.

Füge `--full` hinzu, um über den Viewport hinaus aufzunehmen. Die Ganzseiten-Aufnahme des Headless-Browsers unterscheidet sich von der Scroll-und-Zusammensetzen-Methode der Erweiterung; geh nicht davon aus, dass jede dynamische Seite in beiden gleich aussieht.

## In eine Datei speichern oder nach stdout schreiben

Ohne `--out` schreibt der Befehl `screenshot.png` ins aktuelle Verzeichnis. Nutze einen ausdrücklichen Dateinamen, damit Artefakte leicht zu erkennen sind. Lege übergeordnete Ausgabeverzeichnisse an, bevor du den Befehl ausführst.

`--out -` schreibt PNG-Bytes nach stdout:

```sh
pnpm dlx openscreenshot shot https://example.com --out - > screenshot.png
```

Nutze eine binärsichere Umleitung. Eine lokale Aufnahme erzeugt immer PNG; die Ausgabe `capture.jpg` oder `capture.pdf` zu nennen, wandelt sie nicht um. Für kommentierte Bilder oder PDF-Ausgabe nutze den [Editor der Erweiterung](/de/docs/#export). Andere Formate liefert die CLI mit `--cloud` und `--format`, wie unten beschrieben.

## Vor dem Speichern schwärzen

Drei Flags decken Daten vor dem Screenshot mit schwarzen Kästen auf der Seite ab, sodass die ungeschwärzten Pixel nie ins PNG gelangen. Wiederhole jedes Flag für weitere Ziele:

```sh
pnpm dlx openscreenshot shot https://example.com --out safe.png \
  --redact "#account-menu" --redact-pattern email,secret --redact-rect 0,0,200,40
```

`--redact` deckt jedes Element ab, das zu einem CSS-Selektor passt, mit allen seinen Kindelementen. `--redact-pattern` deckt Text und Formularwerte ab, die zu `email`, `phone` (9 bis 15 Ziffern) oder `secret` (übliche Formen von API-Schlüsseln und Tokens sowie lange Hashes) passen. `--redact-rect x,y,w,h` deckt ein Rechteck in Pixeln des Ausgabebilds ab; nutze es für Canvas, Bilder und Cross-Origin-iframes.

Die Aufnahme schlägt mit Exit-Code 1 fehl und schreibt keine Datei, wenn ein Selektor nichts trifft, ein Rechteck außerhalb des Bilds liegt oder die Seite während der Aufnahme ein Ziel verschiebt. Muster können Text übersehen, der über mehrere Elemente verteilt oder in einem Bild gezeichnet ist; sieh dir das PNG also an, bevor du es teilst.

## Auf OpenScreenShot Cloud rendern

[OpenScreenShot Cloud](https://cloud.openscreenshot.app) ist eine optionale gehostete Screenshot-API. Mit `--cloud` wird die Seite auf Cloud-Servern gerendert, dein Rechner braucht also kein Chrome. Der lokale Modus bleibt der Standard und braucht kein Konto.

Melde dich einmal an:

```sh
pnpm dlx openscreenshot auth login
```

Der Befehl zeigt einen Code wie `ABCD-EFGH` an und öffnet `https://cloud.openscreenshot.app/device` in deinem Browser. Melde dich mit dem Code an, den Cloud dir per E-Mail schickt, und bestätige dann den Code. Die CLI speichert einen API-Schlüssel in `~/.openscreenshot.json`.

Füge dann `--cloud` zu einer Aufnahme hinzu:

```sh
pnpm dlx openscreenshot shot https://example.com --out page.png --full --cloud
pnpm dlx openscreenshot shot https://example.com --out page.pdf --cloud --format pdf
```

Mit `--cloud` akzeptiert `--format` die Werte `png`, `jpeg`, `webp`, `pdf`, `html` und `markdown`. `--full`, `--width` und `--height` funktionieren wie im lokalen Modus. Die CLI nimmt den API-Schlüssel zuerst aus `--key osc_live_…`, dann aus der Umgebungsvariable `OPENSCREENSHOT_API_KEY` und dann aus dem Schlüssel, den `auth login` gespeichert hat. `--cloud <url>` oder `OPENSCREENSHOT_CLOUD_URL` legt eine andere Basis-URL fest.

Die Flags zum Schwärzen funktionieren auch mit `--cloud`. Der Cloud-Server zeichnet die schwarzen Kästen, bevor er das Bild zurückgibt. Das Schwärzen braucht PNG als Ausgabe, und ein Selektor ohne Treffer lässt die Aufnahme ohne Bild fehlschlagen.

Im Cloud-Modus gehen die URL und die Optionen an OpenScreenShot Cloud, und die Seite wird auf dessen Servern gerendert; siehe die [Datenschutzerklärung von Cloud](https://cloud.openscreenshot.app/privacy). Der lokale Modus sendet nichts an OpenScreenShot. Der kostenlose Plan bietet 100 Aufnahmen pro Monat ohne Kreditkarte, und fehlgeschlagene Aufnahmen sind kostenlos. Die [Preisseite](https://cloud.openscreenshot.app/pricing) listet die weiteren Pläne, und die [API-Dokumentation](https://cloud.openscreenshot.app/docs) beschreibt jede Option.

## Häufige Fehler beheben

Wird Chrome nicht gefunden, installiere es oder setze `CHROME_PATH` auf die ausführbare Datei des Browsers. Zum Beispiel auf einem Linux-System, auf dem Chromium unter diesem Pfad installiert ist:

```sh
CHROME_PATH=/usr/bin/chromium pnpm dlx openscreenshot shot https://example.com --out screenshot.png
```

Die Navigation wartet auf `networkidle2` mit einem Timeout von 30 Sekunden. Der aktuelle Befehl hat keine Optionen für eigene Wartezeiten, das Warten auf Selektoren, Cookies oder Logins. Eine erfolgreiche Aufnahme beweist auch nicht, dass die Anwendung richtig geladen hat: Prüfe das PNG auf Fehlerseiten, Ladezustände und fehlende Assets.

Exit-Code 0 bedeutet, dass der Aufnahmebefehl durchgelaufen ist, 1 bedeutet einen Aufnahmefehler und 2 eine ungültige Verwendung oder ungültige Argumente nach der Prüfung. Nutze diese Codes beim Verketten von Befehlen und prüfe danach das Bild selbst.

Für wiederholbare Artefakte lies [die Anleitung zu Aufnahmen in CI](/de/blog/screenshots-for-ci/). Für einen agentengesteuerten Ablauf siehe [die Anleitung zur MCP-Einrichtung](/de/blog/screenshot-mcp-server/). Der [CLI-Quellcode](https://github.com/pghqdev/OpenScreenShot/tree/main/mcp/src) ist die Referenz für die verfügbaren Flags.
