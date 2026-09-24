/**
 * Revisa todos los bots registrados contra los límites de WhatsApp y la coherencia del flujo.
 * Uso: npm run lint:flows            (todos)
 *      npm run lint:flows -- idesa   (uno)
 * Sale con código 1 si hay errores.
 */
import { bots } from '../src/bots';
import { lintBot } from '../src/core/lint';

const only = process.argv[2];
let errors = 0;
for (const bot of bots.filter((b) => !only || b.config.id === only)) {
  const issues = lintBot(bot);
  const e = issues.filter((i) => i.level === 'error');
  const w = issues.filter((i) => i.level === 'warn');
  errors += e.length;
  console.log(`\n${bot.config.name} (${bot.config.id}) · ${e.length} errores · ${w.length} avisos`);
  for (const i of [...e, ...w]) console.log(`  ${i.level === 'error' ? '✖' : '▲'} [${i.where}] ${i.message}${i.stepId ? `  ·  ${i.stepId}` : ''}`);
}
if (only && !bots.some((b) => b.config.id === only)) {
  console.error(`No hay un bot con id "${only}". Registrados: ${bots.map((b) => b.config.id).join(', ')}`);
  process.exit(1);
}
process.exit(errors ? 1 : 0);
