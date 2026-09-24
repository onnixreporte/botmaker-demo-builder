import { describe, expect, it } from 'vitest';
import { bots } from '../src/bots';
import { formatIssues, lintBot } from '../src/core/lint';
import { buttons, defineBot, intent, list, opt } from '../src/core/dsl';
import idesa from '../src/bots/idesa/bot';
import plantilla from '../src/bots/_plantilla/bot';

describe('linter', () => {
  it.each(bots.map((b) => [b.config.id, b] as const))('%s no tiene errores', (_, bot) => {
    const errors = lintBot(bot).filter((i) => i.level === 'error');
    expect(errors, formatIssues(errors)).toHaveLength(0);
  });

  it('la plantilla para bots nuevos no tiene errores', () => {
    const errors = lintBot(plantilla).filter((i) => i.level === 'error');
    expect(errors, formatIssues(errors)).toHaveLength(0);
  });

  it('detecta límites de WhatsApp y saltos rotos', () => {
    const bad = defineBot({
      ...idesa,
      intents: [
        ...idesa.intents,
        intent('roto', 'Roto', 'Entrada', [
          buttons('Muchos botones', [opt('a', 'Uno'), opt('b', 'Dos'), opt('c', 'Tres'), opt('d', 'Cuatro')]),
          list('Lista', { button: 'Un botón de lista demasiado largo', rows: [opt('x', 'Un título de fila que es muy largo', 'no-existe')] }),
        ]),
      ],
    });
    const msgs = lintBot(bad).map((i) => i.message).join('\n');
    expect(msgs).toContain('4 botones');
    expect(msgs).toContain('máx. 24');
    expect(msgs).toContain('máx. 20');
    expect(msgs).toContain('no existe: "no-existe"');
    expect(msgs).toContain('inalcanzable');
  });
});
