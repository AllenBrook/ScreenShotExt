---
title: Haz capturas de sitios web desde la línea de comandos
description: Usa la CLI de OpenScreenShot para guardar capturas PNG con un viewport fijo, de página completa o como salida binaria a stdout.
audience: developers
order: 4
published: 2026-09-18
updated: 2026-10-21
---

La CLI de OpenScreenShot captura una página web como PNG con un navegador compatible con Chrome instalado en tu equipo. Es un paquete aparte de la extensión del navegador. Con Node.js, pnpm y Chrome instalados, ejecuta:

```sh
pnpm dlx openscreenshot shot https://example.com --out screenshot.png --full
```

El comando inicia un navegador headless aparte, navega a la URL, escribe la imagen y cierra el navegador. No se conecta a las pestañas ni al perfil con sesión iniciada de tu navegador habitual.

## Define el viewport de forma explícita

Para una captura del viewport, omite `--full`. El ancho por defecto es de 1280 píxeles y el alto, de 800 píxeles. Define ambos cuando un diseño necesita un tamaño concreto:

```sh
pnpm dlx openscreenshot shot https://example.com --out desktop.png --width 1440 --height 900
pnpm dlx openscreenshot shot https://example.com --out narrow.png --width 390 --height 844
```

El ancho acepta enteros de 200 a 3840; el alto acepta enteros de 200 a 2160. Un viewport estrecho prueba el diseño responsive a ese ancho. No emula la entrada táctil, la proporción de píxeles del dispositivo ni el navegador móvil de un teléfono: la CLI usa un user agent de escritorio.

Añade `--full` para capturar más allá del viewport. La captura de página completa del navegador headless es distinta de la implementación de la extensión, que desplaza y une; no des por hecho que todas las páginas dinámicas se verán igual en ambas.

## Guarda un archivo o escribe a stdout

Sin `--out`, el comando escribe `screenshot.png` en el directorio actual. Usa un nombre de archivo explícito para que los artefactos sean fáciles de identificar. Crea el directorio de salida antes de ejecutar el comando.

`--out -` escribe los bytes PNG a stdout:

```sh
pnpm dlx openscreenshot shot https://example.com --out - > screenshot.png
```

Usa una redirección segura para datos binarios. Una captura local siempre produce PNG; llamar a la salida `capture.jpg` o `capture.pdf` no la convierte. Para imágenes anotadas o salida PDF, usa el [editor de la extensión](/es/docs/#export). Para obtener otros formatos desde la CLI, usa `--cloud` con `--format`, como se explica más abajo.

## Oculta los datos antes de guardar

Tres opciones tapan los datos con recuadros negros en la página antes de la captura, así que los píxeles sin ocultar nunca llegan al PNG. Repite cada opción para añadir más objetivos:

```sh
pnpm dlx openscreenshot shot https://example.com --out safe.png \
  --redact "#account-menu" --redact-pattern email,secret --redact-rect 0,0,200,40
```

`--redact` tapa cada elemento que coincide con un selector CSS, con todos sus hijos. `--redact-pattern` tapa el texto y los valores de formulario que coinciden con `email`, `phone` (de 9 a 15 dígitos) o `secret` (formatos habituales de claves de API y tokens, y hashes largos). `--redact-rect x,y,w,h` tapa un rectángulo en píxeles de la imagen de salida; úsala para canvas, imágenes e iframes de otro origen.

La captura falla con el código de salida 1 y no escribe ningún archivo si un selector no coincide con nada, un rectángulo queda fuera de la imagen o la página mueve un objetivo durante la captura. Los patrones pueden pasar por alto texto dividido entre varios elementos o dibujado en una imagen, así que revisa el PNG antes de compartirlo.

## Renderiza en OpenScreenShot Cloud

[OpenScreenShot Cloud](https://cloud.openscreenshot.app) es una API de capturas alojada y opcional. Con `--cloud`, la página se renderiza en los servidores de Cloud, así que tu equipo no necesita Chrome. El modo local sigue siendo el predeterminado y no necesita cuenta.

Inicia sesión una vez:

```sh
pnpm dlx openscreenshot auth login
```

La orden muestra un código, como `ABCD-EFGH`, y abre `https://cloud.openscreenshot.app/device` en tu navegador. Inicia sesión con el código que Cloud envía a tu correo y luego aprueba el código. La CLI guarda una clave de API en `~/.openscreenshot.json`.

Después, añade `--cloud` a una captura:

```sh
pnpm dlx openscreenshot shot https://example.com --out page.png --full --cloud
pnpm dlx openscreenshot shot https://example.com --out page.pdf --cloud --format pdf
```

Con `--cloud`, `--format` acepta `png`, `jpeg`, `webp`, `pdf`, `html` y `markdown`. `--full`, `--width` y `--height` funcionan igual que en modo local. La CLI toma la clave de API primero de `--key osc_live_…`, después de la variable de entorno `OPENSCREENSHOT_API_KEY` y por último de la clave que guardó `auth login`. `--cloud <url>` u `OPENSCREENSHOT_CLOUD_URL` fijan otra URL base.

Las opciones para ocultar datos también funcionan con `--cloud`. El servidor de Cloud dibuja los recuadros negros antes de devolver la imagen. La ocultación necesita salida PNG, y un selector que no coincide con nada hace fallar la captura sin imagen.

En modo Cloud, la URL y las opciones van a OpenScreenShot Cloud, y la página se renderiza en sus servidores; consulta la [política de privacidad de Cloud](https://cloud.openscreenshot.app/privacy). El modo local no envía nada a OpenScreenShot. El plan gratuito incluye 100 capturas al mes sin tarjeta, y las capturas fallidas son gratis. La [página de precios](https://cloud.openscreenshot.app/pricing) muestra los demás planes, y la [documentación de la API](https://cloud.openscreenshot.app/docs) cubre todas las opciones.

## Resuelve los fallos más comunes

Si no se encuentra Chrome, instálalo o define `CHROME_PATH` con el ejecutable del navegador. Por ejemplo, en un sistema Linux con Chromium instalado en esa ruta:

```sh
CHROME_PATH=/usr/bin/chromium pnpm dlx openscreenshot shot https://example.com --out screenshot.png
```

La navegación espera a `networkidle2` con un tiempo límite de 30 segundos. El comando actual no tiene opciones de espera personalizada, espera por selector, cookies ni inicio de sesión. Una captura correcta tampoco demuestra que la aplicación cargara bien: revisa el PNG en busca de páginas de error, estados de carga y recursos que faltan.

El código de salida 0 indica que el comando de captura terminó, 1 indica un fallo de captura y 2 indica un uso no válido o argumentos validados. Usa esos códigos al encadenar comandos y luego revisa la propia imagen.

Para artefactos repetibles, lee [la guía de capturas en CI](/es/blog/screenshots-for-ci/). Para un flujo dirigido por un agente, consulta [la guía de configuración de MCP](/es/blog/screenshot-mcp-server/). El [código fuente de la CLI](https://github.com/pghqdev/OpenScreenShot/tree/main/mcp/src) es la referencia de las opciones disponibles.
