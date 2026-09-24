---
description: Crea una demo nueva (flujograma estilo Botmaker + demo de WhatsApp) a partir del documento de un bot
argument-hint: <id> "<Cliente>" <ruta al documento>
---

Creá una demo nueva siguiendo `CLAUDE.md`, sección "Crear una demo nueva". Argumentos: $ARGUMENTS

1. Leé el documento completo. Si es PDF o DOCX, extraé el texto. Antes de escribir código, armá una lista con: intenciones, endpoints (con códigos), colas, textos, reglas globales, plantillas y consultas pendientes. Mostrame esa lista en 10 líneas o menos y seguí sin esperar confirmación.
2. Ejecutá `npm run new-bot -- <id> "<Cliente>"`.
3. Completá `texts.ts`, `mocks.ts` y `bot.ts` usando `src/bots/idesa/` como referencia de estilo.
4. Escribí `tests/<id>.test.ts` con un recorrido por intención principal y uno por cada rama de error de endpoint.
5. Corré `npm run check` y corregí hasta que pase. Revisá cada aviso del linter.
6. Al terminar, resumí: rutas de la demo, cantidad de intenciones y endpoints, inconsistencias del documento que marcaste como `pending`, y textos propuestos (`suggested`).
