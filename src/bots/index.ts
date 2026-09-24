import type { BotDef } from '../core/types';
import idesa from './idesa/bot';
// <new-bot-import> (no borrar: lo usa scripts/new-bot.mjs)

/** Registro de bots. El orden es el de la página de inicio. */
export const bots: BotDef[] = [
  idesa,
  // <new-bot-entry> (no borrar: lo usa scripts/new-bot.mjs)
];

export const botById = (id: string): BotDef | undefined => bots.find((b) => b.config.id === id);
