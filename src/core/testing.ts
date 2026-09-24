import { Engine, type ChatItem, type LogEntry, type Scenario, type UserMedia } from './engine';
import { norm } from './text';
import type { BotDef } from './types';

/**
 * Sesión de prueba sin UI: escribís como el cliente y leés lo que respondió el bot.
 *
 *   const s = createSession(bot);
 *   await s.send('hola');
 *   await s.pick('Soy cliente de IDESA');
 *   await s.send('1234567');
 *   expect(s.lastText()).toContain('Estimado cliente');
 */
export function createSession(bot: BotDef, scenario: Partial<Scenario> = {}) {
  const engine = new Engine(bot, { typingMs: () => 0, apiMs: 0, scenario });
  const items: ChatItem[] = [];
  const logs: LogEntry[] = [];
  engine.subscribe((e) => {
    if (e.type === 'chat') items.push(e.item);
    if (e.type === 'log') logs.push(e.entry);
    if (e.type === 'reset') {
      items.length = 0;
      logs.length = 0;
    }
  });

  const botItems = () => items.filter((i) => i.from !== 'user');
  const lastInteractive = () => {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.from === 'bot' && (it.kind === 'list' || it.kind === 'buttons')) return it;
    }
    return undefined;
  };

  const s = {
    engine,
    items,
    logs,
    /** Escribe un texto y espera la respuesta completa del bot. */
    async send(text: string) {
      engine.send({ text });
      await engine.settle();
      return s;
    },
    /** Elige una opción (fila o botón) del último mensaje interactivo por su título. */
    async pick(title: string) {
      const msg = lastInteractive();
      if (!msg) throw new Error('No hay ningún menú en la conversación');
      const rows = msg.kind === 'list' ? msg.rows : msg.buttons;
      const t = norm(title);
      const r = rows.find((x) => norm(x.title) === t) ?? rows.find((x) => norm(x.title).includes(t));
      if (!r) throw new Error(`No hay una opción "${title}". Opciones: ${rows.map((x) => x.title).join(' | ')}`);
      engine.send({ text: r.title, subtext: (r as { description?: string }).description, replyTo: { messageId: msg.id, choiceId: r.id } });
      await engine.settle();
      return s;
    },
    /** Envía un archivo (por defecto una foto). */
    async sendMedia(media: UserMedia = { type: 'image', name: 'foto.jpg' }) {
      engine.send({ media });
      await engine.settle();
      return s;
    },
    /** Simula tiempo sin respuesta. */
    async tick() {
      engine.tick();
      await engine.settle();
      return s;
    },
    /** Envía una plantilla saliente y toca uno de sus botones. */
    async template(id: string, buttonTitle?: string) {
      engine.sendTemplate(id);
      if (buttonTitle) await s.pick(buttonTitle);
      return s;
    },
    /** Textos de todo lo que envió el bot, en orden. */
    botTexts(): string[] {
      return botItems().map((i) => ('text' in i ? i.text : i.kind === 'media' ? `[${i.media.type}] ${i.caption ?? ''}` : ''));
    },
    lastText(): string {
      const b = botItems();
      const last = b[b.length - 1];
      return last && 'text' in last ? last.text : '';
    },
    /** Títulos de las opciones del último menú. */
    options(): string[] {
      const m = lastInteractive();
      return m ? (m.kind === 'list' ? m.rows : m.buttons).map((r) => r.title) : [];
    },
    get vars() {
      return engine.state.vars;
    },
    get mode() {
      return engine.state.mode;
    },
    get intent() {
      return engine.state.intent;
    },
    /** Conversación legible, útil para depurar un test que falla. */
    transcript(): string {
      return items
        .map((i) => {
          const who = i.from === 'user' ? 'CLIENTE' : i.from === 'agent' ? 'ASESOR' : 'BOT';
          if (i.kind === 'text') return `${who}: ${i.text}`;
          if (i.kind === 'list') return `${who}: ${i.text}\n   [${i.button}] ${i.rows.map((r) => r.title).join(' | ')}`;
          if (i.kind === 'buttons') return `${who}: ${i.text}\n   ${i.buttons.map((b) => `(${b.title})`).join(' ')}`;
          return `${who}: [${i.media.type}]`;
        })
        .join('\n');
    },
    logTitles(kind?: LogEntry['kind']): string[] {
      return logs.filter((l) => !kind || l.kind === kind).map((l) => l.title);
    },
  };
  return s;
}
