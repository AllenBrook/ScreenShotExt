---
title: Configura un servidor MCP local de capturas para un agente de IA
description: Conecta OpenScreenShot a un cliente MCP por stdio y pide capturas PNG con opciones explícitas de URL, viewport y página completa.
audience: developers
order: 5
published: 2026-09-18
updated: 2026-10-21
---

OpenScreenShot ofrece un servidor MCP local con una sola herramienta: `capture_screenshot`. Un cliente MCP puede llamarla con la URL de una página web y recibir contenido de imagen PNG. Por defecto, el servidor lanza un navegador headless aparte compatible con Chrome en tu equipo; no necesitas la extensión del navegador.

## Añade el servidor a tu cliente MCP

Instala primero Node.js, pnpm y un navegador compatible con Chrome. Añade una entrada de servidor con el formato de configuración de tu cliente. Los clientes que aceptan un objeto `mcpServers` pueden usar:

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

El cliente tiene que poder encontrar `pnpm` en su ruta de ejecutables. Reinicia o recarga sus conexiones MCP después de guardar la configuración. El servidor usa stdio, así que el cliente inicia un proceso local y no hay ninguna URL que introducir. Para clientes que solo aceptan URL de MCP remotas, OpenScreenShot Cloud tiene un endpoint remoto, descrito más abajo.

Si Chrome está instalado en un lugar poco habitual, pasa `CHROME_PATH` mediante la configuración de entorno del cliente. Usa la ruta completa al ejecutable, no la carpeta que contiene la aplicación.

## Llama a capture_screenshot

Una entrada mínima de la herramienta es:

```json
{ "url": "https://example.com" }
```

Esto produce una captura del viewport con el tamaño por defecto de 1280 × 800. Define el viewport y la opción de página completa de forma explícita para una petición reproducible:

```json
{
  "url": "https://example.com",
  "fullPage": true,
  "width": 1440,
  "height": 900
}
```

`width` acepta enteros de 200 a 3840 y `height` de 200 a 2160. La herramienta devuelve contenido de imagen MCP con el tipo MIME `image/png`. Esta herramienta no tiene ningún argumento de ruta de salida. Que el resultado se muestre o se guarde depende del cliente; usa la [CLI](/es/blog/screenshot-cli/) cuando necesites directamente un archivo con nombre.

## Oculta los datos antes de que la imagen salga de la herramienta

Añade un objeto `redact` para tapar los datos con recuadros negros en la página antes de la captura. El cliente recibe solo la imagen con los datos ocultos:

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

`selectors` tapa cada elemento que coincide, con todos sus hijos. `patterns` tapa el texto y los valores de formulario que coinciden: `email`, `phone` (de 9 a 15 dígitos) y `secret` (formatos habituales de claves de API y tokens, y hashes largos). `rects` tapa rectángulos en píxeles de la imagen de salida, para canvas, imágenes e iframes de otro origen. La herramienta devuelve un error y ninguna imagen si un selector no coincide con nada, un rectángulo queda fuera de la imagen o la página mueve un objetivo durante la captura. Los patrones pueden pasar por alto texto dividido entre varios elementos o dibujado en una imagen.

## Renderiza en OpenScreenShot Cloud

Añade `cloud: true` para renderizar la página en [OpenScreenShot Cloud](https://cloud.openscreenshot.app), una API de capturas alojada y opcional, en lugar del Chrome local:

```json
{ "url": "https://example.com", "fullPage": true, "cloud": true }
```

El modo Cloud necesita una clave de API. Ejecuta `pnpm dlx openscreenshot auth login` una vez para guardarla, o define `OPENSCREENSHOT_API_KEY` en la configuración de entorno del servidor en el cliente. `redact` funciona en los dos modos. En modo Cloud, el servidor de Cloud dibuja los recuadros negros antes de devolver la imagen.

Cloud también ofrece un endpoint MCP remoto por Streamable HTTP en `https://cloud.openscreenshot.app/mcp`, con la misma herramienta `capture_screenshot`. Envía la clave de API en una cabecera `Authorization: Bearer <key>`. Úsalo con clientes que solo aceptan URL de MCP remotas. El plan gratuito incluye 100 capturas al mes sin tarjeta; la [página de precios](https://cloud.openscreenshot.app/pricing) muestra los demás planes.

## Qué puede ver el agente y qué no

La captura empieza en un navegador headless nuevo. No hereda las cookies ni la sesión iniciada de tu ventana normal de Chrome. Por eso, una página que requiere autenticación puede mostrar una pantalla de inicio de sesión. La herramienta actual no ofrece pasos de inicio de sesión, inyección de cookies, esperas por selector ni clics interactivos.

Pide al agente que identifique qué se ve de verdad en la imagen devuelta antes de sacar conclusiones. Una captura ayuda a revisar el diseño, los espaciados y los errores visibles; no puede demostrar que un formulario se envía bien ni que la navegación por teclado funciona.

## ¿Adónde va la captura?

Por defecto, la captura se genera localmente y se devuelve al cliente MCP. Si ese cliente usa un modelo alojado, puede transmitir la imagen devuelta al proveedor del modelo según su propia configuración. Que la captura sea local no implica que toda la conversación con el agente se quede en el dispositivo. Usa `redact` para los datos que no deben llegar al proveedor. Con `cloud: true`, la URL y las opciones van a OpenScreenShot Cloud, y la página se renderiza en sus servidores; consulta la [política de privacidad de Cloud](https://cloud.openscreenshot.app/privacy).

Para capturas automatizadas con dimensiones predecibles, consulta [capturas para CI](/es/blog/screenshots-for-ci/). La [skill de captura para agentes](/skills/capture-screenshot.md) y el [código fuente del servidor](https://github.com/pghqdev/OpenScreenShot/blob/main/mcp/src/serve.ts) contienen las instrucciones orientadas a máquinas y la definición de la herramienta. El servidor también aparece en [Glama](https://glama.ai/mcp/servers/PGHQdev/OpenScreenShot).
