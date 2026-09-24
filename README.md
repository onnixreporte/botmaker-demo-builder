# Builder de demos de bots de WhatsApp

Armá la demo de un bot antes de tocar Botmaker: el flujograma estilo Botmaker para revisarlo con el equipo y una demo con interfaz de WhatsApp para que el cliente la pruebe desde el celular. Las dos salen del **mismo archivo de definición**, así que nunca se desincronizan, y las pruebas no consumen conversaciones pagas.

## Qué incluye

- **Demo para el cliente** (`/<bot>`): chat con la interfaz de WhatsApp (listas, botones, fotos, audios, stickers, ticks de lectura), responsive. En el celular ocupa toda la pantalla.
- **Demo con panel de prueba** (`/<bot>/prueba`): registro paso a paso (intenciones, condiciones, requests y respuestas de endpoints), variables de sesión y de contacto, y escenarios: fuera de horario, sin asesores, endpoints caídos, inactividad, plantillas salientes y respuestas del asesor.
- **Flujograma** (`/<bot>/flujo`): canvas estilo Botmaker con zoom, detalle de cada bloque (vista previa en WhatsApp, límites de caracteres, códigos de respuesta, consultas pendientes) y revisión automática contra los límites de WhatsApp.
- **Motor sin UI + tests**: cada bot se prueba con conversaciones escritas en Vitest.

El bot de referencia es **IDESA** (`src/bots/idesa/`), con 18 intenciones y 15 endpoints simulados.

## Empezar

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + linter de flujos + tests
```

## Crear una demo nueva

Con Claude Code, en la carpeta del proyecto:

```
/nueva-demo tienda-sol "Tienda del Sol" ./docs-cliente/flujo-tienda.pdf
```

A mano:

```bash
npm run new-bot -- tienda-sol "Tienda del Sol" TDS "#C2410C"
# completar src/bots/tienda-sol/{texts,mocks,bot}.ts y tests/tienda-sol.test.ts
npm run check
```

`CLAUDE.md` tiene el paso a paso, el mapeo "documento del cliente → DSL" y el checklist de entrega. `docs/dsl.md` tiene la referencia del DSL.

## Publicar y compartir

`npm run build` genera `dist/`, un sitio estático.

- **Vercel**: importar el repo. `vercel.json` ya redirige las rutas a `index.html`.
- **Netlify**: `public/_redirects` ya está incluido.
- **Subdirectorio** (ej. GitHub Pages): `BASE_PATH=/demos/ npm run build` y copiar `dist/index.html` a `dist/404.html`.

Al cliente se le comparte `https://tu-dominio/<bot>`. El panel de prueba y el flujograma quedan en `/<bot>/prueba` y `/<bot>/flujo`.

## Estructura

```
src/core/       motor, DSL, tipos, linter, validadores (sin React)
src/bots/       un bot por carpeta + plantilla + registro
src/ui/         WhatsApp, panel de prueba, canvas
src/pages/      inicio, demo, prueba, flujo
tests/          motor, IDESA, linter y un archivo por bot
scripts/        new-bot.mjs, lint-flows.ts
```

## Limitaciones

- Los endpoints son simulados (`mocks.ts`). Para conectar uno real, hay que cambiar su `mock` por un `fetch` a un proxy propio, porque las APIs del cliente no suelen aceptar llamadas directas desde el navegador.
- La interfaz imita el estilo de WhatsApp para Android, pero no usa su logo ni sus recursos. Es una demo, no el canal real.
- Las fuentes se cargan de Google Fonts. Sin conexión se usan las del sistema.
