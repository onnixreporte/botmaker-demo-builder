# Builder de demos de bots de WhatsApp

Cada bot se define **una sola vez** en `src/bots/<id>/bot.ts` con un DSL tipado. De esa definición salen tres vistas:

| Ruta | Para quién | Qué es |
|---|---|---|
| `/<id>` | Cliente | Demo con interfaz de WhatsApp, responsive, sin datos técnicos |
| `/<id>/prueba` | Equipo | La misma demo más un panel: registro de intenciones y endpoints, variables, escenarios (horario, asesores, endpoints caídos), plantillas y reloj de inactividad |
| `/<id>/flujo` | Equipo y cliente técnico | Flujograma estilo Botmaker, con detalle de cada bloque y revisión del linter |

El motor (`src/core/engine.ts`) ejecuta la definición y el canvas (`src/ui/canvas/tree.ts`) la dibuja. **Nunca se escribe un flujo dos veces.**

## Comandos

```bash
npm install
npm run dev          # http://localhost:5173
npm run check        # typecheck + linter de flujos + tests. Tiene que pasar antes de entregar.
npm run lint:flows   # solo el linter (límites de WhatsApp y coherencia). -- <id> para uno solo
npm run test         # vitest
npm run new-bot -- <id> "<Cliente>" [INICIALES] [#color]
npm run build        # dist/ estático (Vercel, Netlify o cualquier hosting)
```

## Estructura

```
src/core/          motor, DSL, tipos, linter, validadores, helper de tests. Independiente de React.
  types.ts         ← referencia de todos los campos (con JSDoc)
  dsl.ts           ← helpers: intent, say, ask, list, buttons, opt, cond, when, api, handoff, goto, close…
  engine.ts        ← ejecuta el bot y emite eventos (chat, registro, estado)
  lint.ts          ← reglas de WhatsApp y de flujo
  system.ts        ← vistas de solo lectura del canvas (No entiende, inactividad, errores…)
  testing.ts       ← createSession(bot): conversar en tests sin UI
src/bots/<id>/     un bot por carpeta: bot.ts, texts.ts, mocks.ts
src/bots/_plantilla/  base que copia `npm run new-bot`
src/bots/index.ts  registro (el script lo edita solo)
src/ui/device/     marco de teléfono común a todos los canales (PhoneFrame), controles de vista
                   a su derecha (DeviceRail: tema claro/oscuro; canal cuando haya más de uno)
                   y `useAppearance` (tema + canal). Device junta todo y elige el chat del canal.
src/ui/whatsapp/   componentes de la interfaz de WhatsApp (Message, WhatsAppChat). Colores solo con
                   tokens --wa-*: claro en :root, oscuro en [data-theme='dark'].
src/ui/simulator/  useEngine (puente motor ↔ React) y TestPanel
src/ui/canvas/     árbol, layout, bloques y panel de detalle del flujograma
src/pages/         Home, Demo, Test, Flow
tests/             engine.test.ts (motor), idesa.test.ts (ejemplo real), lint.test.ts, <id>.test.ts
docs/dsl.md        referencia del DSL con ejemplos
```

`src/bots/idesa/` es el bot de referencia completo: cuando dudes cómo modelar algo, buscá cómo está hecho ahí.

## Crear una demo nueva

Entrada típica: un documento del cliente con el árbol de conversación, los endpoints y observaciones. Seguí estos pasos en orden.

1. **Leer todo el documento** antes de escribir código. Listar: intenciones (cada rama del menú principal y cada submenú con entidad propia), endpoints con sus códigos de respuesta, textos, colas de derivación, horarios, encuesta de cierre, reglas globales (validaciones, "una vez por sesión", fuera de horario).
2. **Crear el bot:** `npm run new-bot -- <id> "<Cliente>" [INICIALES] [#color]`.
3. **`texts.ts`:** copiar los textos **literalmente** del documento (con sus emojis y errores de tipeo; se corrigen con el cliente, no por nuestra cuenta).
4. **`mocks.ts`:** un `EndpointDef` por servicio. Completar `name`, `ref` (ej. `EP 3`), `method`, `path` y `codes` tal como están en el documento. El `mock` devuelve la forma real de la respuesta y cubre **cada código documentado** con algún dato de prueba. Usar los datos de ejemplo del documento; si no hay, inventar datos obviamente ficticios.
5. **`bot.ts`:** configuración + intenciones. Ver el mapeo de abajo.
6. **Anotar con criterio**, porque es lo que el cliente va a revisar en el canvas:
   - `suggested: true`: el texto lo propusimos nosotros (ej. el documento no define la bienvenida).
   - `todo`: lógica a implementar en Botmaker (el "amarillo" del documento).
   - `pending`: consulta pendiente con el cliente (el "naranja"). Se registra en el panel cada vez que se ejecuta.
   - `rec`: recomendación nuestra.
   - `note`: información útil para el equipo.
   Cuando el documento es inconsistente (un endpoint exige un dato que el flujo nunca pide, unidades que no coinciden, un botón de más de 20 caracteres), **no lo arregles en silencio**: modelalo lo más fiel posible y marcá `pending` explicando la inconsistencia.
7. **Datos de prueba:** en `config.demo.identities` va un valor por escenario (cliente normal, no cliente, casos especiales de cada endpoint).
8. **Tests:** en `tests/<id>.test.ts`, al menos un recorrido por intención principal y uno por cada rama de error de los endpoints. Usar `createSession(bot)`: `send`, `pick`, `sendMedia`, `submitFlow`, `tick`, `template`, `options()`, `lastText()`, `vars`, `mode`, `transcript()`.
9. **`npm run check`** hasta tener 0 errores. Revisar los avisos del linter: cada uno es una decisión (se acepta o se corrige).
10. **Revisar visualmente** con `npm run dev`: `/<id>/flujo` (que cada intención se lea bien), `/<id>/prueba` (probar los caminos, el registro tiene que contar la historia) y `/<id>` en ancho de celular.

## Mapeo documento → DSL

| En el documento | En el DSL |
|---|---|
| Menú con opciones numeradas | `list(texto, { button, rows: [opt(id, título, destino)] })` hasta 10 filas; `buttons(texto, [opt…])` si son hasta 3 |
| Opción que va a otra sección | `opt('id', 'Título', 'intencionDestino')` |
| "Menú principal", "Volver atrás", "Finalizar sesión" al final de una respuesta | `nav(texto, volverA)` (creado con `createNav`) |
| "Se llama al Endpoint N" | `api('clave', { params, branches: [when('cod X', cod('X'), [...])], otherwise })` |
| "Derivar a ATC / ventas / ejecutivo" | `say(mensajeDeEspera)` + `handoff('Cola', { topic, topicId })` |
| "Ingresar cédula / email / celular" | `ask(texto, 'variable', { validate: V.xxx, error })` |
| "Solo se pide una vez por sesión" | `ask(..., { skipIf: has('variable') })` o una `cond` al inicio |
| Varios datos seguidos (nombre, teléfono, ciudad…) o "usar WhatsApp Flow" | `flow(texto, { cta, screens: [screen(id, título, [F.text(…), F.dropdown(…)], 'Enviar')] })`. Etiquetas de 20 caracteres: dejar el texto original en `note` |
| "El cliente envía una foto" | `askImage(texto, 'variable')` |
| "(Se le envían archivos / imagen / video / pdf)" | `media({ type, name, placeholder })` o `header` en un mensaje con botones |
| Mensaje que se envía una vez (bienvenida, aviso) | `say(texto, { once: true })` |
| Encuesta al cerrar | intención de cierre: `list` con `onFreeText`, `onTimeout` y al final `close()` |
| Condición del negocio | `cond('¿Pregunta?', [when('etiqueta', ctx => …, [...])], otherwise)` |
| Fuera de horario | `config.handoff.outOfHours` |
| Palabras que funcionan en cualquier momento | `config.keywords` |
| Plantillas salientes (HSM) | `config.templates` con sus botones y el camino de cada uno |

Destinos especiales de `goto` y de las opciones: `@back` (intención anterior), `@self` (repetir la actual, ej. "Reintentar"), `@entry`, `@close`.

## Límites de WhatsApp (los aplica el linter)

- Lista: hasta **10 filas**, título de fila **24** caracteres, descripción **72**, botón de la lista **20**, título de sección **24**.
- Botones de respuesta: hasta **3**, título **20** caracteres.
- Cuerpo de un mensaje interactivo: **1024** caracteres (si se pasa, el motor lo manda aparte). Encabezado y pie: **60**.
- Mensaje de texto: **4096** caracteres.

Cuando el documento del cliente rompe un límite, acortá el título en el DSL y dejá el original en `note` o `pending`.

## Reglas

- **No toques `src/core/` para modelar un bot.** Si falta un tipo de paso, agregalo completo: `types.ts` → `dsl.ts` → `engine.ts` → `lint.ts` → `ui/canvas/tree.ts` → `ui/canvas/DetailPanel.tsx` → un test en `tests/engine.test.ts`.
- Los textos van en `texts.ts`, no sueltos en el flujo (salvo los `suggested` cortos).
- Ids de intención en minúscula y cortos (`saldos`, `imp`); son la URL del canvas (`/<bot>/flujo#saldos`).
- No usar logos ni marcas reales de WhatsApp o Meta en la interfaz. Los placeholders dicen "ejemplo".
- No inventar datos de negocio (montos, teléfonos, fechas) como si fueran reales: usar los ejemplos del documento o datos claramente ficticios.
- `npm run check` en verde antes de dar una demo por terminada.

## Checklist de entrega

- [ ] `npm run check` pasa, sin errores del linter
- [ ] Cada endpoint del documento tiene su `EndpointDef` con `codes`
- [ ] Cada consulta pendiente del documento aparece como `pending`
- [ ] Hay datos de prueba para cada escenario (`demo.identities`)
- [ ] `/<id>` se ve bien en 390 px de ancho
- [ ] El canvas no tiene intenciones inalcanzables (salvo que sea a propósito)
