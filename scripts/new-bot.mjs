#!/usr/bin/env node
/**
 * Crea un bot nuevo a partir de src/bots/_plantilla y lo registra.
 *
 *   npm run new-bot -- <id> "<Cliente>" [INICIALES] [#color]
 *   npm run new-bot -- tienda-sol "Tienda del Sol" TDS "#C2410C"
 *
 * Genera:
 *   src/bots/<id>/bot.ts, texts.ts, mocks.ts
 *   tests/<id>.test.ts
 * y agrega el import y la entrada en src/bots/index.ts.
 */
import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [id, client, initialsArg, colorArg] = process.argv.slice(2);

const fail = (msg) => {
  console.error(`\n✖ ${msg}\n\nUso: npm run new-bot -- <id> "<Cliente>" [INICIALES] [#color]\n`);
  process.exit(1);
};

if (!id || !client) fail('Faltan argumentos.');
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) fail(`El id "${id}" tiene que ser minúsculas, números y guiones (ej. tienda-sol). Es la URL de la demo.`);
if (['prueba', 'flujo', '_plantilla'].includes(id)) fail(`"${id}" es una palabra reservada.`);
if (colorArg && !/^#[0-9a-fA-F]{6}$/.test(colorArg)) fail(`El color "${colorArg}" tiene que ser hexadecimal de 6 dígitos (ej. #0E6E5C).`);

const dst = join(root, 'src/bots', id);
if (existsSync(dst)) fail(`Ya existe src/bots/${id}.`);

const initials = (initialsArg || client.split(/\s+/).filter((w) => w.length > 2 || /^[A-Z]/.test(w)).map((w) => w[0]).join('').slice(0, 3) || client.slice(0, 2)).toUpperCase();
const color = colorArg || '#0E6E5C';
const varName = id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/^(\d)/, '_$1');

cpSync(join(root, 'src/bots/_plantilla'), dst, { recursive: true });
for (const f of readdirSync(dst)) {
  const p = join(dst, f);
  const s = readFileSync(p, 'utf8')
    .replaceAll('__BOT_ID__', id)
    .replaceAll('__CLIENTE__', client)
    .replaceAll('__INICIALES__', initials)
    .replace("color: '#0E6E5C'", `color: '${color}'`)
    .replace(/\/\*\n \* Plantilla de bot[\s\S]*?\*\/\n/, `/*\n * Bot de ${client}.\n * Fuente: (completar con el nombre del documento del cliente)\n */\n`);
  writeFileSync(p, s);
}

const indexPath = join(root, 'src/bots/index.ts');
let index = readFileSync(indexPath, 'utf8');
const importMarker = '// <new-bot-import>';
const entryMarker = '  // <new-bot-entry>';
if (!index.includes(importMarker) || !index.includes(entryMarker)) fail('No encontré los marcadores en src/bots/index.ts: agregá el bot a mano.');
index = index.replace(importMarker, `import ${varName} from './${id}/bot';\n${importMarker}`).replace(entryMarker, `  ${varName},\n${entryMarker}`);
writeFileSync(indexPath, index);

const testPath = join(root, 'tests', `${id}.test.ts`);
if (!existsSync(testPath)) {
  writeFileSync(
    testPath,
    `import { describe, expect, it } from 'vitest';
import bot from '../src/bots/${id}/bot';
import { createSession } from '../src/core/testing';

/** Recorridos de ${client}. Agregá uno por intención principal y uno por cada código de error de los endpoints. */
describe('${client}', () => {
  it('saluda y muestra el menú principal', async () => {
    const s = createSession(bot);
    await s.send('hola');
    expect(s.options().length).toBeGreaterThan(0);
  });

  it('cierra la sesión con encuesta', async () => {
    const s = createSession(bot);
    await s.send('hola');
    await s.send('salir');
    await s.send('5');
    expect(s.mode).toBe('idle');
  });
});
`,
  );
}

console.log(`
✔ Bot "${client}" creado en src/bots/${id}/ y registrado.

Siguientes pasos:
  1. src/bots/${id}/texts.ts   → textos literales del documento
  2. src/bots/${id}/mocks.ts   → endpoints simulados y datos de ejemplo
  3. src/bots/${id}/bot.ts     → configuración e intenciones
  4. tests/${id}.test.ts       → recorridos de prueba
  5. npm run check             → typecheck + linter de flujos + tests
  6. npm run dev               → /${id}  ·  /${id}/prueba  ·  /${id}/flujo
`);
