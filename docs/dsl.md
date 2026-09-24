# Referencia del DSL

La fuente de verdad son los tipos en `src/core/types.ts` (tienen JSDoc). Esta página resume cómo se usan.

## Estructura de un bot

```ts
import { defineBot, intent, say, list, opt, handoff, close, createNav } from '../../core/dsl';

export default defineBot({
  config: { /* ver "Configuración" */ },
  intents: [ /* intent(...) */ ],
  endpoints: { /* clave: EndpointDef */ },
});
```

`defineBot` asigna ids estables a todos los pasos. Siempre exportar el resultado de `defineBot`.

## Intenciones y pasos

```ts
intent(id, nombre, grupo, pasos, { description?, note?, … })
```

Los pasos se ejecutan en orden. Los pasos que ramifican (`list`, `buttons`, `cond`, `api`) tienen ramas con pasos propios. **Si una rama termina sin salto, el flujo sigue con el paso siguiente de la intención** (en el canvas se dibuja como un "join"). Si la intención termina sin salto, el bot espera y el próximo mensaje vuelve a la entrada (el linter no lo marca, pero el registro sí).

| Helper | Qué hace | Ejemplo |
|---|---|---|
| `say(texto, { once? })` | Mensaje de texto. `once` lo envía una vez por sesión | `say(T.BIENVENIDA, { once: true })` |
| `media(spec, { caption? })` | Imagen, documento, video o audio | `media({ type: 'document', name: 'Bases.pdf' })` |
| `ask(texto, variable, { validate, error, skipIf, escape })` | Pregunta abierta | `ask('Tu cédula', 'cedula', { validate: V.cedulaPY, error: T.ERR })` |
| `askImage(texto, variable)` | Pide una foto | `askImage('Foto del frente de tu CI', 'ci_frente')` |
| `flow(texto, { cta, screens, flowName?, saveAs?, retry? })` | WhatsApp Flow: formulario de una o más pantallas | ver abajo |
| `list(texto, { button, rows, section?, dynamic?, saveAs?, onFreeText?, onTimeout? })` | Lista interactiva | ver abajo |
| `buttons(texto, opciones, { header?, footer?, saveAs? })` | Hasta 3 botones | `buttons('¿Seguimos?', [opt('si','Sí',[...]), opt('no','No','fin')])` |
| `opt(id, título, destino?, { description?, match?, set? })` | Opción. `destino`: pasos o id de intención | `opt('saldos', 'Saldos y pagos', 'saldos')` |
| `cond(etiqueta, ramas, otherwise?)` | Condición | `cond('¿Es VIP?', [when('sí', c => c.vars.vip, [...])], [...])` |
| `when(etiqueta, predicado, destino?)` | Rama de `cond` o de `api` | `when('cod 97', cod('97'), [...])` |
| `set(valores)` | Guarda variables. Funciones, `{{texto}}` o `null` para borrar | `set({ cedula: null, total: c => c.res.data.total })` |
| `action(etiqueta, { detail?, run? })` | Acción de plataforma (se registra) o de código (`run`) | `action('Etiquetar la conversación')` |
| `api(clave, { params, saveAs?, branches?, otherwise? })` | Llama a un endpoint simulado | ver abajo |
| `goto(destino)` | Salta a otra intención | `goto('fin')` |
| `handoff(cola, { topic?, topicId? })` | Deriva a una cola humana | `handoff('ATC', { topic: 'Saldo · {{cedula}}', topicId: 209 })` |
| `close()` | Cierra: limpia la sesión y ejecuta `config.closeActions` | último paso de la intención de cierre |
| `resumeQueue()` | Vuelve a la cola (dentro de `handoff.queueWait`) | |

Destinos especiales: `@back`, `@self`, `@entry`, `@close`.

### Contexto (`ctx`)

Las funciones reciben `ctx`: `ctx.vars` (variables), `ctx.res` (respuesta del último endpoint, dentro de sus ramas), `ctx.input` (texto libre, en `onFreeText`), `ctx.intent`, `ctx.now`.

Predicados listos: `cod('97', '96')`, `has('cedula')`, `eq('tipo', 'vip')`, `always`.

### Listas

```ts
list('Seleccione una opción', {
  button: 'Ver opciones',          // máx. 20 caracteres
  section: 'Saldos y pagos',
  rows: [
    opt('deuda', 'Cuánto debo pagar', [api(...), say(...)]),
    opt('redes', 'Problemas al pagar', 'redes', { description: 'Redes de pago' }),
    opt('main', 'Menú principal ⤴', 'main'),
  ],
})
```

Filas generadas desde datos (ej. un lote por fila):

```ts
list('Seleccione su lote', {
  button: 'Ver lotes',
  dynamic: dynamicRows({
    label: 'Un lote por fila',
    saveAs: 'fml',
    max: 9,
    rows: (c) => c.vars.lotes.map((l) => ({ id: l.fml, title: l.fml, description: l.zona })),
    example: [{ id: '938-8-9', title: '938-8-9', description: 'Villarrica' }],
    then: [api(...), nav(...)],
  }),
  rows: [opt('main', 'Menú principal ⤴', 'main')],
})
```

Encuesta con texto libre y tiempo límite:

```ts
list(T.ENCUESTA, {
  button: 'Calificar',
  saveAs: 'csat_nota',
  rows: ['5', '4', '3', '2', '1'].map((n) => opt(n, titulo[n], undefined, { match: [n] })),
  onFreeText: [set({ csat_comentario: (c) => c.input })],
  onTimeout: [set({ csat_nota: 'sin respuesta' })],
  timeoutMin: 5,
})
```

`match` define qué textos eligen la opción. Por defecto, el número de posición (1, 2, 3…) y el título.

### WhatsApp Flows

Cuando hay que pedir varios datos seguidos, un Flow los junta en un formulario nativo en vez de preguntar uno por uno. El cliente toca el botón (`cta`), completa las pantallas y el bot recibe todo junto: cada campo queda en la variable de su `name` y el flujo sigue con el paso siguiente.

```ts
flow('Completá los datos de tu propiedad 👇', {
  cta: 'Ofrecer propiedad',            // botón del mensaje (Meta recomienda hasta 30, sin emojis)
  flowName: 'idesa_ofrecer_propiedad', // nombre en el Administrador de WhatsApp
  screens: [
    screen('CONTACTO', 'Tus datos', [
      F.body('Te vamos a contactar a este número.'),
      F.text('nombre', 'Nombre y apellido', { required: true }),
      F.text('telefono', 'Teléfono', { required: true, input: 'phone', helper: 'Ej.: 0981 123 456' }),
    ]),                                // botón del pie: "Continuar" por defecto
    screen('PROPIEDAD', 'Tu propiedad', [
      F.text('superficie', 'Superficie (ha)', { required: true, input: 'number' }),
      F.dropdown('zona', 'Zona', ['Central', 'Itapúa']),
      F.radio('tipo', 'Tipo', [{ id: 'lote', title: 'Lote' }, { id: 'campo', title: 'Campo' }]),
    ], 'Enviar'),
  ],
}),
cond('¿Superficie ≥ 5 ha?', [when('sí', (c) => Number(c.vars.superficie) >= 5, [])], [...]),
```

Componentes: `F.heading`, `F.subheading`, `F.body` (texto) y `F.text` (`input`: `text`, `number`, `email`, `phone`), `F.textarea`, `F.dropdown`, `F.radio`, `F.checkbox` (guarda un array de ids), `F.date`, `F.optin` (guarda `true`/`false`).

- En el teléfono se validan los obligatorios y el tipo de entrada, como en WhatsApp. Las reglas de negocio (≥ 5 ha, formato de celular) van después, en una `cond`.
- Si el cliente escribe en vez de completarlo, cuenta como "No entiende" y se reenvía el Flow. El escape global (`askEscape`, ej. "1") y las palabras clave funcionan igual que en una pregunta.
- El linter aplica los límites de Meta: etiqueta de 20 caracteres (`text`, `textarea`, `dropdown`), 30 (`radio`, `checkbox`) y 40 (`date`), opciones de 30, botón del pie de 35 y nombres de campo únicos.
- En tests: `await s.submitFlow({ nombre: 'Ana', superficie: '12,5' })`. Falla si el teléfono no dejaría enviarlo.

### Endpoints

```ts
// mocks.ts
export const endpoints: Record<string, EndpointDef> = {
  pagosPendientes: {
    name: 'Pagos Pendientes',
    ref: 'EP 3',
    method: 'POST',
    path: '/whatsapp/pagosPendientes/',
    codes: [['107', 'Registra deudas'], ['97', 'No es cliente']],
    pending: 'Consulta abierta sobre este endpoint (opcional)',
    mock: (params, ctx) => (DB[params.cedula] ? { message: { cod: '107' }, data: DB[params.cedula] } : { message: { cod: '97' } }),
  },
};

// bot.ts
api('pagosPendientes', {
  params: (c) => ({ cedula: c.vars.cedula }),
  saveAs: 'deudas',
  branches: [when('cod 107', cod('107'), [say((c) => formatear(c.res.data))])],
  otherwise: [say('No encontramos datos'), handoff('ATC')],
})
```

Con "Endpoints caídos" activado en el panel, toda llamada da timeout: reintenta `config.endpointError.retries` veces y ejecuta `config.endpointError.steps` (usar `@self` para "Reintentar").

## Configuración

| Campo | Para qué |
|---|---|
| `id`, `name`, `client`, `description` | Identidad. `id` es la URL |
| `profile` | Nombre, iniciales y color del encabezado del chat |
| `entry`, `closeIntent` | Intención de entrada y de cierre |
| `groups` | Orden de los grupos en la barra lateral del canvas |
| `contactVars` | Variables que sobreviven al cierre (el resto se borra) |
| `keywords` | Palabras que interrumpen cualquier paso (`menu`, `salir`…) |
| `askEscape` | Texto que en una pregunta vuelve al menú (ej. `1`) |
| `fallback` | Textos de "No entiende", intentos y a dónde escalar |
| `media` | Respuestas a audio, archivos y fotos inesperadas |
| `inactivity` | Recordatorio y cierre por inactividad |
| `handoff.queues` | Colas (etiqueta y horario) |
| `handoff.outOfHours` | Pasos fuera de horario |
| `handoff.queueWait` | Pasos cuando el cliente espera en cola sin asesor |
| `endpointError` | Reintentos y pasos cuando un endpoint no responde |
| `closeActions` | Acciones de plataforma al cerrar (ej. `Cerrar conversación`, `Archivar conversación`, `UNASSIGN_BOT`) |
| `templates` | Plantillas salientes y el camino de cada botón |
| `api.formatRequest` | Cómo se muestra la request en el registro |
| `demo` | Aviso del chat, consejos, datos de prueba y galería de fotos de ejemplo |
| `nav` | Etiquetas y destinos de los botones de navegación |

## Tests

```ts
import { createSession } from '../src/core/testing';

const s = createSession(bot, { inHours: false });   // escenario opcional
await s.send('hola');
await s.pick('Soy cliente');           // por título (o parte del título)
await s.send('1234567');
await s.sendMedia({ type: 'image' });
await s.submitFlow({ nombre: 'Ana' });  // completa el último WhatsApp Flow
await s.tick();                        // inactividad o tiempo límite
await s.template('recordatorio', 'Ver mi saldo');
s.lastText(); s.options(); s.vars; s.mode; s.intent; s.transcript(); s.logTitles('act');
```
