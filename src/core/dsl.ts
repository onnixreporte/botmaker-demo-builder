import type {
  ActionStep,
  ApiStep,
  AskStep,
  BotDef,
  Branch,
  ButtonsStep,
  Choice,
  CloseStep,
  ConditionStep,
  Ctx,
  DynamicRows,
  GotoStep,
  HandoffStep,
  Intent,
  ListStep,
  MediaSpec,
  MediaStep,
  MessageStep,
  NavLabels,
  Notes,
  Pred,
  ResumeQueueStep,
  SetStep,
  Step,
  Target,
  TextValue,
} from './types';

/*
 * Helpers para escribir flujos. Todos aceptan un último objeto opcional
 * con anotaciones (label, note, todo, pending, suggested, example, rec).
 *
 *   intent('saldos', 'Saldos y pagos', 'Soy cliente', [
 *     list('Seleccione una opción', { button: 'Ver opciones', rows: [
 *       opt('deuda', 'Cuánto debo pagar', [ api(...), say(...) ]),
 *       opt('main', 'Menú principal ⤴', 'main'),
 *     ]}),
 *   ])
 */

type Then = Step[] | Target | undefined;
const split = (then: Then) => (typeof then === 'string' ? { goto: then } : then ? { then } : {});

export function intent(id: string, name: string, group: string, steps: Step[], o: Notes & { description?: string } = {}): Intent {
  return { id, name, group, steps, ...o };
}

/** Mensaje de texto. `once: true` lo envía una sola vez por sesión. */
export function say(text: TextValue, o: Notes & { once?: boolean } = {}): MessageStep {
  return { kind: 'message', text, ...o };
}

export function media(m: MediaSpec, o: Notes & { caption?: TextValue } = {}): MediaStep {
  return { kind: 'media', media: m, ...o };
}

/** Pregunta abierta que guarda la respuesta en `saveAs`. */
export function ask(text: TextValue, saveAs: string, o: Omit<AskStep, 'kind' | 'text' | 'saveAs'> = {}): AskStep {
  return { kind: 'ask', text, saveAs, ...o };
}

/** Pide una foto (la guarda como referencia en `saveAs`). */
export function askImage(text: TextValue, saveAs: string, o: Omit<AskStep, 'kind' | 'text' | 'saveAs' | 'expect'> = {}): AskStep {
  return { kind: 'ask', text, saveAs, expect: 'image', ...o };
}

/** Opción de una lista o botón. `then` puede ser pasos o el id de una intención (goto). */
export function opt(id: string, title: string, then?: Then, o: Omit<Choice, 'id' | 'title' | 'then' | 'goto'> = {}): Choice {
  return { id, title, ...split(then), ...o };
}

/** Lista interactiva (hasta 10 filas). */
export function list(text: TextValue, o: Omit<ListStep, 'kind' | 'text'>): ListStep {
  return { kind: 'list', text, ...o };
}

/** Filas generadas a partir de datos (ej. un lote por fila). */
export function dynamicRows(o: DynamicRows): DynamicRows {
  return o;
}

/** Mensaje con hasta 3 botones de respuesta. */
export function buttons(text: TextValue, choices: Choice[], o: Omit<ButtonsStep, 'kind' | 'text' | 'buttons'> = {}): ButtonsStep {
  return { kind: 'buttons', text, buttons: choices, ...o };
}

/** Rama de una condición o de un endpoint. */
export function when(label: string, pred: Pred, then?: Then, o: Notes = {}): Branch {
  return { label, when: pred, ...split(then), ...o };
}

/** Condición: se evalúan las ramas en orden; si ninguna cumple, `otherwise`. */
export function cond(label: string, branches: Branch[], otherwise?: Then, o: Notes = {}): ConditionStep {
  const other = typeof otherwise === 'string' ? { otherwiseGoto: otherwise } : otherwise ? { otherwise } : {};
  return { kind: 'condition', label, branches, ...other, ...o };
}

/** Guarda variables. Los valores pueden ser funciones del contexto o textos con {{variable}}. `null` borra. */
export function set(values: SetStep['values'], o: Notes = {}): SetStep {
  return { kind: 'set', values, ...o };
}

/** Acción de plataforma (solo se registra) o acción de código (`run`). */
export function action(label: string, o: Notes & { detail?: string; run?: ActionStep['run'] } = {}): ActionStep {
  return { kind: 'action', ...o, label };
}

/** Llamada a un endpoint definido en `bot.endpoints`. */
export function api(
  endpoint: string,
  o: Omit<ApiStep, 'kind' | 'endpoint' | 'otherwise' | 'otherwiseGoto'> & { otherwise?: Then },
): ApiStep {
  const { otherwise, ...rest } = o;
  const other = typeof otherwise === 'string' ? { otherwiseGoto: otherwise } : otherwise ? { otherwise } : {};
  return { kind: 'api', endpoint, ...rest, ...other };
}

export function goto(target: Target, o: Notes = {}): GotoStep {
  return { kind: 'goto', target, ...o };
}

/** Deriva a una cola humana. Fuera de horario ejecuta `config.handoff.outOfHours`. */
export function handoff(queue: string, o: Notes & { topic?: TextValue; topicId?: string | number } = {}): HandoffStep {
  return { kind: 'handoff', queue, ...o };
}

/** Cierra la conversación: limpia variables de sesión y ejecuta `config.closeActions`. */
export function close(o: Notes = {}): CloseStep {
  return { kind: 'close', ...o };
}

/** Devuelve la conversación a la cola (usar dentro de `handoff.queueWait`). */
export function resumeQueue(o: Notes = {}): ResumeQueueStep {
  return { kind: 'resumeQueue', ...o };
}

/* ---------- predicados ---------- */

/** Rama por código de respuesta: mira `res.message.cod`, `res.cod` o `res.code`. */
export const cod =
  (...codes: (string | number)[]): Pred =>
  (ctx: Ctx) => {
    const r = ctx.res ?? {};
    const c = r?.message?.cod ?? r?.cod ?? r?.code;
    return c != null && codes.map(String).includes(String(c));
  };

/** La variable tiene valor. */
export const has =
  (name: string): Pred =>
  (ctx) =>
    ctx.vars[name] != null && ctx.vars[name] !== '';

export const eq =
  (name: string, value: unknown): Pred =>
  (ctx) =>
    ctx.vars[name] === value;

/** Siempre verdadero (útil como primera rama de sistema). */
export const always: Pred = () => true;

/* ---------- navegación estándar ---------- */

/**
 * Crea el helper `nav(texto, volverA)`: el mensaje con los 3 botones
 * "Menú Principal · Volver Atrás · Finalizar Sesión" que cierra casi todas las respuestas.
 */
export function createNav(labels: NavLabels) {
  return (text: TextValue, back: Target = '@back', o: Notes & { backTitle?: string; header?: MediaSpec } = {}): ButtonsStep => {
    const { backTitle, header, ...notes } = o;
    return {
      kind: 'buttons',
      text,
      header,
      label: notes.label ?? 'Botones de navegación',
      ...notes,
      buttons: [
        { id: 'nav:menu', title: labels.menu.title, goto: labels.menu.goto },
        { id: 'nav:back', title: backTitle ?? labels.back.title, goto: back },
        { id: 'nav:close', title: labels.close.title, goto: labels.close.goto },
      ],
    };
  };
}

/* ---------- definición del bot ---------- */

/** Recorre todos los pasos (incluye ramas) y llama a `fn` con cada uno. */
export function walkSteps(steps: Step[] | undefined, fn: (s: Step, parent?: Step) => void, parent?: Step): void {
  if (!steps) return;
  for (const s of steps) {
    fn(s, parent);
    for (const child of childSteps(s)) walkSteps(child, fn, s);
  }
}

/** Listas de pasos anidadas dentro de un paso. */
export function childSteps(s: Step): Step[][] {
  const out: Step[][] = [];
  const push = (x?: Step[]) => x && out.push(x);
  switch (s.kind) {
    case 'list':
      s.rows.forEach((r) => push(r.then));
      push(s.dynamic?.then);
      push(s.onFreeText);
      push(s.onTimeout);
      break;
    case 'buttons':
      s.buttons.forEach((b) => push(b.then));
      push(s.onFreeText);
      push(s.onTimeout);
      break;
    case 'condition':
    case 'api':
      (s.branches ?? []).forEach((b) => push(b.then));
      push(s.otherwise);
      break;
  }
  return out;
}

function assignIds(steps: Step[] | undefined, prefix: string): void {
  steps?.forEach((s, i) => {
    const id = `${prefix}/${i}`;
    s._id = id;
    switch (s.kind) {
      case 'list':
        s.rows.forEach((r) => {
          r._id = `${id}:${r.id}`;
          assignIds(r.then, r._id);
        });
        assignIds(s.dynamic?.then, `${id}:dyn`);
        assignIds(s.onFreeText, `${id}:free`);
        assignIds(s.onTimeout, `${id}:timeout`);
        break;
      case 'buttons':
        s.buttons.forEach((b) => {
          b._id = `${id}:${b.id}`;
          assignIds(b.then, b._id);
        });
        assignIds(s.onFreeText, `${id}:free`);
        assignIds(s.onTimeout, `${id}:timeout`);
        break;
      case 'condition':
      case 'api':
        (s.branches ?? []).forEach((b, j) => {
          b._id = `${id}:b${j}`;
          assignIds(b.then, b._id);
        });
        assignIds(s.otherwise, `${id}:else`);
        break;
    }
  });
}

/** Asigna ids estables a todos los pasos (los usan el canvas, el registro y el linter). */
export function indexSteps(steps: Step[] | undefined, prefix: string): void {
  assignIds(steps, prefix);
}

export function defineBot(def: BotDef): BotDef {
  def.intents.forEach((it) => assignIds(it.steps, it.id));
  indexSteps(def.config.handoff.outOfHours, 'cfg:outOfHours');
  indexSteps(def.config.handoff.queueWait?.steps, 'cfg:queueWait');
  indexSteps(def.config.endpointError.steps, 'cfg:endpointError');
  def.config.templates?.forEach((t) =>
    t.buttons.forEach((b) => {
      b._id = `tpl:${t.id}:${b.id}`;
      assignIds(b.then, b._id);
    }),
  );
  return def;
}
