import type { BotDef, Branch, Choice, Intent, Notes, Step, Target } from '../../core/types';
import { WA } from '../../core/limits';
import { firstLine } from '../../core/text';
import { flowFields } from '../../core/flow';

/*
 * Convierte una intención (pasos estructurados) en un árbol dibujable
 * con el vocabulario de Botmaker, lo ubica en el plano y calcula las conexiones.
 */

export type NodeKind = 'start' | 'message' | 'media' | 'ask' | 'flow' | 'menu' | 'option' | 'condition' | 'action' | 'api' | 'goto' | 'handoff' | 'pass' | 'event';

export interface RBranch {
  label?: string;
  tone: 'yes' | 'no' | 'plain';
  head: RNode;
}

export interface RNode {
  key: string;
  kind: NodeKind;
  title: string;
  sub?: string;
  pill?: string;
  pillFull?: boolean;
  step?: Step;
  choice?: Choice | Branch;
  intent?: Intent;
  target?: string;
  dynamic?: boolean;
  dashed?: boolean;
  inButtons?: boolean;
  notes: Notes;
  /** No continúa al paso siguiente (salto, derivación, cierre). */
  terminal?: boolean;
  branches: RBranch[];
  next: RNode | null;
  // layout
  w: number;
  h: number;
  x: number;
  y: number;
  sw: number;
  cols: number[];
  nw: number;
}

export const NODE_W: Record<NodeKind, number> = {
  start: 210,
  message: 214,
  media: 214,
  ask: 214,
  flow: 214,
  menu: 214,
  option: 160,
  condition: 112,
  action: 214,
  api: 214,
  goto: 140,
  handoff: 214,
  pass: 14,
  event: 176,
};
const FIXED_H: Partial<Record<NodeKind, number>> = { condition: 112, pass: 14 };
const GX = 24;
const GY = 40;
const LBL = 26;

let uid = 0;
function node(kind: NodeKind, key: string | undefined, title: string, extra: Partial<RNode> = {}): RNode {
  return { key: key ?? `n${++uid}`, kind, title, notes: {}, branches: [], next: null, w: NODE_W[kind], h: FIXED_H[kind] ?? 44, x: 0, y: 0, sw: 0, cols: [], nw: 0, ...extra };
}

const pick = (n: Notes): Notes => ({ note: n.note, todo: n.todo, pending: n.pending, suggested: n.suggested, rec: n.rec, example: n.example });
const textOf = (t: unknown, example?: string): string => (typeof t === 'string' ? t : example ?? '(texto calculado)');

export function targetName(bot: BotDef, t: Target): { name: string; dynamic: boolean; id?: string } {
  const c = bot.config;
  if (t === '@back') return { name: 'Intención anterior', dynamic: true };
  if (t === '@self') return { name: 'Repetir esta intención', dynamic: true };
  const id = t === '@entry' ? c.entry : t === '@close' ? c.closeIntent : t;
  const it = bot.intents.find((i) => i.id === id);
  return { name: it?.name ?? `⚠ ${id}`, dynamic: false, id };
}

function gotoNode(bot: BotDef, t: Target, key: string, label?: string): RNode {
  const tn = targetName(bot, t);
  return node('goto', key, tn.name, { target: tn.id, dynamic: tn.dynamic, terminal: true, sub: label });
}

interface Chain {
  head: RNode;
  tail: RNode;
}

function seq(bot: BotDef, steps: Step[] | undefined): RNode | null {
  if (!steps?.length) return null;
  let head: RNode | null = null;
  let tail: RNode | null = null;
  for (const s of steps) {
    const c = stepChain(bot, s);
    if (!head) head = c.head;
    else tail!.next = c.head;
    tail = c.tail;
  }
  return head;
}

function branchHead(bot: BotDef, then: Step[] | undefined, goto: Target | undefined, key: string): RNode {
  if (goto) return gotoNode(bot, goto, `${key}:goto`);
  return seq(bot, then) ?? node('pass', `${key}:pass`, '');
}

function stepChain(bot: BotDef, s: Step): Chain {
  const one = (n: RNode): Chain => ({ head: n, tail: n });
  const notes = pick(s);
  switch (s.kind) {
    case 'message':
      return one(node('message', s._id, s.label ?? 'Mensaje de texto', { sub: firstLine(textOf(s.text, s.example)), step: s, notes }));
    case 'media': {
      const names = { image: 'Enviar imagen', document: 'Enviar documento', video: 'Enviar video', audio: 'Enviar audio' };
      return one(node('media', s._id, s.label ?? names[s.media.type], { sub: s.media.name ?? s.media.placeholder?.title, step: s, notes }));
    }
    case 'ask':
      return one(node('ask', s._id, s.label ?? (s.expect === 'image' ? 'Pedir una foto' : 'Pregunta'), { sub: `Guarda en ${s.saveAs}`, step: s, notes }));
    case 'flow': {
      const fields = flowFields(s.screens).length;
      return one(
        node('flow', s._id, s.label ?? s.flowName ?? 'WhatsApp Flow', {
          sub: `Botón “${s.cta}” · ${s.screens.length} ${s.screens.length === 1 ? 'pantalla' : 'pantallas'} · ${fields} campos`,
          pill: 'Flow',
          step: s,
          notes,
        }),
      );
    }
    case 'list':
    case 'buttons': {
      const isList = s.kind === 'list';
      const choices = isList ? s.rows : s.buttons;
      const count = choices.length + (isList && s.dynamic ? 1 : 0);
      const cap = isList ? WA.listRows : WA.buttons;
      const n = node('menu', s._id, s.label ?? firstLine(textOf(s.text, s.example), 60), {
        step: s,
        notes,
        sub: isList ? `Lista · botón “${s.button}”` : 'Botones',
        pill: `${isList && s.dynamic ? 'n' : count}/${cap}`,
        pillFull: count >= cap,
      });
      if (isList && s.dynamic) {
        const d = s.dynamic;
        const opt = node('option', `${s._id}:dyn`, 'Filas dinámicas', { sub: d.label, dashed: true, step: s, notes: {} });
        opt.next = seq(bot, d.then);
        n.branches.push({ tone: 'plain', head: opt });
      }
      for (const c of choices) {
        const o = node('option', c._id, c.title, { choice: c, inButtons: !isList, notes: pick(c) });
        o.next = c.goto ? gotoNode(bot, c.goto, `${c._id}:goto`) : seq(bot, c.then);
        n.branches.push({ tone: 'plain', head: o });
      }
      if (s.onFreeText) {
        const e = node('event', `${s._id}:free`, 'Texto libre', { sub: 'No coincide con ninguna opción', dashed: true, notes: {} });
        e.next = seq(bot, s.onFreeText);
        n.branches.push({ tone: 'plain', head: e });
      }
      if (s.onTimeout) {
        const e = node('event', `${s._id}:timeout`, `Sin respuesta · ${s.timeoutMin ?? 5} min`, { dashed: true, notes: {} });
        e.next = seq(bot, s.onTimeout);
        n.branches.push({ tone: 'plain', head: e });
      }
      return one(n);
    }
    case 'condition':
    case 'api': {
      const isApi = s.kind === 'api';
      const ep = isApi ? bot.endpoints[s.endpoint] : undefined;
      const n = isApi
        ? node('api', s._id, s.label ?? ep?.name ?? s.endpoint, { sub: ep ? `${ep.method ?? 'POST'} ${ep.path ?? s.endpoint}` : `⚠ endpoint “${s.endpoint}” no existe`, pill: ep?.ref, step: s, notes: { ...notes, pending: notes.pending ?? ep?.pending, todo: notes.todo ?? ep?.todo } })
        : node('condition', s._id, s.label, { step: s, notes });
      const branches = s.branches ?? [];
      const hasElse = s.otherwise !== undefined || s.otherwiseGoto !== undefined;
      if (isApi && !branches.length && !hasElse) return one(n);
      for (const b of branches) n.branches.push({ label: b.label, tone: 'yes', head: branchHead(bot, b.then, b.goto, b._id ?? `${s._id}:b`) });
      if (!(s.kind === 'condition' && s._noElse)) n.branches.push({ label: 'NO CUMPLE NINGUNA', tone: 'no', head: branchHead(bot, s.otherwise, s.otherwiseGoto, `${s._id}:else`) });
      return one(n);
    }
    case 'set':
      return one(node('action', s._id, s.label ?? 'Guardar variables', { sub: Object.keys(s.values).join(', '), step: s, notes }));
    case 'action':
      return one(node('action', s._id, s.label, { sub: s.detail ?? (s.run ? 'Acción de código' : undefined), step: s, notes }));
    case 'goto':
      return one(gotoNode(bot, s.target, s._id ?? `g${++uid}`));
    case 'handoff': {
      const q = bot.config.handoff.queues[s.queue];
      const topic = typeof s.topic === 'string' ? s.topic : s.topic ? 'Tema calculado' : undefined;
      return one(node('handoff', s._id, 'Derivar a asesor', { sub: [`Cola ${q?.label ?? '⚠ ' + s.queue}`, topic].filter(Boolean).join(' · '), step: s, notes, terminal: true }));
    }
    case 'close': {
      const labels = ['Limpiar variables de sesión', ...bot.config.closeActions];
      const nodes = labels.map((l, i) => node('action', `${s._id}:c${i}`, l, { step: s, notes: i === 0 ? notes : {}, sub: i === 0 ? 'Quedan las variables del contacto' : undefined }));
      nodes.forEach((n, i) => (n.next = nodes[i + 1] ?? null));
      nodes[nodes.length - 1].terminal = true;
      return { head: nodes[0], tail: nodes[nodes.length - 1] };
    }
    case 'resumeQueue':
      return one(node('action', s._id, 'Volver a la cola', { step: s, notes, terminal: true }));
  }
}

export function buildTree(bot: BotDef, intent: Intent): RNode {
  const root = node('start', `${intent.id}:start`, intent.id.startsWith('sys:') ? intent.name : `Entrada · ${intent.name}`, { intent, notes: pick(intent) });
  root.next = seq(bot, intent.steps);
  return root;
}

/** Recorre el árbol (ramas y continuación). */
export function walk(n: RNode | null, fn: (n: RNode) => void): void {
  if (!n) return;
  fn(n);
  n.branches.forEach((b) => walk(b.head, fn));
  walk(n.next, fn);
}

/** Últimos nodos de una cadena que siguen al paso siguiente (para dibujar los "joins"). */
function terminals(n: RNode): RNode[] {
  if (n.next) return terminals(n.next);
  if (n.branches.length) return n.branches.flatMap((b) => terminals(b.head));
  return n.terminal ? [] : [n];
}

const labelW = (t?: string) => (t ? t.length * 6.4 + 18 : 0);

function measure(n: RNode): number {
  n.cols = n.branches.map((b) => Math.max(measure(b.head), labelW(b.label)));
  const bw = n.cols.length ? n.cols.reduce((a, b) => a + b, 0) + GX * (n.cols.length - 1) : 0;
  n.nw = n.next ? measure(n.next) : 0;
  n.sw = Math.max(n.w, bw, n.nw);
  return n.sw;
}

function place(n: RNode, left: number, top: number): number {
  n.x = left + (n.sw - n.w) / 2;
  n.y = top;
  let bottom = top + n.h;
  if (n.branches.length) {
    const bw = n.cols.reduce((a, b) => a + b, 0) + GX * (n.cols.length - 1);
    let cx = left + (n.sw - bw) / 2;
    const g = GY + (n.branches.some((b) => b.label) ? LBL : 0);
    n.branches.forEach((b, i) => {
      bottom = Math.max(bottom, place(b.head, cx + (n.cols[i] - b.head.sw) / 2, top + n.h + g));
      cx += n.cols[i] + GX;
    });
  }
  if (n.next) bottom = place(n.next, left + (n.sw - n.nw) / 2, bottom + GY + (n.branches.length ? 8 : 0));
  return bottom;
}

export interface Edge {
  d: string;
  dashed?: boolean;
}
export interface EdgeLabel {
  x: number;
  y: number;
  text: string;
  tone: 'yes' | 'no' | 'plain';
}
export interface Layout {
  width: number;
  height: number;
  edges: Edge[];
  labels: EdgeLabel[];
}

const MARGIN = 70;

/** Ubica el árbol usando las alturas medidas en el DOM y calcula las conexiones. */
export function layout(root: RNode, heights: Map<string, number>): Layout {
  walk(root, (n) => {
    n.w = NODE_W[n.kind];
    n.h = FIXED_H[n.kind] ?? heights.get(n.key) ?? 44;
  });
  measure(root);
  const bottom = place(root, MARGIN, MARGIN);
  const edges: Edge[] = [];
  const labels: EdgeLabel[] = [];
  const cx = (n: RNode) => n.x + n.w / 2;
  const topOf = (n: RNode) => (n.kind === 'condition' ? n.y + 5 : n.y);
  const bottomOf = (n: RNode) => (n.kind === 'condition' ? n.y + n.h - 6 : n.y + n.h);
  const isDashed = (n: RNode) => n.kind === 'event';

  walk(root, (p) => {
    const pb = bottomOf(p);
    const bar = p.y + p.h + 14;
    if (p.branches.length) {
      p.branches.forEach((b, i) => {
        const k = b.head;
        const last = i === p.branches.length - 1;
        if (p.kind === 'condition' && b.tone === 'no' && last && p.branches.length > 1 && cx(k) > p.x + p.w + 4) {
          edges.push({ d: `M${p.x + p.w - 6} ${p.y + p.h / 2} H${cx(k)} V${topOf(k)}`, dashed: isDashed(k) });
        } else {
          edges.push({ d: `M${cx(p)} ${pb} V${bar} H${cx(k)} V${topOf(k)}`, dashed: isDashed(k) });
        }
        if (b.label) labels.push({ x: cx(k), y: k.y - 19, text: b.label, tone: b.tone });
      });
      if (p.next) {
        const j = p.next;
        const jb = j.y - 16;
        p.branches
          .flatMap((b) => terminals(b.head))
          .forEach((t) => edges.push({ d: `M${cx(t)} ${bottomOf(t)} V${jb} H${cx(j)} V${topOf(j)}`, dashed: isDashed(t) }));
      }
    } else if (p.next) {
      edges.push({ d: `M${cx(p)} ${pb} V${topOf(p.next)}` });
    }
  });
  return { width: root.sw + MARGIN * 2, height: bottom + MARGIN, edges, labels };
}
