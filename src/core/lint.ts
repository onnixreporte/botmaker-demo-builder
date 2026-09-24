import { WA, chars } from './limits';
import type { BotDef, Choice, Step, Target } from './types';

export interface Issue {
  level: 'error' | 'warn';
  /** Intención (o `config`, `plantillas`) donde está el problema. */
  where: string;
  stepId?: string;
  message: string;
}

const SPECIAL = new Set(['@back', '@self', '@entry', '@close']);

/**
 * Revisa un bot contra los límites de WhatsApp y la coherencia del flujo.
 * `error`: WhatsApp lo rechazaría o el flujo se rompe. `warn`: conviene revisarlo.
 */
export function lintBot(bot: BotDef): Issue[] {
  const issues: Issue[] = [];
  const cfg = bot.config;
  const ids = new Set<string>();
  const referenced = new Set<string>([cfg.entry, cfg.closeIntent]);

  for (const it of bot.intents) {
    if (ids.has(it.id)) issues.push({ level: 'error', where: it.id, message: `Id de intención repetido: "${it.id}"` });
    ids.add(it.id);
    if (!cfg.groups.includes(it.group)) issues.push({ level: 'warn', where: it.id, message: `El grupo "${it.group}" no está en config.groups: quedará al final de la barra lateral` });
  }

  const target = (t: Target | undefined, where: string, stepId?: string) => {
    if (!t) return;
    if (SPECIAL.has(t)) return;
    referenced.add(t);
    if (!ids.has(t)) issues.push({ level: 'error', where, stepId, message: `Salto a una intención que no existe: "${t}"` });
  };

  target(cfg.entry, 'config');
  target(cfg.closeIntent, 'config');
  cfg.keywords.forEach((k) => target(k.goto, 'config'));
  target(cfg.askEscape?.goto, 'config');
  target(cfg.fallback.escalateTo, 'config');
  target(cfg.inactivity.goto, 'config');
  const nav = cfg.nav;
  target(nav.menu.goto, 'config');
  target(nav.close.goto, 'config');
  for (const [k, t] of [['menu', nav.menu.title], ['back', nav.back.title], ['close', nav.close.title]] as const) {
    if (chars(t) > WA.buttonTitle) issues.push({ level: 'error', where: 'config', message: `Botón de navegación "${k}" con ${chars(t)} caracteres (máx. ${WA.buttonTitle})` });
  }
  for (const q of Object.keys(cfg.handoff.queues)) if (!q) issues.push({ level: 'error', where: 'config', message: 'Cola sin nombre' });

  const text = (t: unknown) => (typeof t === 'string' ? t : null);

  const checkChoices = (list: Choice[], kind: 'list' | 'buttons', where: string, stepId: string) => {
    const max = kind === 'list' ? WA.rowTitle : WA.buttonTitle;
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    for (const c of list) {
      if (seenIds.has(c.id)) issues.push({ level: 'error', where, stepId, message: `Id de opción repetido: "${c.id}"` });
      seenIds.add(c.id);
      if (seenTitles.has(c.title)) issues.push({ level: 'warn', where, stepId, message: `Título de opción repetido: "${c.title}"` });
      seenTitles.add(c.title);
      if (chars(c.title) > max) issues.push({ level: 'error', where, stepId: c._id ?? stepId, message: `"${c.title}" tiene ${chars(c.title)} caracteres (máx. ${max} en ${kind === 'list' ? 'filas de lista' : 'botones'})` });
      if (c.description) {
        if (kind === 'buttons') issues.push({ level: 'warn', where, stepId, message: `Los botones no muestran descripción ("${c.title}")` });
        else if (chars(c.description) > WA.rowDescription) issues.push({ level: 'error', where, stepId: c._id ?? stepId, message: `Descripción de "${c.title}" con ${chars(c.description)} caracteres (máx. ${WA.rowDescription})` });
      }
      target(c.goto, where, c._id ?? stepId);
    }
  };

  const checkSteps = (steps: Step[] | undefined, where: string) => {
    steps?.forEach((s, i) => {
      const sid = s._id;
      const last = i === steps.length - 1;
      switch (s.kind) {
        case 'message': {
          const t = text(s.text);
          if (t && chars(t) > WA.text) issues.push({ level: 'error', where, stepId: sid, message: `Mensaje de ${chars(t)} caracteres (máx. ${WA.text})` });
          if (t === '') issues.push({ level: 'error', where, stepId: sid, message: 'Mensaje vacío' });
          break;
        }
        case 'ask':
          if (s.validate && !s.error) issues.push({ level: 'warn', where, stepId: sid, message: `La pregunta "${s.saveAs}" valida pero no tiene mensaje de error propio: usa el genérico` });
          break;
        case 'list': {
          const staticRows = s.rows.length;
          const dynMin = s.dynamic ? 1 : 0;
          if (staticRows + dynMin > WA.listRows) issues.push({ level: 'error', where, stepId: sid, message: `Lista con ${staticRows + dynMin} filas (máx. ${WA.listRows})` });
          if (staticRows + dynMin === WA.listRows) issues.push({ level: 'warn', where, stepId: sid, message: `Lista con ${WA.listRows} filas: no entra ninguna más (ni la de "hablar con un asesor" del reintento)` });
          if (s.dynamic && s.dynamic.max == null) issues.push({ level: 'warn', where, stepId: sid, message: `Filas dinámicas sin "max": si hay más de ${WA.listRows - staticRows}, hay que paginar en Botmaker` });
          if (chars(s.button) > WA.listButton) issues.push({ level: 'error', where, stepId: sid, message: `Botón de lista "${s.button}" con ${chars(s.button)} caracteres (máx. ${WA.listButton})` });
          if (s.section && chars(s.section) > WA.sectionTitle) issues.push({ level: 'error', where, stepId: sid, message: `Título de sección con ${chars(s.section)} caracteres (máx. ${WA.sectionTitle})` });
          if (s.header && chars(s.header) > WA.header) issues.push({ level: 'error', where, stepId: sid, message: `Encabezado con ${chars(s.header)} caracteres (máx. ${WA.header})` });
          checkBody(s.text, s.footer, where, sid);
          checkChoices(s.rows, 'list', where, sid ?? '');
          if (s.dynamic) s.dynamic.example.forEach((r) => {
            if (chars(r.title) > WA.rowTitle) issues.push({ level: 'error', where, stepId: sid, message: `Fila de ejemplo "${r.title}" con ${chars(r.title)} caracteres (máx. ${WA.rowTitle})` });
          });
          break;
        }
        case 'buttons':
          if (s.buttons.length > WA.buttons) issues.push({ level: 'error', where, stepId: sid, message: `${s.buttons.length} botones (máx. ${WA.buttons}): usar una lista` });
          if (s.buttons.length === 0) issues.push({ level: 'error', where, stepId: sid, message: 'Mensaje con botones sin botones' });
          checkBody(s.text, s.footer, where, sid);
          checkChoices(s.buttons, 'buttons', where, sid ?? '');
          break;
        case 'condition':
          s.branches.forEach((b) => target(b.goto, where, b._id));
          target(s.otherwiseGoto, where, sid);
          break;
        case 'api':
          if (!bot.endpoints[s.endpoint]) issues.push({ level: 'error', where, stepId: sid, message: `Endpoint inexistente: "${s.endpoint}"` });
          (s.branches ?? []).forEach((b) => target(b.goto, where, b._id));
          target(s.otherwiseGoto, where, sid);
          break;
        case 'goto':
          target(s.target, where, sid);
          if (!last) issues.push({ level: 'warn', where, stepId: sid, message: 'Hay pasos después de un salto: nunca se ejecutan' });
          break;
        case 'handoff':
          if (!cfg.handoff.queues[s.queue]) issues.push({ level: 'error', where, stepId: sid, message: `Cola inexistente: "${s.queue}"` });
          if (!last) issues.push({ level: 'warn', where, stepId: sid, message: 'Hay pasos después de una derivación: nunca se ejecutan' });
          break;
        case 'close':
        case 'resumeQueue':
          if (!last) issues.push({ level: 'warn', where, stepId: sid, message: 'Hay pasos después de un cierre: nunca se ejecutan' });
          break;
      }
      if (s.kind === 'list') {
        s.rows.forEach((r) => checkSteps(r.then, where));
        checkSteps(s.dynamic?.then, where);
        checkSteps(s.onFreeText, where);
        checkSteps(s.onTimeout, where);
      } else if (s.kind === 'buttons') {
        s.buttons.forEach((b) => checkSteps(b.then, where));
        checkSteps(s.onFreeText, where);
        checkSteps(s.onTimeout, where);
      } else if (s.kind === 'condition' || s.kind === 'api') {
        (s.branches ?? []).forEach((b) => checkSteps(b.then, where));
        checkSteps(s.otherwise, where);
      }
    });
  };

  const checkBody = (t: unknown, footer: string | undefined, where: string, sid?: string) => {
    const b = text(t);
    if (b && chars(b) > WA.interactiveBody) issues.push({ level: 'warn', where, stepId: sid, message: `Cuerpo de ${chars(b)} caracteres (máx. ${WA.interactiveBody}): el motor lo manda aparte` });
    if (footer && chars(footer) > WA.footer) issues.push({ level: 'error', where, stepId: sid, message: `Pie de ${chars(footer)} caracteres (máx. ${WA.footer})` });
  };

  bot.intents.forEach((it) => checkSteps(it.steps, it.id));
  checkSteps(cfg.handoff.outOfHours, 'config');
  checkSteps(cfg.handoff.queueWait?.steps, 'config');
  checkSteps(cfg.endpointError.steps, 'config');
  for (const t of cfg.templates ?? []) {
    checkChoices(t.buttons, 'buttons', 'plantillas', `tpl:${t.id}`);
    if (t.buttons.length > WA.buttons) issues.push({ level: 'error', where: 'plantillas', message: `La plantilla "${t.id}" tiene ${t.buttons.length} botones (máx. ${WA.buttons})` });
    t.buttons.forEach((b) => checkSteps(b.then, 'plantillas'));
  }

  for (const it of bot.intents) {
    if (!referenced.has(it.id)) issues.push({ level: 'warn', where: it.id, message: `Nadie salta a "${it.name}": la intención es inalcanzable` });
  }
  return issues;
}

export function formatIssues(issues: Issue[]): string {
  if (!issues.length) return 'Sin problemas.';
  return issues.map((i) => `${i.level === 'error' ? '✖' : '▲'} [${i.where}] ${i.message}`).join('\n');
}
