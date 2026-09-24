import { action, always, buttons, childSteps, cond, goto, say, when } from './dsl';
import type { BotDef, Intent, Step } from './types';

/** Asigna ids solo a los pasos nuevos: los pasos de la configuración conservan los suyos. */
function fillIds(steps: Step[] | undefined, prefix: string): void {
  steps?.forEach((s, i) => {
    const id = s._id ?? `${prefix}/${i}`;
    if (!s._id) s._id = id;
    const choices = s.kind === 'list' ? s.rows : s.kind === 'buttons' ? s.buttons : s.kind === 'condition' || s.kind === 'api' ? s.branches ?? [] : [];
    choices.forEach((c, j) => {
      if (!c._id) c._id = `${id}:${j}`;
    });
    childSteps(s).forEach((child, k) => fillIds(child, `${id}.${k}`));
  });
}

export const SYSTEM_GROUP = 'Comportamientos globales';
export const TEMPLATE_GROUP = 'Plantillas salientes';

/**
 * Intenciones de solo lectura que el canvas dibuja a partir de la configuración:
 * palabras clave, "No entiende", archivos inesperados, inactividad, errores de endpoint,
 * fuera de horario, espera en cola y respuestas a plantillas. No se pueden usar como destino de `goto`.
 */
export function systemIntents(bot: BotDef): Intent[] {
  const c = bot.config;
  const fb = c.fallback;
  const out: Intent[] = [];
  const add = (id: string, name: string, group: string, description: string, steps: Step[]) => {
    fillIds(steps, id);
    out.push({ id, name, group, description, steps });
  };

  if (c.templates?.length) {
    const tpl = cond(
      '¿Qué plantilla respondió?',
      c.templates.map((t) =>
        when(t.id, always, [
          { ...buttons(t.text, t.buttons, { footer: t.footer }), label: `${t.name} · ${t.category}`, note: t.note, pending: t.pending, todo: t.todo },
        ]),
      ),
    );
    tpl._noElse = true;
    add('sys:plantillas', 'Respuestas a plantillas', TEMPLATE_GROUP, 'La respuesta a una plantilla nunca cae al menú principal: cada botón tiene su propio camino.', [tpl]);
  }

  const kw = cond(
    '¿Es una palabra clave?',
    c.keywords.map((k) => when(k.words.join(' · '), always, k.goto)),
    [
      action('intentos_fallback + 1'),
      cond(
        '¿Cuántos intentos?',
        [
          when('1', always, [say(fb.list, { label: 'Primer aviso' })]),
          when(String(fb.offerAgentOnAttempt ?? 2), always, [say(fb.retry, { label: 'Segundo aviso' }), action(`Agregar “${fb.agentChoice.list}”`, { detail: 'Solo si hay lugar en la lista o en los botones' })]),
          when(`${fb.maxAttempts} o más`, always, fb.escalateTo),
        ],
        undefined,
      ),
    ],
  );
  (kw.otherwise![1] as { _noElse?: boolean })._noElse = true;
  add('sys:noentiende', 'Palabras clave y No entiende', SYSTEM_GROUP, 'Texto que no coincide con ninguna opción: primero palabras clave, después hasta 3 intentos.', [kw]);

  add('sys:media', 'Archivos inesperados', SYSTEM_GROUP, 'Imagen, audio o sticker cuando el bot espera una opción o un texto.', [
    cond(
      '¿Qué envió?',
      [
        when('audio', always, [say(c.media.audio, { label: 'Audio' })]),
        when('imagen / documento / video', always, [say(c.media.fileInChoice, { label: 'Archivo' })]),
      ],
      [action('Cuenta como “No entiende”', { detail: 'Sticker, ubicación o contacto' })],
    ),
    action('Repetir el paso actual'),
  ]);

  add('sys:inactividad', 'Inactividad del cliente', SYSTEM_GROUP, `Recordatorio a los ${c.inactivity.reminderAfterMin} min y cierre ${c.inactivity.closeAfterMin} min después.`, [
    say(c.inactivity.reminder, { label: `Recordatorio · ${c.inactivity.reminderAfterMin} min` }),
    cond(`¿Respondió en ${c.inactivity.closeAfterMin} min?`, [when('SI CUMPLE', always, [action('Retomar el paso actual')])], [goto(c.inactivity.goto)]),
  ]);

  add('sys:error', 'Error de endpoint', SYSTEM_GROUP, 'Timeout o error del servidor.', [
    action(`Reintentar ${c.endpointError.retries} vez`, { detail: 'Antes de avisar al cliente' }),
    ...c.endpointError.steps,
  ]);

  add('sys:fuera', 'Fuera de horario', SYSTEM_GROUP, 'Derivación a una cola fuera de su horario.', c.handoff.outOfHours);

  if (c.handoff.queueWait)
    add('sys:cola', 'Espera en cola', SYSTEM_GROUP, `El cliente lleva ${c.handoff.queueWait.afterMin} min en cola sin asesor.`, c.handoff.queueWait.steps);

  return out;
}
