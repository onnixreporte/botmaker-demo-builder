import { api, ask, close, cod, createNav, defineBot, handoff, intent, list, opt, say, set, when } from '../../core/dsl';
import { V } from '../../core/validators';
import type { Ctx } from '../../core/types';
import { T } from './texts';
import { endpoints } from './mocks';

/*
 * Plantilla de bot. `npm run new-bot -- <id> "<Cliente>"` la copia a src/bots/<id>/
 * y la registra. Reemplazá las intenciones por las del documento del cliente.
 */

const nav = createNav({
  menu: { title: 'Menú Principal', goto: 'main' },
  back: { title: 'Volver Atrás' },
  close: { title: 'Finalizar Sesión', goto: 'fin' },
});

export default defineBot({
  config: {
    id: '__BOT_ID__',
    name: 'Bot __CLIENTE__',
    client: '__CLIENTE__',
    description: 'Describí en una línea qué resuelve el bot.',
    profile: { name: '__CLIENTE__', initials: '__INICIALES__', color: '#0E6E5C', about: 'Cuenta de empresa' },
    entry: 'main',
    closeIntent: 'fin',
    groups: ['Entrada', 'Menú principal', 'Cierre'],
    contactVars: ['csat_nota', 'csat_comentario'],
    keywords: [
      { words: ['menu', 'menú', 'hola', 'inicio'], goto: 'main' },
      { words: ['volver'], goto: '@back' },
      { words: ['asesor', 'agente'], goto: 'asesor' },
      { words: ['salir', 'chau'], goto: 'fin' },
    ],
    askEscape: { input: '1', goto: 'main' },
    fallback: {
      maxAttempts: 3,
      list: 'No reconocí tu respuesta 🤔 Elegí una opción de la lista.',
      buttons: 'No reconocí tu respuesta 🤔 Tocá uno de los botones.',
      retry: 'Probá tocando una opción 👇',
      invalidInput: 'El dato no es válido. Probá de nuevo.\n1- Menú principal ⤴',
      offerAgentOnAttempt: 2,
      agentChoice: { list: 'Hablar con un asesor', buttons: 'Hablar con asesor' },
      escalateTo: 'asesor',
    },
    media: {
      audio: 'Por ahora no puedo escuchar audios 🎧 ¿Me lo escribís?',
      fileInChoice: 'Recibí tu archivo 📎, pero en este paso necesito que elijas una opción.',
      fileInAsk: 'Recibí tu archivo 📎, pero en este paso necesito que me lo escribas.',
      imageNeeded: 'Necesito una *foto* para continuar 📷',
    },
    inactivity: { reminderAfterMin: 10, reminder: '¿Seguís ahí? 👀', closeAfterMin: 5, goto: 'fin' },
    handoff: {
      queues: { Atencion: { label: 'Atención al cliente', hours: 'Lun a vie 8 a 18' } },
      outOfHours: [say(T.FUERA), nav('¿Te ayudamos con algo más?', 'main', { suggested: true })],
    },
    endpointError: {
      retries: 1,
      steps: [say('No pudimos consultar tus datos en este momento 😔', { suggested: true }), nav('Elegí una opción', '@self', { backTitle: 'Reintentar' })],
    },
    closeActions: ['Cerrar conversación', 'Archivar conversación', 'UNASSIGN_BOT'],
    demo: {
      notice: '🔒 Demo de prueba con datos de ejemplo.',
      tips: ['Escribí "hola" para empezar.', 'Tocá "Ver opciones" para abrir el menú.'],
      identities: [
        { value: '1234567', label: 'Cliente de prueba' },
        { value: '1111111', label: 'No es cliente' },
      ],
      shareIdentities: true,
    },
    nav: { menu: { title: 'Menú Principal', goto: 'main' }, back: { title: 'Volver Atrás' }, close: { title: 'Finalizar Sesión', goto: 'fin' } },
  },
  intents: [
    intent('main', 'Flujo principal', 'Entrada', [
      say(T.BIENVENIDA, { once: true, label: 'Mensajes de bienvenida' }),
      list(T.MENU, {
        button: 'Ver opciones',
        section: 'Menú principal',
        rows: [
          opt('consulta', 'Consultar mi saldo', 'consulta'),
          opt('asesor', 'Hablar con un asesor', 'asesor'),
          opt('fin', 'Cerrar sesión', 'fin'),
        ],
      }),
    ]),
    intent('consulta', 'Consultar mi saldo', 'Menú principal', [
      ask('Ingresá tu número de documento\n1- Menú principal ⤴', 'documento', { validate: V.cedulaPY, error: 'Solo números, 6 a 8 dígitos.\n1- Menú principal ⤴', skipIf: (c) => !!c.vars.documento }),
      api('consultarCliente', {
        params: (c) => ({ documento: c.vars.documento }),
        branches: [
          when('cod 200', cod('200'), [
            set({ nombre: (c: Ctx) => c.res?.data?.nombre, saldo: (c: Ctx) => c.res?.data?.saldo }),
            nav('Hola {{nombre}}, tu saldo es *Gs. {{saldo}}*.', 'main'),
          ]),
        ],
        otherwise: [set({ documento: null }), say('No encontramos ese documento.'), nav('¿Querés intentar de nuevo?', '@self', { backTitle: 'Reintentar' })],
      }),
    ]),
    intent('asesor', 'Hablar con un asesor', 'Menú principal', [say(T.DEMORA), handoff('Atencion', { topic: 'Pidió un asesor' })]),
    intent('fin', 'Finalizar sesión', 'Cierre', [
      list(T.ENCUESTA, {
        button: 'Calificar',
        saveAs: 'csat_nota',
        rows: ['5', '4', '3', '2', '1'].map((n) => opt(n, `${n} ${'⭐'.repeat(Number(n))}`, undefined, { match: [n] })),
        onFreeText: [set({ csat_comentario: (c: Ctx) => c.input })],
        onTimeout: [set({ csat_nota: 'sin respuesta' })],
      }),
      say(T.DESPEDIDA),
      close(),
    ]),
  ],
  endpoints,
});
