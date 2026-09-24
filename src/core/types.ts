/**
 * Tipos del DSL de flujos.
 *
 * Un bot es: configuración global + intenciones + endpoints simulados.
 * Cada intención es una lista de pasos (Step). Los pasos que ramifican
 * (list, buttons, condition, api) tienen ramas con sus propios pasos;
 * cuando una rama termina sin `goto`, el flujo sigue con el paso siguiente
 * de la intención (así se dibujan los "joins" en el canvas).
 */

/** Variables de la conversación. Se tipan como `any` a propósito: el autor del bot decide su forma. */
export type Vars = Record<string, any>;

export interface Ctx {
  vars: Vars;
  /** Última respuesta de endpoint (dentro de las ramas de un paso `api`). */
  res?: any;
  /** Último texto libre que escribió el cliente (en `onFreeText`). */
  input?: string;
  intent: string;
  now: Date;
}

/** Texto fijo (con `{{variable}}`) o calculado a partir del contexto. */
export type TextValue = string | ((ctx: Ctx) => string);
export type Pred = (ctx: Ctx) => boolean;

/**
 * Destino de un salto: id de intención o un destino especial.
 * - `@back`  intención anterior
 * - `@self`  reiniciar la intención actual (ej. "Reintentar")
 * - `@entry` intención de entrada (menú principal)
 * - `@close` intención de cierre
 */
export type Target = string;

/** Anotaciones que aparecen en el canvas y en el registro del panel de prueba. */
export interface Notes {
  /** Nombre del bloque en el canvas. */
  label?: string;
  /** Información para el equipo. */
  note?: string;
  /** Lógica que hay que implementar en Botmaker (amarillo en el canvas). */
  todo?: string;
  /** Consulta pendiente con el cliente (naranja en el canvas; se registra al ejecutarse). */
  pending?: string;
  /** El texto es una propuesta: no viene del documento del cliente. */
  suggested?: boolean;
  /** Texto de ejemplo para el canvas cuando el texto es una función. */
  example?: string;
  /** Recomendación (azul en el canvas). */
  rec?: string;
  /** @internal id asignado por `defineBot`. */
  _id?: string;
}

export interface MediaSpec {
  type: 'image' | 'document' | 'video' | 'audio';
  /** Nombre del archivo o descripción corta. */
  name?: string;
  /** URL o data URI. Si falta, la UI dibuja un placeholder con `placeholder`. */
  src?: string;
  /** Texto secundario (ej. "PDF · 2 páginas"). */
  meta?: string;
  duration?: string;
  placeholder?: { title: string; subtitle?: string };
}

export interface Validator {
  /** Descripción que se muestra en el canvas. */
  name: string;
  /** Devuelve el valor normalizado o `null` si no es válido. */
  fn: (input: string) => string | null;
}

export interface Choice extends Notes {
  id: string;
  title: string;
  description?: string;
  /** Textos que también eligen esta opción al escribirlos (por defecto: su número de posición). */
  match?: string[];
  then?: Step[];
  goto?: Target;
  /** Variables a guardar al elegirla. */
  set?: Record<string, unknown>;
}

export interface Branch extends Notes {
  label: string;
  when: Pred;
  then?: Step[];
  goto?: Target;
}

export interface Row {
  id: string;
  title: string;
  description?: string;
}

export interface DynamicRows {
  /** Qué representa cada fila (se muestra en el canvas). */
  label: string;
  rows: (ctx: Ctx) => Row[];
  /** Variable donde se guarda el id elegido. */
  saveAs: string;
  then?: Step[];
  /** Filas de ejemplo para el canvas. */
  example: Row[];
  /** Máximo de filas dinámicas antes de paginar (por defecto: lo que entre en 10). */
  max?: number;
}

interface Base extends Notes {}

export interface MessageStep extends Base {
  kind: 'message';
  text: TextValue;
  /** Se envía una sola vez por sesión (ej. bienvenida, avisos). */
  once?: boolean;
}

export interface MediaStep extends Base {
  kind: 'media';
  media: MediaSpec;
  caption?: TextValue;
}

export interface AskStep extends Base {
  kind: 'ask';
  text: TextValue;
  saveAs: string;
  /** `image` espera una foto; `text` (por defecto) espera texto. */
  expect?: 'text' | 'image';
  validate?: Validator;
  /** Mensaje cuando el dato no es válido. */
  error?: TextValue;
  /** Si devuelve true, la pregunta se saltea (ej. dato ya guardado en la sesión). */
  skipIf?: Pred;
  /** Permite el escape global (ej. "1" → menú principal). Por defecto true. */
  escape?: boolean;
}

interface ChoiceStepBase extends Base {
  text: TextValue;
  footer?: string;
  /** Guarda el id elegido en esta variable. */
  saveAs?: string;
  /** Si está definido, el texto libre no dispara "No entiende": ejecuta estos pasos. */
  onFreeText?: Step[];
  /** Si está definido, la inactividad no dispara el recordatorio global: ejecuta estos pasos. */
  onTimeout?: Step[];
  timeoutMin?: number;
}

export interface ListStep extends ChoiceStepBase {
  kind: 'list';
  /** Texto del botón que abre la lista (máx. 20). */
  button: string;
  header?: string;
  section?: string;
  rows: Choice[];
  dynamic?: DynamicRows;
}

export interface ButtonsStep extends ChoiceStepBase {
  kind: 'buttons';
  header?: MediaSpec;
  buttons: Choice[];
}

export interface ConditionStep extends Base {
  kind: 'condition';
  label: string;
  branches: Branch[];
  otherwise?: Step[];
  otherwiseGoto?: Target;
  /** @internal vista de sistema sin rama "NO CUMPLE NINGUNA". */
  _noElse?: boolean;
}

/** Valor fijo, texto con {{variable}}, `null` para borrar o función del contexto. */
export type SetValue = ((ctx: Ctx) => unknown) | string | number | boolean | null | undefined | Record<string, unknown> | unknown[];

export interface SetStep extends Base {
  kind: 'set';
  values: Record<string, SetValue>;
}

export interface ActionStep extends Base {
  kind: 'action';
  label: string;
  detail?: string;
  /** Acción de código: puede leer y modificar `ctx.vars`. */
  run?: (ctx: Ctx) => void | Promise<void>;
}

export interface ApiStep extends Base {
  kind: 'api';
  /** Clave en `bot.endpoints`. */
  endpoint: string;
  params: (ctx: Ctx) => Record<string, any>;
  saveAs?: string;
  /** Ramas evaluadas con `ctx.res` = respuesta. */
  branches?: Branch[];
  otherwise?: Step[];
  otherwiseGoto?: Target;
}

export interface GotoStep extends Base {
  kind: 'goto';
  target: Target;
}

export interface HandoffStep extends Base {
  kind: 'handoff';
  /** Clave en `config.handoff.queues`. */
  queue: string;
  topic?: TextValue;
  topicId?: string | number;
}

export interface CloseStep extends Base {
  kind: 'close';
}

export interface ResumeQueueStep extends Base {
  kind: 'resumeQueue';
}

export type Step =
  | MessageStep
  | MediaStep
  | AskStep
  | ListStep
  | ButtonsStep
  | ConditionStep
  | SetStep
  | ActionStep
  | ApiStep
  | GotoStep
  | HandoffStep
  | CloseStep
  | ResumeQueueStep;

export type StepKind = Step['kind'];

export interface Intent extends Notes {
  id: string;
  name: string;
  /** Grupo de la barra lateral del canvas. */
  group: string;
  description?: string;
  steps: Step[];
}

export interface Template extends Notes {
  id: string;
  name: string;
  category: 'utility' | 'marketing' | 'authentication';
  text: string;
  footer?: string;
  buttons: Choice[];
}

export interface EndpointDef extends Notes {
  name: string;
  /** Referencia corta del documento del cliente (ej. "EP 3"). */
  ref?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path?: string;
  /** Códigos de respuesta documentados: [código, significado]. */
  codes?: [string, string][];
  latencyMs?: number;
  mock: (params: Record<string, any>, ctx: Ctx) => any | Promise<any>;
}

export interface NavLabels {
  menu: { title: string; goto: Target };
  back: { title: string };
  close: { title: string; goto: Target };
}

export interface BotConfig {
  /** Slug de la URL: /<id>, /<id>/prueba, /<id>/flujo. */
  id: string;
  name: string;
  client: string;
  description: string;
  /**
   * Perfil de empresa que ve el cliente en el encabezado del chat.
   * `avatar` (foto de perfil, cuadrada) y `logo` (logo completo, para la presentación)
   * son rutas dentro de `public/`, ej. `/bots/<id>/avatar.png`. Sin `avatar` se muestran las iniciales.
   */
  profile: { name: string; initials: string; color: string; about?: string; avatar?: string; logo?: string };
  /** Intención con la que arranca toda sesión. */
  entry: string;
  /** Intención de cierre (encuesta, despedida y `close()`). */
  closeIntent: string;
  /** Orden de los grupos en la barra lateral del canvas. */
  groups: string[];
  /** Variables del contacto: sobreviven al cierre de sesión. El resto se borra. */
  contactVars: string[];
  /** Palabras que interrumpen cualquier paso (comparación exacta, sin tildes). */
  keywords: { words: string[]; goto: Target }[];
  /** Texto que en una pregunta abierta vuelve al menú (ej. "1"). */
  askEscape?: { input: string; goto: Target };
  fallback: {
    maxAttempts: number;
    list: string;
    buttons: string;
    retry: string;
    invalidInput: string;
    /** En qué intento se agrega la opción de hablar con una persona. */
    offerAgentOnAttempt?: number;
    agentChoice: { list: string; buttons: string };
    escalateTo: Target;
  };
  media: { audio: string; fileInChoice: string; fileInAsk: string; imageNeeded: string };
  inactivity: { reminderAfterMin: number; reminder: string; closeAfterMin: number; goto: Target };
  handoff: {
    queues: Record<string, { label: string; hours?: string }>;
    /** Pasos cuando la derivación ocurre fuera de horario. */
    outOfHours: Step[];
    /** Pasos cuando el cliente espera en cola sin asesor. Usar `resumeQueue()` para volver a la cola. */
    queueWait?: { afterMin: number; steps: Step[] };
    agentName?: string;
  };
  endpointError: { retries: number; steps: Step[] };
  /** Acciones de plataforma al cerrar (se muestran en el canvas y el registro). */
  closeActions: string[];
  /** Cuerpo corto cuando el texto de un mensaje con botones supera 1024 caracteres. */
  longBodyFallback?: string;
  templates?: Template[];
  api?: {
    /** Cómo se ve la request en el registro (ej. envolver en { key, parametros }). */
    formatRequest?: (params: Record<string, any>) => unknown;
    summarize?: (res: any) => string;
  };
  demo?: {
    /** Aviso amarillo al inicio del chat. */
    notice?: string;
    /** Consejos que ve el cliente al lado del teléfono. */
    tips?: string[];
    /** Datos de prueba (ej. cédulas) que se muestran como atajos. */
    identities?: { value: string; label: string }[];
    /** Mostrar los datos de prueba también en la demo del cliente. */
    shareIdentities?: boolean;
    /** Fotos de ejemplo de la galería del simulador. */
    gallery?: { label: string; kind: 'id-front' | 'id-back' | 'receipt' | 'photo' }[];
  };
  nav: NavLabels;
}

export interface BotDef {
  config: BotConfig;
  intents: Intent[];
  endpoints: Record<string, EndpointDef>;
}
