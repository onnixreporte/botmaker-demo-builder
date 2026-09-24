import { display, interpolate, norm } from './text';
import { flowFields, flowSummary, normalizeFlowValue } from './flow';
import { WA } from './limits';
import type {
  ApiStep,
  AskStep,
  BotDef,
  ButtonsStep,
  Choice,
  Ctx,
  FlowScreen,
  FlowStep,
  FlowValues,
  HandoffStep,
  Intent,
  ListStep,
  MediaSpec,
  Pred,
  Row,
  Step,
  Target,
  TextValue,
  Vars,
} from './types';

/* =====================================================================
   Tipos públicos
   ===================================================================== */

export type Mode = 'idle' | 'bot' | 'queue' | 'agent';

export interface UserMedia {
  type: 'image' | 'document' | 'video' | 'audio' | 'sticker' | 'location' | 'contact';
  src?: string;
  name?: string;
  emoji?: string;
}

export interface UserInput {
  text?: string;
  /** Descripción de la fila elegida (se muestra bajo el título en la burbuja). */
  subtext?: string;
  /** Respuesta a un mensaje interactivo (lista o botón). */
  replyTo?: { messageId: string; choiceId: string };
  media?: UserMedia;
  /** Respuesta a un WhatsApp Flow: todos los campos juntos. */
  flowReply?: { messageId: string; values: FlowValues };
}

export type ChatItem =
  | { id: string; from: 'bot' | 'agent'; kind: 'text'; text: string; time: string }
  | { id: string; from: 'bot'; kind: 'media'; media: MediaSpec; caption?: string; time: string }
  | { id: string; from: 'bot'; kind: 'list'; text: string; header?: string; footer?: string; button: string; section?: string; rows: Row[]; time: string }
  | { id: string; from: 'bot'; kind: 'buttons'; text: string; header?: MediaSpec; footer?: string; buttons: { id: string; title: string }[]; time: string; template?: string }
  | { id: string; from: 'bot'; kind: 'flow'; text: string; header?: string; footer?: string; cta: string; flowName?: string; screens: FlowScreen[]; time: string }
  | { id: string; from: 'user'; kind: 'text'; text: string; subtext?: string; time: string }
  | { id: string; from: 'user'; kind: 'flow'; flowId: string; answers: { label: string; value: string }[]; time: string }
  | { id: string; from: 'user'; kind: 'media'; media: UserMedia; time: string };

export type ReceiptStatus = 'sent' | 'delivered' | 'read';

export type LogKind = 'intent' | 'cond' | 'act' | 'api' | 'var' | 'info' | 'warn' | 'user';

export interface LogEntry {
  id: number;
  time: string;
  kind: LogKind;
  title: string;
  detail?: string;
  /** Intención a la que enlaza (canvas). */
  intent?: string;
  api?: { endpoint: string; name: string; ref?: string; request: unknown; response: unknown };
}

export interface EngineState {
  mode: Mode;
  intent: string | null;
  vars: Vars;
  /** Qué espera el motor: nada, respuesta del cliente o respuesta con tiempo límite (encuesta). */
  waiting: 'none' | 'input' | 'timed';
  inactStage: number;
  queue?: string;
  agentSpoke: boolean;
  typing: boolean;
  clockOffsetMin: number;
}

export type EngineEvent =
  | { type: 'chat'; item: ChatItem }
  | { type: 'receipt'; id: string; status: ReceiptStatus }
  | { type: 'log'; entry: LogEntry }
  | { type: 'state'; state: EngineState }
  | { type: 'reset' };

export interface Scenario {
  inHours: boolean;
  agentsAvailable: boolean;
  endpointsDown: boolean;
}

export interface EngineOptions {
  /** Milisegundos de "escribiendo…" según el largo del texto. 0 en tests. */
  typingMs?: (len: number) => number;
  /** Latencia simulada de los endpoints. */
  apiMs?: number;
  scenario?: Partial<Scenario>;
  /** Reloj base (ms). */
  now?: () => number;
}

/* =====================================================================
   Señales internas
   ===================================================================== */

class Jump {
  constructor(public target: Target) {}
}
class Stop {}
class Abort {}

type Ev = { type: 'input'; input: UserInput; itemId: string } | { type: 'tick' };

interface RowRef extends Row {
  match?: string[];
  choice?: Choice;
  dynamic?: boolean;
}

const OFFER_AGENT = '__agent__';
const REALISTIC = (len: number) => Math.min(1600, 450 + len * 9);

/* =====================================================================
   Motor
   ===================================================================== */

/**
 * Ejecuta una definición de bot. No sabe nada de React: recibe entradas
 * (`send`, `tick`, `agentSay`…) y emite eventos que la UI (o un test) consume.
 */
export class Engine {
  readonly bot: BotDef;
  scenario: Scenario;
  state: EngineState;

  private intents = new Map<string, Intent>();
  private listeners = new Set<(e: EngineEvent) => void>();
  private opts: { typingMs: (len: number) => number; apiMs: number; now: () => number };
  private runId = 0;
  private running = false;
  private waiter: { res: (e: Ev) => void; rej: (e: unknown) => void } | null = null;
  private inbox: Ev[] = [];
  private settleResolvers: Array<() => void> = [];
  private seq = 0;
  private logSeq = 0;
  private onceSeen = new Set<string>();
  private templateMsgs = new Map<string, string>();
  private flowMsgs = new Map<string, FlowScreen[]>();
  private fallbackCount = 0;
  private prevIntent: string | null = null;
  private lastRes: unknown;
  private lastInput: string | undefined;

  constructor(bot: BotDef, opts: EngineOptions = {}) {
    this.bot = bot;
    bot.intents.forEach((it) => this.intents.set(it.id, it));
    this.opts = { typingMs: opts.typingMs ?? REALISTIC, apiMs: opts.apiMs ?? 700, now: opts.now ?? (() => Date.now()) };
    this.scenario = { inHours: true, agentsAvailable: true, endpointsDown: false, ...opts.scenario };
    this.state = this.initialState();
  }

  /* ---------- API pública ---------- */

  subscribe(fn: (e: EngineEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Mensaje del cliente: texto, respuesta a lista/botón o archivo. */
  send(input: UserInput): void {
    const item = this.userItem(input);
    this.emit({ type: 'chat', item });
    this.state.inactStage = 0;

    if (this.state.mode === 'agent' || this.state.mode === 'queue') {
      this.log('user', 'Mensaje para el asesor', 'El bot está apagado');
      this.emit({ type: 'receipt', id: item.id, status: this.state.mode === 'agent' && this.state.agentSpoke ? 'read' : 'delivered' });
      this.emitState();
      return;
    }
    this.emit({ type: 'receipt', id: item.id, status: 'read' });

    const tpl = input.replyTo ? this.templateMsgs.get(input.replyTo.messageId) : undefined;
    if (tpl) {
      const btn = input.replyTo!.choiceId;
      this.start(() => this.runTemplate(tpl, btn));
      return;
    }
    if (this.state.mode === 'idle' || !this.running) {
      if (this.state.mode === 'idle') this.log('info', 'Nueva sesión', `Mensaje entrante: ${input.text ?? input.media?.type ?? ''}`);
      this.start(() => this.execIntent(this.bot.config.entry));
      return;
    }
    this.push({ type: 'input', input, itemId: item.id });
  }

  /** Simula el paso del tiempo sin respuesta del cliente. */
  tick(): void {
    if (this.state.mode === 'bot' && this.running) {
      this.push({ type: 'tick' });
      return;
    }
    const qw = this.bot.config.handoff.queueWait;
    if (this.state.mode === 'queue' && qw) {
      this.advance(qw.afterMin);
      this.start(async () => {
        this.log('intent', '↳ Espera en cola', `${qw.afterMin} min sin asesor`);
        await this.execSteps(qw.steps);
      });
    }
  }

  /** Mensaje del asesor (modo agente). */
  agentSay(text: string): void {
    this.state.agentSpoke = true;
    this.botItem({ from: 'agent', kind: 'text', text });
    this.log('info', 'Mensaje del asesor', text);
    this.emitState();
  }

  /** El asesor cierra el chat: la conversación vuelve al bot por la intención de cierre. */
  agentClose(): void {
    this.log('act', 'El asesor cierra el chat', 'La conversación vuelve al bot');
    this.start(() => this.execIntent(this.bot.config.closeIntent));
  }

  /** Envía una plantilla saliente (HSM). Sus botones inician la rama definida en la plantilla. */
  sendTemplate(id: string): void {
    const t = this.bot.config.templates?.find((x) => x.id === id);
    if (!t) return;
    const msgId = this.botItem({
      kind: 'buttons',
      text: t.text,
      footer: t.footer,
      buttons: t.buttons.map((b) => ({ id: b.id, title: b.title })),
      template: t.id,
    });
    this.templateMsgs.set(msgId, t.id);
    this.log('info', 'Plantilla saliente enviada', `${t.id} · ${t.category}`);
  }

  setScenario(patch: Partial<Scenario>): void {
    const wasUnavailable = !this.scenario.agentsAvailable;
    this.scenario = { ...this.scenario, ...patch };
    if (patch.agentsAvailable && wasUnavailable && this.state.mode === 'queue') this.assign();
    this.emitState();
  }

  setSpeed(speed: 'fast' | 'real' | 'instant'): void {
    this.opts.typingMs = speed === 'instant' ? () => 0 : speed === 'fast' ? () => 180 : REALISTIC;
    this.opts.apiMs = speed === 'instant' ? 0 : speed === 'fast' ? 260 : 900;
  }

  /** Borra todo y vuelve al estado inicial. */
  reset(): void {
    this.runId++;
    this.abortWaiter();
    this.inbox = [];
    this.running = false;
    this.onceSeen.clear();
    this.templateMsgs.clear();
    this.flowMsgs.clear();
    this.fallbackCount = 0;
    this.prevIntent = null;
    this.state = this.initialState();
    this.emit({ type: 'reset' });
    this.emitState();
    this.flushSettle();
  }

  /** Resuelve cuando el motor espera una respuesta o terminó de ejecutar. Útil en tests. */
  settle(): Promise<void> {
    if (!this.running || (this.waiter && this.inbox.length === 0)) return Promise.resolve();
    return new Promise((r) => this.settleResolvers.push(r));
  }

  get isRunning(): boolean {
    return this.running;
  }

  /* ---------- ejecución ---------- */

  private initialState(): EngineState {
    return { mode: 'idle', intent: null, vars: {}, waiting: 'none', inactStage: 0, agentSpoke: false, typing: false, clockOffsetMin: 0 };
  }

  private start(job: () => Promise<void>): void {
    const my = ++this.runId;
    this.abortWaiter();
    this.inbox = [];
    this.running = true;
    this.state.mode = 'bot';
    this.emitState();
    void this.loop(my, job);
  }

  private async loop(my: number, first: () => Promise<void>): Promise<void> {
    let job: (() => Promise<void>) | null = first;
    while (job && my === this.runId) {
      try {
        await job();
        job = null;
        if (my === this.runId) this.log('info', 'La intención terminó sin salida', 'El próximo mensaje vuelve a la entrada');
      } catch (e) {
        if (e instanceof Jump) {
          const target = this.resolve(e.target);
          job = () => this.execIntent(target);
        } else if (e instanceof Stop) {
          job = null;
        } else if (e instanceof Abort) {
          return;
        } else {
          console.error(e);
          this.log('warn', 'Error del motor', String((e as Error)?.message ?? e));
          this.state.mode = 'idle';
          job = null;
        }
      }
    }
    if (my === this.runId) {
      this.running = false;
      this.state.waiting = 'none';
      this.emitState();
      this.flushSettle();
    }
  }

  private resolve(t: Target): string {
    const c = this.bot.config;
    if (t === '@back') return this.prevIntent ?? c.entry;
    if (t === '@self') return this.state.intent ?? c.entry;
    if (t === '@entry') return c.entry;
    if (t === '@close') return c.closeIntent;
    return t;
  }

  private async execIntent(id: string): Promise<void> {
    const it = this.intents.get(id);
    if (!it) throw new Error(`No existe la intención "${id}"`);
    if (this.state.intent !== id) this.prevIntent = this.state.intent;
    this.state.intent = id;
    this.log('intent', it.name, it.description, { intent: id });
    this.emitState();
    await this.execSteps(it.steps);
  }

  private async execSteps(steps: Step[] | undefined): Promise<void> {
    if (!steps) return;
    for (const s of steps) await this.exec(s);
  }

  private async follow(then?: Step[], goto?: Target): Promise<void> {
    if (goto) throw new Jump(goto);
    await this.execSteps(then);
  }

  private async exec(step: Step): Promise<void> {
    if (step.kind === 'message' && step.once) {
      if (this.onceSeen.has(step._id ?? '')) return;
      this.onceSeen.add(step._id ?? '');
    }
    if (step.pending) this.log('warn', 'Consulta pendiente', step.pending, { intent: this.state.intent ?? undefined });
    switch (step.kind) {
      case 'message': {
        await this.say(this.text(step.text));
        return;
      }
      case 'media': {
        await this.typing(30);
        this.botItem({ kind: 'media', media: step.media, caption: step.caption ? this.text(step.caption) : undefined });
        return;
      }
      case 'ask':
        return this.ask(step);
      case 'list':
      case 'buttons':
        return this.choose(step);
      case 'condition': {
        const b = step.branches.find((x) => this.test(x.when));
        if (b) {
          this.log('cond', `${step.label} → ${b.label}`);
          return this.follow(b.then, b.goto);
        }
        this.log('cond', `${step.label} → NO CUMPLE NINGUNA`);
        return this.follow(step.otherwise, step.otherwiseGoto);
      }
      case 'set': {
        for (const [k, v] of Object.entries(step.values)) {
          const val = typeof v === 'function' ? (v as (c: Ctx) => unknown)(this.ctx()) : typeof v === 'string' ? interpolate(v, this.state.vars) : v;
          this.setVar(k, val);
        }
        return;
      }
      case 'action': {
        this.log('act', step.label, step.detail);
        if (step.run) {
          await step.run(this.ctx());
          this.emitState();
        }
        return;
      }
      case 'api':
        return this.api(step);
      case 'flow':
        return this.flow(step);
      case 'goto':
        throw new Jump(step.target);
      case 'handoff':
        return this.handoff(step);
      case 'close':
        return this.close();
      case 'resumeQueue': {
        this.log('info', 'Sigue en la cola');
        this.state.mode = 'queue';
        this.emitState();
        throw new Stop();
      }
    }
  }

  /* ---------- pasos ---------- */

  private async ask(step: AskStep): Promise<void> {
    const cfg = this.bot.config;
    if (step.skipIf && this.test(step.skipIf)) {
      this.log('info', 'Pregunta salteada', `${step.saveAs} ya está en la sesión`);
      return;
    }
    const prompt = this.text(step.text);
    await this.say(prompt);
    for (;;) {
      const ev = await this.next('input');
      if (ev.type === 'tick') {
        await this.inactivity();
        continue;
      }
      const inp = ev.input;
      if (!inp.media && inp.text != null) {
        const esc = cfg.askEscape;
        if (step.escape !== false && esc && norm(inp.text) === norm(esc.input)) {
          this.log('info', `Escape “${esc.input}”`, `Va a ${this.nameOf(esc.goto)}`);
          throw new Jump(esc.goto);
        }
        const kw = this.keyword(inp);
        if (kw) throw kw;
        if (step.expect !== 'image') {
          const val = step.validate ? step.validate.fn(inp.text) : inp.text.trim() || null;
          if (val != null) {
            this.resetFallback();
            this.setVar(step.saveAs, val);
            return;
          }
        }
      } else if (inp.media) {
        if (step.expect === 'image' && inp.media.type === 'image') {
          this.resetFallback();
          this.setVar(step.saveAs, `(imagen · ${inp.media.name ?? 'foto'})`);
          this.log('act', 'Convertir la imagen a Base64', 'Para enviarla al endpoint');
          return;
        }
        if (step.expect !== 'image') {
          const r = await this.unexpectedMedia(inp.media.type, 'ask');
          if (r === 'handled') {
            await this.say(prompt);
            continue;
          }
        } else if (inp.media.type === 'audio') {
          await this.say(cfg.media.audio);
        }
      }
      const n = this.bumpFallback();
      this.log('cond', `Validación de ${step.saveAs} → inválido`, `Intento ${n} de ${cfg.fallback.maxAttempts}${step.validate ? ' · ' + step.validate.name : ''}`);
      await this.say(step.error ? this.text(step.error) : step.expect === 'image' ? cfg.media.imageNeeded : cfg.fallback.invalidInput);
    }
  }

  private async choose(step: ListStep | ButtonsStep): Promise<void> {
    const cfg = this.bot.config;
    const fb = cfg.fallback;
    const isList = step.kind === 'list';
    const cap = isList ? WA.listRows : WA.buttons;
    const statics: RowRef[] = (isList ? step.rows : step.buttons).map((c) => ({ id: c.id, title: c.title, description: c.description, match: c.match, choice: c }));
    let dyn: RowRef[] = [];
    const dynDef = isList ? step.dynamic : undefined;
    if (dynDef) {
      let rows: Row[] = [];
      try {
        rows = dynDef.rows(this.ctx());
      } catch (e) {
        this.log('warn', 'Error al armar las filas dinámicas', String((e as Error)?.message ?? e));
      }
      const room = dynDef.max ?? cap - statics.length;
      if (rows.length > room) this.log('warn', `Hay ${rows.length} filas y solo entran ${room}`, 'Se muestran las primeras: en Botmaker hace falta paginar');
      dyn = rows.slice(0, room).map((r) => ({ ...r, dynamic: true }));
    }
    const base = [...dyn, ...statics];
    const valid = new Set<string>();
    let shown = base;

    const show = async (offerAgent: boolean) => {
      const rows = base.slice();
      if (offerAgent) {
        if (rows.length < cap) rows.push({ id: OFFER_AGENT, title: isList ? fb.agentChoice.list : fb.agentChoice.buttons });
        else this.log('warn', 'No hay lugar para ofrecer un asesor', isList ? 'La lista ya tiene 10 filas' : 'El mensaje ya tiene 3 botones');
      }
      let body = this.text(step.text);
      if (body.length > WA.interactiveBody) {
        await this.say(body);
        body = cfg.longBodyFallback ?? '¿Algo más?';
        this.log('warn', 'Cuerpo de más de 1024 caracteres', 'Se envió el texto aparte y el menú con un cuerpo corto');
      }
      await this.typing(body.length);
      const id = isList
        ? this.botItem({ kind: 'list', text: body, header: step.header, footer: step.footer, button: step.button, section: step.section, rows: rows.map(({ id, title, description }) => ({ id, title, description })) })
        : this.botItem({ kind: 'buttons', text: body, header: (step as ButtonsStep).header, footer: step.footer, buttons: rows.map(({ id, title }) => ({ id, title })) });
      valid.add(id);
      shown = rows;
    };

    await show(false);
    for (;;) {
      const ev = await this.next(step.onTimeout ? 'timed' : 'input');
      if (ev.type === 'tick') {
        if (step.onTimeout) {
          const min = step.timeoutMin ?? 5;
          this.advance(min);
          this.log('cond', `Sin respuesta · ${min} min`, 'Se ejecuta la rama de tiempo agotado');
          await this.execSteps(step.onTimeout);
          return;
        }
        await this.inactivity();
        continue;
      }
      const inp = ev.input;
      const hit = this.match(shown, inp, valid);
      if (hit) {
        this.resetFallback();
        this.log('user', `Eligió “${hit.title}”`);
        if (hit.id === OFFER_AGENT) throw new Jump(fb.escalateTo);
        if (hit.dynamic && dynDef) {
          this.setVar(dynDef.saveAs, hit.id);
          await this.execSteps(dynDef.then);
          return;
        }
        const c = hit.choice!;
        if (step.saveAs) this.setVar(step.saveAs, c.id);
        if (c.set) for (const [k, v] of Object.entries(c.set)) this.setVar(k, v);
        return this.follow(c.then, c.goto);
      }
      if (step.onFreeText && inp.text && !inp.media) {
        this.lastInput = inp.text;
        this.log('user', 'Texto libre', inp.text);
        await this.execSteps(step.onFreeText);
        this.lastInput = undefined;
        return;
      }
      const kw = this.keyword(inp);
      if (kw) throw kw;
      if (inp.media) {
        const r = await this.unexpectedMedia(inp.media.type, 'choice');
        if (r === 'handled') {
          await show(false);
          continue;
        }
      }
      const n = this.bumpFallback();
      this.log('intent', '↳ No entiende', `Intento ${n} de ${fb.maxAttempts}`);
      await this.say(n === 1 ? (isList ? fb.list : fb.buttons) : fb.retry);
      await show(n === (fb.offerAgentOnAttempt ?? 2));
    }
  }

  private async flow(step: FlowStep): Promise<void> {
    const cfg = this.bot.config;
    const valid = new Set<string>();
    const show = async () => {
      const text = this.text(step.text);
      await this.typing(text.length);
      const id = this.botItem({ kind: 'flow', text, header: step.header, footer: step.footer, cta: step.cta, flowName: step.flowName, screens: step.screens });
      this.flowMsgs.set(id, step.screens);
      valid.add(id);
    };
    await show();
    for (;;) {
      const ev = await this.next('input');
      if (ev.type === 'tick') {
        await this.inactivity();
        continue;
      }
      const inp = ev.input;
      if (inp.flowReply && valid.has(inp.flowReply.messageId)) {
        this.resetFallback();
        const values: FlowValues = {};
        for (const f of flowFields(step.screens)) {
          const v = inp.flowReply.values[f.name];
          if (v != null && v !== '') values[f.name] = normalizeFlowValue(f, v);
        }
        this.log('user', `Envió el Flow “${step.flowName ?? step.cta}”`, flowSummary(step.screens, values).map((a) => `${a.label}: ${a.value}`).join(' · '));
        for (const [k, v] of Object.entries(values)) this.setVar(k, v);
        if (step.saveAs) this.setVar(step.saveAs, values);
        return;
      }
      const esc = cfg.askEscape;
      if (esc && inp.text != null && !inp.media && norm(inp.text) === norm(esc.input)) {
        this.log('info', `Escape “${esc.input}”`, `Va a ${this.nameOf(esc.goto)}`);
        throw new Jump(esc.goto);
      }
      const kw = this.keyword(inp);
      if (kw) throw kw;
      if (inp.media) {
        const r = await this.unexpectedMedia(inp.media.type, 'choice');
        if (r === 'handled') continue;
      }
      const n = this.bumpFallback();
      this.log('intent', '↳ No entiende', `Escribió en vez de completar el Flow · intento ${n} de ${cfg.fallback.maxAttempts}`);
      await this.say(step.retry ?? `Para continuar, tocá “${step.cta}” y completá el formulario.`);
      await show();
    }
  }

  private match(rows: RowRef[], inp: UserInput, valid: Set<string>): RowRef | null {
    if (inp.replyTo && valid.has(inp.replyTo.messageId)) {
      const r = rows.find((x) => x.id === inp.replyTo!.choiceId);
      if (r) return r;
    }
    if (inp.text && !inp.media) {
      const t = norm(inp.text);
      if (!t) return null;
      return rows.find((r, i) => (r.match ? r.match.some((m) => norm(m) === t) : String(i + 1) === t) || norm(r.title) === t) ?? null;
    }
    return null;
  }

  private async api(step: ApiStep): Promise<void> {
    const cfg = this.bot.config;
    const ep = this.bot.endpoints[step.endpoint];
    if (!ep) throw new Error(`No existe el endpoint "${step.endpoint}"`);
    const params = step.params(this.ctx());
    const request = cfg.api?.formatRequest ? cfg.api.formatRequest(params) : params;
    const label = step.label ?? `${ep.ref ? ep.ref + ' · ' : ''}${ep.name}`;
    if (ep.pending) this.log('warn', `Consulta pendiente · ${ep.ref ?? ep.name}`, ep.pending);
    await this.busy(ep.latencyMs ?? this.opts.apiMs);

    if (this.scenario.endpointsDown) {
      this.log('api', label, 'Sin respuesta (timeout)', { api: { endpoint: step.endpoint, name: ep.name, ref: ep.ref, request, response: 'timeout' } });
      for (let i = 0; i < cfg.endpointError.retries; i++) {
        this.log('act', `Reintentar (${i + 1} de ${cfg.endpointError.retries})`);
        await this.busy(this.opts.apiMs);
        this.log('api', label, 'Sin respuesta otra vez', { api: { endpoint: step.endpoint, name: ep.name, ref: ep.ref, request, response: 'timeout' } });
      }
      this.log('intent', '↳ Error de endpoint');
      await this.execSteps(cfg.endpointError.steps);
      throw new Stop();
    }

    let res: unknown;
    try {
      res = await ep.mock(params, this.ctx());
    } catch (e) {
      res = { error: String((e as Error)?.message ?? e) };
      this.log('warn', 'El mock del endpoint falló', String((e as Error)?.message ?? e));
    }
    this.lastRes = res;
    this.log('api', label, this.summarize(res), { api: { endpoint: step.endpoint, name: ep.name, ref: ep.ref, request, response: res } });
    if (step.saveAs) this.setVar(step.saveAs, res);

    if (step.branches?.length || step.otherwise || step.otherwiseGoto) {
      const b = (step.branches ?? []).find((x) => this.test(x.when));
      if (b) {
        this.log('cond', `${label} → ${b.label}`);
        return this.follow(b.then, b.goto);
      }
      this.log('cond', `${label} → NO CUMPLE NINGUNA`);
      return this.follow(step.otherwise, step.otherwiseGoto);
    }
  }

  private async handoff(step: HandoffStep): Promise<void> {
    const h = this.bot.config.handoff;
    const q = h.queues[step.queue];
    const qLabel = q?.label ?? step.queue;
    const topic = step.topic ? this.text(step.topic) : undefined;
    this.setVar('cola_destino', step.queue);
    if (step.topicId != null) this.setVar('topicID', String(step.topicId));
    if (!this.scenario.inHours) {
      this.log('cond', `¿En horario de ${qLabel}? → NO CUMPLE NINGUNA`);
      await this.execSteps(h.outOfHours);
      throw new Stop();
    }
    this.log('cond', `¿En horario de ${qLabel}? → SI CUMPLE`);
    this.log('act', 'Establecer cola de atención', qLabel);
    this.log('act', 'Etiquetar la conversación', [topic, step.topicId != null ? `topicID ${step.topicId}` : ''].filter(Boolean).join(' · ') || undefined);
    this.log('act', 'Chatbot apagado', 'El bot deja de responder');
    this.state.queue = step.queue;
    if (this.scenario.agentsAvailable) this.assign();
    else {
      this.state.mode = 'queue';
      this.log('info', 'Sin asesores disponibles', 'La conversación queda en cola');
    }
    this.emitState();
    throw new Stop();
  }

  private assign(): void {
    this.log('act', 'Asignar la conversación a…', `${this.bot.config.handoff.agentName ?? 'Asesor de prueba'} · round-robin`);
    this.log('act', 'Notificar', 'Aviso al asesor asignado');
    this.state.mode = 'agent';
    this.emitState();
  }

  private async close(): Promise<void> {
    const cfg = this.bot.config;
    const kept: Vars = {};
    for (const k of cfg.contactVars) if (k in this.state.vars) kept[k] = this.state.vars[k];
    this.state.vars = kept;
    this.log('act', 'Limpiar variables de sesión', cfg.contactVars.length ? `Quedan: ${cfg.contactVars.join(', ')}` : undefined);
    for (const a of cfg.closeActions) this.log('act', a);
    this.onceSeen.clear();
    this.fallbackCount = 0;
    this.prevIntent = null;
    Object.assign(this.state, { mode: 'idle', intent: null, waiting: 'none', inactStage: 0, agentSpoke: false, queue: undefined });
    this.emitState();
    throw new Stop();
  }

  private async runTemplate(tplId: string, buttonId: string): Promise<void> {
    const t = this.bot.config.templates?.find((x) => x.id === tplId);
    this.log('intent', `↳ Respuesta a plantilla · ${t?.name ?? tplId}`);
    const c = t?.buttons.find((b) => b.id === buttonId);
    if (!c) throw new Jump(this.bot.config.entry);
    this.log('cond', `¿Qué plantilla respondió? → ${tplId}`, `Botón “${c.title}”`);
    if (c.set) for (const [k, v] of Object.entries(c.set)) this.setVar(k, v);
    await this.follow(c.then, c.goto);
  }

  /* ---------- comportamientos globales ---------- */

  private keyword(inp: UserInput): Jump | null {
    if (inp.media || !inp.text) return null;
    const t = norm(inp.text);
    const k = this.bot.config.keywords.find((x) => x.words.some((w) => norm(w) === t));
    if (!k) return null;
    this.log('info', `Palabra clave global: “${inp.text.trim()}”`, `Va a ${this.nameOf(k.goto)}`);
    return new Jump(k.goto);
  }

  private async inactivity(): Promise<void> {
    const ia = this.bot.config.inactivity;
    if (this.state.inactStage === 0) {
      this.state.inactStage = 1;
      this.advance(ia.reminderAfterMin);
      this.log('intent', '↳ Inactividad del cliente', `${ia.reminderAfterMin} min sin respuesta`);
      await this.say(ia.reminder);
      this.emitState();
      return;
    }
    this.advance(ia.closeAfterMin);
    this.state.inactStage = 0;
    this.log('cond', `¿Respondió en ${ia.closeAfterMin} min? → NO CUMPLE NINGUNA`, `Va a ${this.nameOf(ia.goto)}`);
    throw new Jump(ia.goto);
  }

  private async unexpectedMedia(type: UserMedia['type'], where: 'ask' | 'choice'): Promise<'handled' | 'fallback'> {
    const m = this.bot.config.media;
    const names: Record<string, string> = { image: 'Imagen', document: 'Documento', video: 'Video', audio: 'Audio', sticker: 'Sticker', location: 'Ubicación', contact: 'Contacto' };
    this.log('intent', '↳ Archivos inesperados', names[type]);
    if (type === 'audio') {
      await this.say(m.audio);
      return 'handled';
    }
    if (type === 'image' || type === 'document' || type === 'video') {
      await this.say(where === 'ask' ? m.fileInAsk : m.fileInChoice);
      return 'handled';
    }
    return 'fallback';
  }

  private bumpFallback(): number {
    const fb = this.bot.config.fallback;
    const n = ++this.fallbackCount;
    this.setVar('intentos_fallback', n);
    if (n >= fb.maxAttempts) {
      this.resetFallback();
      this.log('act', `${fb.maxAttempts} intentos fallidos`, `Va a ${this.nameOf(fb.escalateTo)}`);
      throw new Jump(fb.escalateTo);
    }
    return n;
  }

  private resetFallback(): void {
    if (this.fallbackCount > 0) {
      this.fallbackCount = 0;
      this.setVar('intentos_fallback', null);
    }
  }

  /* ---------- utilidades ---------- */

  private ctx(): Ctx {
    return { vars: this.state.vars, res: this.lastRes, input: this.lastInput, intent: this.state.intent ?? '', now: this.clock() };
  }

  private text(t: TextValue): string {
    try {
      return typeof t === 'function' ? t(this.ctx()) : interpolate(t, this.state.vars);
    } catch (e) {
      this.log('warn', 'Error al armar un texto', String((e as Error)?.message ?? e));
      return '';
    }
  }

  private test(p: Pred): boolean {
    try {
      return !!p(this.ctx());
    } catch (e) {
      this.log('warn', 'Error al evaluar una condición', String((e as Error)?.message ?? e));
      return false;
    }
  }

  private nameOf(t: Target): string {
    const id = this.resolve(t);
    return this.intents.get(id)?.name ?? id;
  }

  private summarize(res: unknown): string {
    const s = this.bot.config.api?.summarize;
    if (s) {
      try {
        return s(res);
      } catch {
        /* sigue con el resumen genérico */
      }
    }
    const r = res as { message?: { cod?: unknown; desc?: unknown }; cod?: unknown; code?: unknown; status?: unknown } | null;
    const c = r?.message?.cod ?? r?.cod ?? r?.code;
    const d = r?.message?.desc;
    return c != null ? `cod ${String(c)}${d ? ' · ' + String(d) : ''}` : display(res);
  }

  private setVar(k: string, v: unknown): void {
    if (v === null || v === undefined) delete this.state.vars[k];
    else this.state.vars[k] = v;
    this.log('var', `${k} = ${display(v)}`);
    this.emitState();
  }

  private advance(min: number): void {
    this.state.clockOffsetMin += min;
  }

  private clock(): Date {
    return new Date(this.opts.now() + this.state.clockOffsetMin * 60000);
  }

  private hhmm(withSeconds = false): string {
    const d = this.clock();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}${withSeconds ? ':' + p(d.getSeconds()) : ''}`;
  }

  private async say(text: string): Promise<void> {
    await this.typing(text.length);
    this.botItem({ kind: 'text', text });
  }

  private async typing(len: number): Promise<void> {
    this.setTyping(true);
    try {
      await this.sleep(this.opts.typingMs(len));
    } finally {
      this.setTyping(false);
    }
  }

  private async busy(ms: number): Promise<void> {
    this.setTyping(true);
    try {
      await this.sleep(ms);
    } finally {
      this.setTyping(false);
    }
  }

  private setTyping(on: boolean): void {
    if (this.state.typing === on) return;
    this.state.typing = on;
    this.emitState();
  }

  private async sleep(ms: number): Promise<void> {
    const tok = this.runId;
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
    else await Promise.resolve();
    if (tok !== this.runId) throw new Abort();
  }

  private next(kind: 'input' | 'timed'): Promise<Ev> {
    if (this.inbox.length) return Promise.resolve(this.inbox.shift()!);
    const tok = this.runId;
    this.state.waiting = kind;
    this.emitState();
    return new Promise<Ev>((res, rej) => {
      this.waiter = {
        res: (e) => {
          this.state.waiting = 'none';
          res(e);
        },
        rej,
      };
      if (tok === this.runId) this.flushSettle();
    });
  }

  private push(ev: Ev): void {
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w.res(ev);
    } else this.inbox.push(ev);
  }

  private abortWaiter(): void {
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w.rej(new Abort());
    }
  }

  private flushSettle(): void {
    const r = this.settleResolvers;
    this.settleResolvers = [];
    r.forEach((f) => f());
  }

  private userItem(input: UserInput): ChatItem {
    const id = `m${++this.seq}`;
    const time = this.hhmm();
    if (input.media) return { id, from: 'user', kind: 'media', media: input.media, time };
    if (input.flowReply) {
      const screens = this.flowMsgs.get(input.flowReply.messageId) ?? [];
      return { id, from: 'user', kind: 'flow', flowId: input.flowReply.messageId, answers: flowSummary(screens, input.flowReply.values), time };
    }
    return { id, from: 'user', kind: 'text', text: input.text ?? '', subtext: input.subtext, time };
  }

  private botItem(partial: any): string {
    const id = `m${++this.seq}`;
    const item = { from: 'bot', ...partial, id, time: this.hhmm() } as ChatItem;
    this.emit({ type: 'chat', item });
    return id;
  }

  private log(kind: LogKind, title: string, detail?: string, extra: Partial<LogEntry> = {}): void {
    this.emit({ type: 'log', entry: { id: ++this.logSeq, time: this.hhmm(true), kind, title, detail, ...extra } });
  }

  private emitState(): void {
    this.emit({ type: 'state', state: { ...this.state, vars: { ...this.state.vars } } });
  }

  private emit(e: EngineEvent): void {
    this.listeners.forEach((fn) => fn(e));
  }
}
