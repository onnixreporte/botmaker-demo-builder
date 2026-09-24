import {
  action,
  api,
  ask,
  askImage,
  buttons,
  close,
  cod,
  cond,
  createNav,
  defineBot,
  dynamicRows,
  goto,
  handoff,
  has,
  intent,
  list,
  media,
  opt,
  resumeQueue,
  say,
  set,
  when,
} from '../../core/dsl';
import { V } from '../../core/validators';
import type { Ctx } from '../../core/types';
import { T } from './texts';
import { cliente, endpoints, lote } from './mocks';

/*
 * Bot de WhatsApp de Inmobiliaria del Este (IDESA).
 * Fuente: "Doc. Chatbot Whatsapp Inmobiliaria del Este 2026".
 * Todo lo que no está en el documento va marcado con `suggested`, `todo` o `pending`.
 */

const nav = createNav({
  menu: { title: 'Menú Principal', goto: 'main' },
  back: { title: 'Volver Atrás' },
  close: { title: 'Finalizar Sesión', goto: 'fin' },
});

const cap = (s: string) =>
  s
    .toLowerCase()
    .split(' ')
    .map((w) => (/^[ivx]+$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

const ctaText = (c: Ctx) =>
  (cliente(c.vars.cedula)?.lotes ?? [])
    .map((l) => `El lote número ${l.fml} en ${l.fraccion} del distrito ${l.distrito} tiene la Cta. Cte. Ctal. Nro. ${l.cta}. La superficie del mismo es ${l.sup}mt2`)
    .join('\n\n');

const autogText = (c: Ctx) => {
  const l = lote(c.vars.cedula, c.vars.fml_seleccionado);
  if (!l?.autogestion) return 'No encontramos la cotización de tu lote.';
  return `El importe es de *Gs. ${l.autogestion.importe}*, por el lote ${l.fml}, distrito de ${l.distrito}.
Favor acceda al sgte. enlace para aceptar los términos y condiciones de la gestión de pago de impuesto inmobiliario, colocando el PIN: ${l.autogestion.pin}.
Este PIN de confirmación tendrá una caducidad de 15 días desde su generación.
De no aceptar los términos y condiciones antes de dicho plazo, tendrá que volver a hacer una nueva solicitud de autogestión de impuesto inmobiliario para el lote seleccionado.

https://www.idesa.com.py/confirm/AutogestionImpuesto/…`;
};

const deudaText = (c: Ctx) =>
  (cliente(c.vars.cedula)?.lotes ?? [])
    .map((l) => `• Para el lote ${l.fml} en ${l.fraccion} del distrito ${l.distrito} en el departamento de ${l.depto} el monto mínimo a pagar es de *Gs. ${l.deuda.monto}* correspondiente a ${l.deuda.desde}${l.deuda.hasta ? ' a la ' + l.deuda.hasta : ''}.`)
    .join('\n') + '\n' + T.BOCAS;

const EJEMPLO_CTA = 'El lote número 938-8-9 en NUEVA CANADA II del distrito Villarrica tiene la Cta. Cte. Ctal. Nro. 9231. La superficie del mismo es 365.46mt2';

/* =====================================================================
   Intenciones
   ===================================================================== */

const main = intent('main', 'Flujo principal', 'Entrada', [
  say(T.BIENVENIDA, { once: true, label: 'Mensajes de bienvenida', suggested: true, pending: 'El documento no define el texto de bienvenida.' }),
  list(T.MENU, {
    button: 'Ver opciones',
    section: 'Menú principal',
    label: 'Menú principal',
    suggested: true,
    rows: [
      opt('lote', 'Adquirir un lote 📈💵', 'lote'),
      opt('prog', 'Lote Programado', 'prog'),
      opt('cli', 'Soy cliente de IDESA', 'cli', { description: 'Saldos, impuestos, Ctas. Ctes. y transferencias' }),
      opt('nov', 'Canal de novedades', 'nov', { description: 'Newsletter y canal de WhatsApp' }),
      opt('vender', 'Vender mi propiedad', 'vender', { description: 'Solo propiedades desde 5 hectáreas' }),
      opt('depto', 'Adquirir departamento 🏬', 'depto'),
      opt('sug', 'Sugerencias ✍', 'sug'),
      opt('ejec', 'Hablar con un ejecutivo', 'ejec'),
      opt('fin', 'Cerrar sesión 🤝', 'fin'),
    ],
  }),
], { description: 'Bienvenida y menú de 9 opciones.' });

const adquirirLote = intent('lote', 'Adquirir un lote', 'Menú principal', [
  list('¿En qué departamento estarías interesado?', {
    button: 'Ver zonas',
    section: 'Zonas',
    saveAs: 'zona_interes',
    pending: 'El árbol deriva sin pedir cédula, pero el EP2 (Adquirir Lotes) trae toda la lógica de aptitud crediticia. Decidir con IDESA si se usa.',
    rows: [
      opt('Central, Cordillera y Paraguarí', 'Central y Cordillera', undefined, { description: 'Central, Cordillera y Paraguarí' }),
      opt('Itapúa, Misiones y Pilar', 'Itapúa, Misiones y Pilar'),
      opt('Alto Paraná, Caaguazú, Canindeyú y Saltos del Guairá', 'Alto Paraná y Caaguazú', undefined, { description: 'Alto Paraná, Caaguazú, Canindeyú y Saltos del Guairá' }),
      opt('Yby Pytã, Guairá, Cnel. Oviedo y Caazapá', 'Guairá y Cnel. Oviedo', undefined, { description: 'Yby Pytã, Guairá, Cnel. Oviedo y Caazapá' }),
      opt('main', 'Menú principal ⤴', 'main'),
    ],
  }),
  say(T.COMERCIAL),
  handoff('Ventas', { topic: 'Nuevo contacto interesado en lote · {{zona_interes}}', topicId: 202 }),
], { description: 'Zona de interés y derivación a Ventas.' });

const loteProgramado = intent('prog', 'Lote Programado', 'Menú principal', [
  buttons('Lote Programado 🏡 ¿Cómo querés seguir?', [
    opt('ag', 'Hablar con agente', [say(T.DEMORA), handoff('Ventas', { topic: 'Lote Programado · pidió un asesor' })]),
    opt('info', 'Más información', [
      media({ type: 'document', name: 'Lote Programado.pdf', meta: 'PDF · archivo de ejemplo' }, { pending: 'Falta definir qué archivos se envían.' }),
      buttons('Deseas contactar con un asesor?', [
        opt('si', 'Sí', [say(T.DEMORA), handoff('Ventas', { topic: 'Lote Programado · interesado' })]),
        opt('no', 'No', 'fin'),
        opt('back', 'Volver Atrás', '@self'),
      ]),
    ]),
    opt('main', 'Menú Principal', 'main'),
  ], { suggested: true }),
], { description: 'Información y contacto con un asesor comercial.' });

const soyCliente = intent('cli', 'Soy cliente de IDESA', 'Menú principal', [
  cond('¿Cliente validado en la sesión?', [when('SI CUMPLE', (c) => c.vars.es_cliente === true, [])], [
    ask(T.PEDIR_CEDULA, 'cedula', { validate: V.cedulaPY, error: T.ERR_CEDULA, skipIf: has('cedula'), label: 'Pedir Nro. de Cédula', note: 'Se pide una sola vez por sesión.' }),
    api('actualizarDatos', {
      label: 'Validar cliente',
      params: (c) => ({ cedula: c.vars.cedula }),
      pending: 'Consulta pendiente: ¿llamar al EP6 solo con key y cédula sirve para saber si es cliente (cod 97)? Se toma "cod ≠ 97" como cliente.',
      branches: [
        when('cod 97 · no es cliente', cod('97'), [
          set({ cedula: null }),
          say('No encontramos lotes asociados a esa cédula.', { suggested: true, todo: 'El árbol dice "pasar a esta sección solo si es cliente" pero no define qué ve quien no lo es.' }),
          buttons('¿Cómo seguimos?', [opt('lote', 'Adquirir un lote', 'lote'), opt('ejec', 'Hablar con ejecutivo', 'ejec'), opt('main', 'Menú principal', 'main')], { suggested: true }),
        ]),
      ],
      otherwise: [set({ es_cliente: true, nombre_cliente: (c: Ctx) => cliente(c.vars.cedula)?.nombre })],
    }),
  ]),
  say(T.AVISO, { once: true, label: 'Aviso de impuesto' }),
  list('Seleccione una opción 👇', {
    button: 'Ver opciones',
    section: 'Soy cliente',
    label: 'Submenú cliente',
    rows: [
      opt('imp', 'Impuestos inmobiliarios', 'imp'),
      opt('saldos', 'Saldos y pagos 🤔📊', 'saldos'),
      opt('ctas', 'Cuentas y escrituración', 'ctas', { description: 'Cta. Cte. Catastral, transferencias y escritura' }),
      opt('datos', 'Actualizar mis datos ✏', 'datos'),
      opt('gest', 'Gestionar mi lote', 'gest', { description: 'Solicitar un servicio, datos de mi lote' }),
      opt('visita', 'Agendar visita', 'visita', { description: 'Para transferencia y/o escrituración' }),
      opt('adj', 'Adjuntar Documento(s)', 'adj'),
      opt('cup', 'Consultas Cupones', 'cup'),
      opt('main', 'Menú principal ⤴', 'main'),
    ],
  }),
], { description: 'Cédula una vez por sesión, validación y submenú.' });

const lotesDinamicos = (saveAs: string, withCta: boolean) =>
  dynamicRows({
    label: withCta ? 'Un lote por fila, con su Cta. Cte.' : 'Un lote por fila (data.lotes)',
    saveAs,
    max: 9,
    rows: (c) =>
      (cliente(c.vars.cedula)?.lotes ?? []).map((l) => ({
        id: l.fml,
        title: (withCta ? `${l.fml} · Cta. ${l.cta}` : `${l.fml} ${cap(l.fraccion)}`).slice(0, 24),
        description: withCta ? `${cap(l.fraccion)} · ${l.sup} m²` : `${l.depto} - ${l.distrito}`,
      })),
    example: [
      { id: '938-8-9', title: withCta ? '938-8-9 · Cta. 9231' : '938-8-9 Nueva Canada II', description: withCta ? 'Nueva Canada II · 365.46 m²' : 'Guairá - Villarrica' },
      { id: '938-8-10', title: withCta ? '938-8-10 · Cta. 9232' : '938-8-10 Nueva Canada II', description: withCta ? 'Nueva Canada II · 365.46 m²' : 'Guairá - Villarrica' },
    ],
  });

const impuestos = intent('imp', 'Impuestos inmobiliarios', 'Soy cliente', [
  list(T.SELECCIONE, {
    button: 'Ver opciones',
    section: 'Impuestos',
    rows: [
      opt('muni', 'Datos del municipio', [
        list('Seleccione un Municipio', {
          button: 'Ver municipios',
          section: 'Municipios',
          saveAs: 'municipio',
          rows: [
            opt('Central', 'Central'),
            opt('Itapúa', 'Itapúa'),
            opt('Cordillera', 'Cordillera'),
            opt('Paraguarí, Alto Paraná', 'Paraguarí, Alto Paraná'),
            opt('Caaguazú, Guairá y Misiones', 'Caaguazú/Guairá/Misiones'),
            opt('Capital y otros', 'Capital y otros', undefined, { description: 'Caazapá, Pdte. Hayes, Canindeyú, Ñeembucú' }),
            opt('main', 'Menú principal ⤴', 'main'),
            opt('back', 'Volver Atrás', '@self'),
          ],
        }),
        api('bocasMunicipios', { params: (c) => ({ cedula: c.vars.cedula, municipio: c.vars.municipio }) }),
        nav('Información de teléfonos de la municipalidad: {{municipio}}', '@self', {
          header: { type: 'image', placeholder: { title: 'Teléfonos por municipio', subtitle: 'Imagen que devuelve el endpoint 9' } },
        }),
      ]),
      opt('auto', 'Gestionar pago impuesto', [
        api('autogestionImpuesto', {
          label: 'Autogestión · 1ª llamada',
          params: (c) => ({ cedula: c.vars.cedula }),
          branches: [
            when('cod 96 · VIP o débito automático', cod('96'), [nav('Tu lote está adherido al débito automático: no hace falta gestionar el impuesto por este canal.', '@self', { suggested: true })]),
            when('cod 97 · data.lotes', cod('97'), [
              list('Seleccione su Lote', {
                button: 'Ver lotes',
                section: 'Mis lotes',
                dynamic: {
                  ...lotesDinamicos('fml_seleccionado', false),
                  then: [
                    api('autogestionImpuesto', { label: 'Autogestión · 2ª llamada', params: (c) => ({ cedula: c.vars.cedula, fml: c.vars.fml_seleccionado }), note: 'Con el lote elegido devuelve importe, PIN y enlace.' }),
                    nav(autogText, '@self', { label: 'Importe, PIN y enlace', example: 'El importe es de *Gs. 89.300*, por el lote 938-8-9… PIN: 1234 · vence en 15 días' }),
                  ],
                },
                rows: [opt('main', 'Menú principal ⤴', 'main')],
              }),
            ]),
          ],
          otherwise: 'main',
        }),
      ], { description: 'Autogestión con PIN' }),
      opt('boleta', 'Enviar boleta de pago', [
        api('cuentasCatastrales', { params: (c) => ({ cedula: c.vars.cedula }) }),
        list('Seleccione el lote', {
          button: 'Ver lotes',
          section: 'Mis lotes',
          dynamic: {
            ...lotesDinamicos('fml_seleccionado', true),
            then: [
              api('impuestoInmobiliario', {
                params: (c) => ({ cedula: c.vars.cedula, fml: c.vars.fml_seleccionado, opcion: '2' }),
                pending: 'El documento dice "posiblemente se use el EP5". Confirmar con IDESA.',
                branches: [
                  when('cod 110 · al día', cod('110'), [
                    nav('Impuesto al día ✅', '@self', { backTitle: 'Volver a mis lotes', note: 'El documento pide "Gestión de Lotes (Volver Atrás)": 31 caracteres, el máximo de un botón es 20.' }),
                  ]),
                  when('cod 109 · con atrasos', cod('109'), [
                    askImage('Tu impuesto registra atrasos. Envíe una foto de la boleta de pago', 'boleta', { todo: 'Rama propuesta: el árbol solo contempla "Impuesto al día".' }),
                    api('impuestoInmobiliario', { label: 'Adjuntar boleta', params: (c) => ({ cedula: c.vars.cedula, fml: c.vars.fml_seleccionado, opcion: '2', imagen: '(Base64)' }) }),
                    nav('Recibimos tu boleta ✅', '@self', { suggested: true }),
                  ]),
                ],
                otherwise: [goto('main')],
              }),
            ],
          },
          rows: [opt('main', 'Menú principal ⤴', 'main')],
        }),
      ]),
      opt('cta', 'Cta. Cte. Catastral', [
        api('cuentasCatastrales', { params: (c) => ({ cedula: c.vars.cedula }) }),
        nav(ctaText, '@self', { label: 'Datos de cada lote', example: EJEMPLO_CTA }),
      ], { description: 'Datos de mi lote' }),
      opt('main', 'Menú principal ⤴', 'main'),
      opt('cli', 'Volver Atrás', 'cli'),
    ],
  }),
], { description: 'Municipios, autogestión del pago, boleta y Cta. Cte. Catastral.' });

const saldos = intent('saldos', 'Saldos y pagos', 'Soy cliente', [
  list(T.SELECCIONE, {
    button: 'Ver opciones',
    section: 'Saldos y pagos',
    rows: [
      opt('deuda', 'Cuánto debo pagar', [
        api('pagosPendientes', {
          params: (c) => ({ cedula: c.vars.cedula, option: '1' }),
          todo: 'Recorrer data con Object.entries: las claves son FML dinámicos (938-8-9).',
          branches: [
            when('cod 107', cod('107'), [
              buttons(deudaText, [
                opt('main', 'Menú principal', 'main'),
                opt('ag', 'Hablar con Agente', [say(T.DEMORA), handoff('ATC', { topic: 'Consulta de saldo' })]),
                opt('fin', 'Finalizar Sesión', 'fin'),
              ], { label: 'Monto por lote', example: '• Para el lote 938-8-9 … el monto mínimo a pagar es de *Gs. 657.950*…', note: 'Con muchos lotes el cuerpo supera 1024 caracteres: el motor manda el detalle aparte.' }),
            ]),
            when('cod 99 · lote demandado', cod('99'), [
              nav('Tu lote registra una demanda judicial. Para regularizar tu situación comunicate con IDESA al teléfono que informa el endpoint.', '@self', { suggested: true }),
            ]),
          ],
          otherwise: [say('No encontramos pagos pendientes para tu cédula.', { suggested: true }), handoff('ATC', { topic: 'Consulta de saldo sin datos' })],
        }),
      ]),
      opt('redes', 'Problemas al pagar', [
        list('¿Con qué red de pago tuvo el inconveniente?', {
          button: 'Ver redes',
          section: 'Redes de pago',
          saveAs: 'red_pago',
          suggested: true,
          rows: [
            ...['Aquí Pago', 'Pago Express', 'Infonet Cobranzas', 'Practipago', 'Pag Web de Bancos', 'Pag Web IDESA', 'Tigo Money', 'Billetera Personal', 'Otros'].map((r) => opt(r, r)),
            opt('main', 'Menú principal ⤴', 'main'),
          ],
        }),
        api('problemasPagoCuota', { params: (c) => ({ cedula: c.vars.cedula, nombre: c.vars.nombre_cliente, red: c.vars.red_pago }) }),
        say(T.EJECUTIVO),
        handoff('ATC', { topic: 'Problemas con red de pago · {{red_pago}}', topicId: 209 }),
      ], { description: 'Inconvenientes con las redes de pago' }),
      opt('main', 'Menú principal ⤴', 'main'),
    ],
  }),
], { description: 'Deuda por lote y problemas con las redes de pago.' });

const requisitos = (tipo: 'transferencia' | 'escritura', op: string, opAgente: string) => [
  api('requisitosLotes', { params: (c: Ctx) => ({ cedula: c.vars.cedula, opcion: op }) }),
  buttons(`Estos son los requisitos para ${tipo}`, [
    opt('ag', 'Hablar con Agente', [
      api('requisitosLotes', { label: 'Registrar derivación', params: (c: Ctx) => ({ cedula: c.vars.cedula, opcion: opAgente }) }),
      say(T.ATC),
      handoff('ATC', { topic: `Requisitos de ${tipo}` }),
    ]),
    opt('main', 'Menú Principal', 'main'),
    opt('fin', 'Finalizar Sesión', 'fin'),
  ], { header: { type: 'image', placeholder: { title: `Requisitos para ${tipo}`, subtitle: 'Imagen que devuelve el endpoint 8' } } }),
];

const cuentas = intent('ctas', 'Cuentas y escrituración', 'Soy cliente', [
  list(T.SELECCIONE, {
    button: 'Ver opciones',
    section: 'Cuentas y escrituración',
    rows: [
      opt('cta', 'Cta. Cte. Catastral', [api('cuentasCatastrales', { params: (c) => ({ cedula: c.vars.cedula }) }), nav(ctaText, '@self', { label: 'Datos de cada lote', example: EJEMPLO_CTA })], { description: 'Datos de mi lote' }),
      opt('req', 'Requisitos', [
        list(T.SELECCIONE, {
          button: 'Ver opciones',
          section: 'Requisitos',
          rows: [
            opt('t', 'Transferir mi lote', requisitos('transferencia', '1', '3')),
            opt('e', 'Escriturar mi lote', requisitos('escritura', '2', '4')),
            opt('main', 'Menú principal ⤴', 'main'),
            opt('back', 'Volver atrás', '@self'),
          ],
        }),
      ], { description: 'Para transferir o escriturar' }),
      opt('cli', 'Volver Atrás', 'cli'),
    ],
  }),
], { description: 'Cta. Cte. Catastral y requisitos para transferir o escriturar.' });

const actualizarDatos = intent('datos', 'Actualizar mis datos', 'Soy cliente', [
  list(T.SELECCIONE, {
    button: 'Ver opciones',
    section: 'Actualizar mis datos',
    rows: [
      opt('mail', 'Actualizar mi email', [
        ask('Por favor, ingresa tu dirección de correo electrónico', 'email', { validate: V.email, error: T.ERR_EMAIL }),
        api('actualizarDatos', { params: (c) => ({ cedula: c.vars.cedula, opcion: '2', email: c.vars.email }), branches: [when('cod 118', cod('118'), [nav(T.ACTUALIZADO, '@self')])], otherwise: [say('No pudimos actualizar tus datos en este momento.', { suggested: true }), handoff('ATC', { topic: 'Actualización de datos fallida' })] }),
      ]),
      opt('cel', 'No tengo email', [
        ask('Indique su número de celular (Ej: 0971413100)', 'celular_cliente', { validate: V.phonePY, error: T.ERR_CELULAR }),
        api('actualizarDatos', { params: (c) => ({ cedula: c.vars.cedula, opcion: '1', celular: c.vars.celular_cliente }), branches: [when('cod 118', cod('118'), [nav(T.ACTUALIZADO, '@self')])], otherwise: [say('No pudimos actualizar tus datos en este momento.', { suggested: true }), handoff('ATC', { topic: 'Actualización de datos fallida' })] }),
      ], { description: 'Actualizar mi celular' }),
      opt('main', 'Menú principal ⤴', 'main'),
    ],
  }),
], { description: 'Email o celular del cliente.' });

const gestionarLote = intent('gest', 'Gestionar mi lote', 'Soy cliente', [
  list(T.SELECCIONE, {
    button: 'Ver opciones',
    section: 'Gestionar mi lote',
    rows: [
      opt('cta', 'Cta. Cte. Catastral', [api('cuentasCatastrales', { params: (c) => ({ cedula: c.vars.cedula }) }), nav(ctaText, '@self', { label: 'Datos de cada lote', example: EJEMPLO_CTA })], { description: 'Datos de mi lote' }),
      opt('serv', 'Solicitar un servicio', [
        list('Seleccione el servicio', {
          button: 'Ver servicios',
          section: 'Servicios',
          rows: [
            opt('re', 'Re-amojonamiento', [api('reamojonamiento', { params: (c) => ({ cedula: c.vars.cedula }) }), say(T.EJECUTIVO), handoff('ATC', { topic: 'Re-amojonamiento de lote', topicId: 210 })]),
            opt('el', 'Extensión eléctrica', [api('extensionElectrica', { params: (c) => ({ cedula: c.vars.cedula }) }), say(T.EJECUTIVO), handoff('ATC', { topic: 'Extensión eléctrica', topicId: 211 })]),
            opt('fa', 'Factura por email', [
              ask('Ingrese su Nombre y Apellido', 'nombre_cliente', { validate: V.name, error: 'Ingresá tu nombre y apellido.\n1- Menú principal ⤴', skipIf: has('nombre_cliente'), todo: 'El EP13 exige nombre, fecha de nacimiento y email; el árbol no los pide.' }),
              ask('Ingrese su fecha de nacimiento (DD/MM/AAAA)', 'fecha_nacimiento', { validate: V.date, error: 'La fecha no es válida. Usá el formato DD/MM/AAAA.\n1- Menú principal ⤴' }),
              ask('Ingrese su correo electrónico', 'email', { validate: V.email, error: T.ERR_EMAIL, skipIf: has('email') }),
              api('envioFactura', { params: (c) => ({ cedula: c.vars.cedula, nombre: c.vars.nombre_cliente, fecha_nacimiento: c.vars.fecha_nacimiento, email: c.vars.email }) }),
              say(T.ATC),
              handoff('ATC', { topic: 'Envío de factura por email', topicId: 212 }),
            ]),
            opt('main', 'Menú principal ⤴', 'main'),
          ],
        }),
      ]),
      opt('op', 'Hablar con un operador', [say(T.ATC), handoff('ATC', { topic: 'Asesoramiento con un operador' })]),
      opt('main', 'Menú principal ⤴', 'main'),
    ],
  }),
], { description: 'Servicios sobre el lote y derivación a un operador.' });

const agendarVisita = intent('visita', 'Agendar visita', 'Soy cliente', [
  list('Seleccione el trámite', {
    button: 'Ver opciones',
    section: 'Agendar visita',
    saveAs: 'motivo_visita',
    rows: [
      opt('Transferencia', 'Transferencia de mi Lote'),
      opt('Escrituración', 'Escrituración de mi Lote'),
      opt('cli', 'Volver Atrás', 'cli'),
      opt('main', 'Menú principal ⤴', 'main'),
    ],
  }),
  say(T.OFICIAL),
  handoff('ATC', { topic: 'Visita · {{motivo_visita}} · oficial de cuentas', pending: 'El árbol dice "Derivar a ATC" pero el mensaje promete un oficial de cuentas. ¿Sub-cola, etiqueta o asignación directa?' }),
], { description: 'Transferencia o escrituración con un oficial de cuentas.' });

const adjuntar = intent('adj', 'Adjuntar documentos', 'Soy cliente', [
  list('Seleccione el tipo de documento:', {
    button: 'Ver opciones',
    section: 'Documentos',
    rows: [
      opt('ci', 'CI', [
        askImage('Envíe una foto de FRENTE de su Cédula de Identidad (1- Menú principal ⤴)', 'ci_frente'),
        askImage('Envíe una foto del DORSO de su Cédula de Identidad', 'ci_dorso'),
        api('adjuntarImagenes', {
          params: (c) => ({ cedula: c.vars.cedula, tipo: 'CI', imagenes: ['(Base64)', '(Base64)'] }),
          branches: [when('cod 105 · ya adjuntado', cod('105'), [nav('Documento ya adjuntado', '@self')])],
          otherwise: [nav('Documento adjuntado correctamente ✅', '@self', { suggested: true, note: 'El árbol solo muestra "Documento ya adjuntado" (cod 105): faltaba el mensaje de éxito.' })],
        }),
      ]),
      opt('otros', 'Otros', [
        askImage('Envía una foto del documento: (1- Menú principal ⤴)', 'documento'),
        api('adjuntarImagenes', { params: (c) => ({ cedula: c.vars.cedula, tipo: 'Otros', imagenes: ['(Base64)'] }), note: 'En el árbol el EP15 se llama ANTES de pedir la foto. Va después, como acá.' }),
        nav('Ha completado correctamente el registro de su documento.', '@self'),
      ]),
      opt('main', 'Menú principal', 'main'),
    ],
  }),
], { description: 'Fotos de la CI u otros documentos hacia el EP15.' });

const cupones = intent('cup', 'Consultas cupones', 'Soy cliente', [
  list(T.SELECCIONE, {
    button: 'Ver opciones',
    section: 'Cupones',
    rows: [
      opt('gen', 'Cómo generar cupones', [nav('Ver video explicativo 👆', '@self', { header: { type: 'video', duration: '1:24', placeholder: { title: 'Cómo generar tus cupones', subtitle: 'Video de ejemplo' } } })], { pending: 'Opción marcada como pendiente en el documento.' }),
      opt('bases', 'Bases y condiciones', [nav('Estas son las bases y condiciones.', '@self', { header: { type: 'document', name: 'Bases y condiciones.pdf', meta: 'PDF · archivo de ejemplo' }, suggested: true })], { pending: 'Opción marcada como pendiente en el documento.' }),
      opt('cons', 'Consultar mis cupones', [say(T.COMERCIAL), handoff('ATC', { topic: 'Consulta sobre cupones' })]),
      opt('cli', 'Volver Atrás', 'cli'),
    ],
  }),
], { description: 'Video, bases y condiciones, y consulta con un asesor.' });

const novedades = intent('nov', 'Canal de novedades', 'Menú principal', [
  list(T.SELECCIONE, {
    button: 'Ver opciones',
    section: 'Canal de novedades',
    rows: [
      opt('news', 'Suscribir a Newsletter', [
        ask('Ingresar Correo Electrónico (1- Menú principal ⤴)', 'email', { validate: V.email, error: T.ERR_EMAIL }),
        api('newsletter', { params: (c) => ({ email: c.vars.email, channel: '?' }) }),
        nav('¡Listo! Ya estás suscripto al newsletter ✅', '@self', { suggested: true }),
      ]),
      opt('canal', 'Canal de WhatsApp', [nav('Sumate a nuestro canal de WhatsApp para recibir novedades 👇\n(link del canal a definir)', '@self', { todo: 'Enviar link al canal de WhatsApp.' })]),
      opt('main', 'Menú Principal', 'main'),
    ],
  }),
], { description: 'Newsletter y canal de WhatsApp.' });

const vender = intent('vender', 'Vender propiedad', 'Menú principal', [
  say(T.VENDER),
  ask('Ingresar Nombre y Apellido (1- Menú principal ⤴)', 'oferta_nombre', { validate: V.name, error: 'Ingresá tu nombre y apellido.\n1- Menú principal ⤴' }),
  ask('Ingresar un Nro. de Teléfono', 'oferta_telefono', { validate: V.phonePY, error: T.ERR_CELULAR }),
  ask('En qué Ciudad/Distrito se encuentra la Propiedad: (1- Menú principal ⤴)', 'oferta_ciudad', { validate: V.name, error: 'Ingresá la ciudad o el distrito.\n1- Menú principal ⤴' }),
  ask('Precio en guaraníes por hectárea: (1- Menú principal ⤴)', 'oferta_precio_ha', { validate: V.money, error: 'Ingresá solo números, por ejemplo 150000000.\n1- Menú principal ⤴' }),
  ask('Superficie en hectáreas:', 'oferta_superficie', { validate: V.decimal, error: 'Ingresá la superficie en números, por ejemplo 12,5.\n1- Menú principal ⤴' }),
  cond('¿Superficie ≥ 5 ha?', [when('SI CUMPLE', (c) => Number(c.vars.oferta_superficie) >= 5, [])], [
    say('IDESA solo compra propiedades de 5 hectáreas en adelante.', { suggested: true }),
    buttons('¿Te ayudamos con algo más?', [opt('main', 'Menú principal', 'main'), opt('fin', 'Finalizar sesión', 'fin')], { suggested: true }),
  ]),
  api('ofrecerLotes', {
    params: (c) => ({ cedula: c.vars.cedula ?? '', nombre: c.vars.oferta_nombre, celular: c.vars.oferta_telefono, ciudad: c.vars.oferta_ciudad, precio: c.vars.oferta_precio_ha, superficie: c.vars.oferta_superficie }),
    rec: 'Se llama al EP1 antes del agradecimiento: si falla, el cliente no recibe una promesa de contacto que nadie va a cumplir.',
    branches: [when('cod 99 · petición incompleta', cod('99'), [action('El lead no se registró', { detail: 'Falta la cédula: el flujo nunca la pide' })])],
    otherwise: [],
  }),
  say(T.GRACIAS),
  goto('fin'),
], { description: 'Cinco datos del oferente y alta en el EP1.' });

const departamento = intent('depto', 'Adquirir departamento', 'Menú principal', [
  ask('Ingresar Nombre y Apellido (1- Menú principal ⤴)', 'nombre_cliente', { validate: V.name, error: 'Ingresá tu nombre y apellido.\n1- Menú principal ⤴' }),
  ask('Ingresar un Nro. de Teléfono', 'celular_cliente', { validate: V.phonePY, error: T.ERR_CELULAR }),
  say(T.DEPTO),
  handoff('Ventas', { topic: 'Interesado en departamento' }),
], { description: 'Nombre, teléfono y derivación a Ventas.' });

const sugerencias = intent('sug', 'Sugerencias', 'Menú principal', [
  buttons('¿Es usted una persona con discapacidad?', [
    opt('si', 'Sí', undefined, { set: { es_pcd: true } }),
    opt('no', 'No', undefined, { set: { es_pcd: false } }),
    opt('main', 'Menú Principal', 'main'),
  ]),
  ask('Ingresar Nro. Cédula (1- Menú principal ⤴)', 'cedula', { validate: V.cedulaPY, error: T.ERR_CEDULA, skipIf: has('cedula') }),
  ask('Ingresar Nombre y Apellido', 'nombre_cliente', { validate: V.name, error: 'Ingresá tu nombre y apellido.\n1- Menú principal ⤴', skipIf: has('nombre_cliente') }),
  ask('Ingresar Reclamo o Sugerencia (1- Menú principal ⤴)', 'reclamo_texto', { validate: V.minLength(5), error: 'Contanos un poco más (al menos 5 caracteres).\n1- Menú principal ⤴' }),
  api('enviarReclamo', { params: (c) => ({ cedula: c.vars.cedula, nombre: c.vars.nombre_cliente, reclamo: c.vars.reclamo_texto, pcd: c.vars.es_pcd }) }),
  say(T.ATC),
  handoff('ATC', { topic: (c) => `Reclamo o sugerencia${c.vars.es_pcd ? ' · prioridad PcD' : ''}`, topicId: 200 }),
], { description: 'Reclamos y sugerencias, con prioridad para personas con discapacidad.' });

const ejecutivo = intent('ejec', 'Hablar con un ejecutivo', 'Menú principal', [
  say(T.DEMORA),
  handoff('ATC', { topic: 'Pidió hablar con un ejecutivo', note: 'El árbol dice "Derivar a Ejecutivo" sin nombrar la cola: se asume ATC.' }),
], { description: 'Derivación directa a un ejecutivo.' });

const finalizar = intent('fin', 'Finalizar sesión', 'Cierre', [
  list(T.ENCUESTA, {
    button: 'Calificar',
    section: 'Tu calificación',
    label: 'Encuesta de satisfacción',
    saveAs: 'csat_nota',
    note: 'Se envía al finalizar toda sesión, según el documento.',
    rows: [
      opt('5', 'Excelente', undefined, { match: ['5'] }),
      opt('4', 'Muy Buena', undefined, { match: ['4'] }),
      opt('3', 'Buena', undefined, { match: ['3'] }),
      opt('2', 'Regular', undefined, { match: ['2'] }),
      opt('1', 'Mala', undefined, { match: ['1'] }),
    ],
    onFreeText: [set({ csat_comentario: (c: Ctx) => c.input })],
    onTimeout: [set({ csat_nota: 'sin respuesta' })],
    timeoutMin: 5,
  }),
  action('Guardar calificación', { detail: 'csat_nota · csat_comentario' }),
  cond('¿Nota 1 o 2?', [when('SI CUMPLE', (c) => Number(c.vars.csat_nota) <= 2, [action('Notificar al supervisor', { detail: 'Revisar la conversación', rec: 'Cerrar el círculo con los clientes insatisfechos el mismo día.' })])]),
  say(T.APP, { label: 'Mensaje de texto' }),
  close(),
], { description: 'Encuesta, mensaje de la APP y cierre: Cerrar → Archivar → UNASSIGN_BOT.' });

/* =====================================================================
   Definición
   ===================================================================== */

export default defineBot({
  config: {
    id: 'idesa',
    name: 'Bot IDESA',
    client: 'Inmobiliaria del Este',
    description: 'Atención por WhatsApp: compra de lotes, clientes (saldos, impuestos, trámites), ventas de propiedades y reclamos.',
    profile: { name: 'Inmobiliaria del Este', initials: 'IDE', color: '#0E6E5C', about: 'Cuenta de empresa' },
    entry: 'main',
    closeIntent: 'fin',
    groups: ['Entrada', 'Menú principal', 'Soy cliente', 'Cierre'],
    contactVars: ['celular_cliente', 'csat_nota', 'csat_comentario', 'optout_marketing'],
    keywords: [
      { words: ['menu', 'menú', 'menu principal', 'hola', 'inicio'], goto: 'main' },
      { words: ['volver', 'volver atras'], goto: '@back' },
      { words: ['agente', 'asesor', 'ejecutivo'], goto: 'ejec' },
      { words: ['salir', 'chau', 'cerrar sesion'], goto: 'fin' },
    ],
    askEscape: { input: '1', goto: 'main' },
    fallback: {
      maxAttempts: 3,
      list: 'No reconocí tu respuesta 🤔 Elegí una opción de la lista.',
      buttons: 'No reconocí tu respuesta 🤔 Tocá uno de los botones.',
      retry: 'Probá tocando una opción 👇',
      invalidInput: 'El dato ingresado no es válido. Probá de nuevo.\n1- Menú principal ⤴',
      offerAgentOnAttempt: 2,
      agentChoice: { list: 'Hablar con un ejecutivo', buttons: 'Hablar con ejecutivo' },
      escalateTo: 'ejec',
    },
    media: {
      audio: 'Por ahora no puedo escuchar audios 🎧 ¿Me lo escribís?',
      fileInChoice: 'Recibí tu archivo 📎, pero en este paso necesito que elijas una opción.',
      fileInAsk: 'Recibí tu archivo 📎, pero en este paso necesito que me lo escribas.',
      imageNeeded: 'Necesito una *foto* para continuar 📷 Tocá el clip y elegí Galería.\n1- Menú principal ⤴',
    },
    inactivity: { reminderAfterMin: 10, reminder: '¿Seguís ahí? 👀 Respondé para continuar donde quedamos.', closeAfterMin: 5, goto: 'fin' },
    handoff: {
      queues: { Ventas: { label: 'Ventas', hours: 'Lun a sáb · a confirmar' }, ATC: { label: 'Atención al Cliente', hours: 'Lun a vie · a confirmar' } },
      outOfHours: [
        say(T.FUERA, { label: 'Fuera de horario' }),
        action('Registrar pendiente', { detail: 'Motivo y cola, para contactar al abrir', rec: 'No encolar fuera de horario: registrar y escribir con una plantilla al abrir.' }),
        buttons('¿Te ayudamos con algo más?', [opt('main', 'Menú principal', 'main'), opt('fin', 'Finalizar sesión', 'fin')], { suggested: true }),
      ],
      queueWait: {
        afterMin: 30,
        steps: [
          say('Seguimos buscando un ejecutivo disponible 🙏', { suggested: true }),
          buttons('¿Qué preferís?', [
            opt('wait', 'Seguir esperando', [resumeQueue()]),
            opt('leave', 'Dejar mi consulta', [ask('Escribí tu consulta y te contactamos', 'consulta_pendiente', { escape: false }), action('Registrar pendiente', { detail: 'Y sacarlo de la cola' }), goto('fin')]),
            opt('main', 'Menú principal', 'main'),
          ], { suggested: true }),
        ],
      },
      agentName: 'Asesor de prueba',
    },
    endpointError: {
      retries: 1,
      steps: [
        say('No pudimos consultar tus datos en este momento 😔', { suggested: true }),
        buttons('Elegí una opción', [opt('retry', 'Reintentar', '@self'), opt('ejec', 'Hablar con ejecutivo', [handoff('ATC', { topic: 'Error de endpoint' })]), opt('main', 'Menú principal', 'main')], { suggested: true }),
      ],
    },
    closeActions: ['Cerrar conversación', 'Archivar conversación', 'UNASSIGN_BOT'],
    templates: [
      {
        id: 'recordatorio_pago',
        name: 'Recordatorio de pago',
        category: 'utility',
        text: 'Hola 👋 Te recordamos que la cuota de tu lote *938-8-9* está por vencer. Podés consultar tu saldo y las bocas de pago desde acá.',
        footer: 'Plantilla de ejemplo',
        suggested: true,
        buttons: [
          opt('saldo', 'Ver mi saldo', 'saldos', { set: { cedula: '1234567', es_cliente: true, nombre_cliente: 'Juan Pérez' }, todo: 'La sesión es nueva: la cédula tiene que viajar como variable de la plantilla.' }),
          opt('pague', 'Ya pagué', [say('¡Gracias por avisarnos! 🙌', { suggested: true }), goto('fin')]),
          opt('ejec', 'Hablar con ejecutivo', [handoff('ATC', { topic: 'Respuesta a recordatorio de pago' })]),
        ],
      },
      {
        id: 'pin_por_vencer',
        name: 'PIN por vencer',
        category: 'utility',
        text: 'Tu PIN para la gestión del impuesto inmobiliario del lote *938-8-9* vence en 3 días. ¿Querés que te reenviemos el enlace?',
        footer: 'Plantilla de ejemplo',
        suggested: true,
        buttons: [
          opt('reenviar', 'Reenviar enlace', [api('autogestionImpuesto', { label: 'Autogestión · reenvío', params: (c) => ({ cedula: c.vars.cedula, fml: c.vars.fml_seleccionado }) }), nav(autogText, 'main', { label: 'Importe, PIN y enlace', example: 'El importe es de *Gs. 89.300*…' })], { set: { cedula: '1234567', es_cliente: true, fml_seleccionado: '938-8-9' } }),
          opt('menu', 'Menú principal', 'main'),
        ],
      },
      {
        id: 'novedades_idesa',
        name: 'Novedades',
        category: 'marketing',
        text: '📣 Novedades de IDESA\n(Contenido de la campaña de ejemplo)\n\nRespondé *BAJA* si no querés recibir más mensajes.',
        footer: 'Plantilla de ejemplo',
        suggested: true,
        buttons: [opt('menu', 'Ver opciones', 'main'), opt('baja', 'BAJA', [set({ optout_marketing: true }), say('Listo, no vas a recibir más novedades.', { suggested: true }), goto('fin')])],
      },
    ],
    api: {
      formatRequest: (params) => ({ key: 'eyJhbGciOiJIUzI1NiJ9… (JWT)', parametros: JSON.stringify(params) }),
    },
    demo: {
      notice: '🔒 Demo de prueba. Las respuestas y los datos de clientes son de ejemplo.',
      tips: ['Escribí "hola" para empezar.', 'Tocá "Ver opciones" para abrir los menús.', 'En "Soy cliente" usá una de las cédulas de prueba.'],
      identities: [
        { value: '1234567', label: 'Cliente con 2 lotes' },
        { value: '7654321', label: 'VIP · débito automático' },
        { value: '2222222', label: 'Lote demandado' },
        { value: '1111111', label: 'No es cliente' },
      ],
      shareIdentities: true,
      gallery: [
        { label: 'CI frente', kind: 'id-front' },
        { label: 'CI dorso', kind: 'id-back' },
        { label: 'Boleta', kind: 'receipt' },
      ],
    },
    nav: { menu: { title: 'Menú Principal', goto: 'main' }, back: { title: 'Volver Atrás' }, close: { title: 'Finalizar Sesión', goto: 'fin' } },
  },
  intents: [
    main,
    adquirirLote,
    loteProgramado,
    soyCliente,
    novedades,
    vender,
    departamento,
    sugerencias,
    ejecutivo,
    impuestos,
    saldos,
    cuentas,
    actualizarDatos,
    gestionarLote,
    agendarVisita,
    adjuntar,
    cupones,
    finalizar,
  ],
  endpoints,
});
