import type { EndpointDef } from '../../core/types';

/**
 * Datos de ejemplo tomados del documento del cliente.
 * Cada cédula representa un escenario de prueba (ver `demo.identities` en bot.ts).
 */
export interface Lote {
  fml: string;
  fraccion: string;
  distrito: string;
  depto: string;
  cta: string;
  sup: string;
  deuda: { monto: string; desde: string; hasta?: string };
  impuesto: 'al_dia' | 'atrasado';
  autogestion?: { importe: string; pin: string };
}

export interface Cliente {
  nombre: string;
  vip?: boolean;
  demandado?: boolean;
  lotes: Lote[];
}

export const DB: Record<string, Cliente> = {
  '1234567': {
    nombre: 'Juan Pérez',
    lotes: [
      { fml: '938-8-9', fraccion: 'NUEVA CANADA II', distrito: 'Villarrica', depto: 'Guairá', cta: '9231', sup: '365.46', deuda: { monto: '657.950', desde: 'Cuota: 34 del mes de Ago/2025', hasta: 'Cuota: 35 del mes de Set/2025' }, impuesto: 'al_dia', autogestion: { importe: '89.300', pin: '1234' } },
      { fml: '938-8-10', fraccion: 'NUEVA CANADA II', distrito: 'Villarrica', depto: 'Guairá', cta: '9232', sup: '365.46', deuda: { monto: '311.500', desde: 'Cuota: 37 del mes de Nov/2025' }, impuesto: 'atrasado', autogestion: { importe: '89.300', pin: '5821' } },
    ],
  },
  '7654321': {
    nombre: 'María Gómez',
    vip: true,
    lotes: [{ fml: '412-3-7', fraccion: 'VILLA ELISA I', distrito: 'Lambaré', depto: 'Central', cta: '5510', sup: '420.00', deuda: { monto: '1.250.000', desde: 'Cuota: 12 del mes de Set/2026' }, impuesto: 'al_dia' }],
  },
  '2222222': {
    nombre: 'Carlos Benítez',
    demandado: true,
    lotes: [{ fml: '205-1-4', fraccion: 'SAN LORENZO II', distrito: 'San Lorenzo', depto: 'Central', cta: '3302', sup: '360.00', deuda: { monto: '2.480.000', desde: 'Cuota: 18 del mes de Ene/2026', hasta: 'Cuota: 26 del mes de Set/2026' }, impuesto: 'atrasado', autogestion: { importe: '92.100', pin: '7710' } }],
  },
};

export const cliente = (cedula: unknown): Cliente | undefined => DB[String(cedula ?? '')];
export const lote = (cedula: unknown, fml: unknown): Lote | undefined => cliente(cedula)?.lotes.find((l) => l.fml === fml);

/** Estado del backend simulado que sobrevive al cierre de sesión (ej. documentos ya adjuntados). */
const backend = { ciAdjuntada: new Set<string>() };

const ok = (cod: string, desc: string, data: unknown = []) => ({ status: true, message: { desc, cod }, data });
const fail = (cod: string, desc: string, data: unknown = []) => ({ status: false, message: { desc, cod }, data });
const atc = (topicID: number, topic: string) => ({ status: true, message: { desc: 'Derivar con personal de ATC', cod: '103' }, atc: { topic, topicID }, data: [] });

export const endpoints: Record<string, EndpointDef> = {
  ofrecerLotes: {
    name: 'Ofrecer Lotes',
    ref: 'EP 1',
    method: 'POST',
    path: '/whatsapp/heyNow/ofrecerLotes/',
    codes: [['101', 'Operación exitosa'], ['99', 'Petición incompleta: falta un campo'], ['98', 'Error al crear contacto']],
    pending: 'La cédula es obligatoria y el flujo nunca la pide. El endpoint espera superficie en m² y precio de venta; el bot pide hectáreas y precio por hectárea.',
    mock: (p) => (p.cedula ? ok('101', 'Muchas gracias por su interes, nos pondremos en contacto con usted en la brevedad') : fail('99', '(...), Peticion incompleta !!')),
  },
  pagosPendientes: {
    name: 'Pagos Pendientes',
    ref: 'EP 3',
    method: 'POST',
    path: '/whatsapp/heyNow/pagosPendientes/',
    codes: [['107', 'Registra deudas: detalle por FML'], ['99', 'Lotes demandados: mensaje especial'], ['96 / 97', 'Sin datos del cliente']],
    mock: (p) => {
      const c = cliente(p.cedula);
      if (!c) return fail('97', 'No es cliente');
      if (c.demandado) return ok('99', 'Lotes demandados');
      return ok('107', 'El cliente Registra deudas', Object.fromEntries(c.lotes.map((l) => [l.fml, { FRACCION: l.fraccion, DISDESC: l.distrito, DEPDESC: l.depto, MONTO: l.deuda.monto }])));
    },
  },
  cuentasCatastrales: {
    name: 'Cuentas Catastrales',
    ref: 'EP 4',
    method: 'POST',
    codes: [['107', 'OK: un bloque por lote'], ['96 / 97', 'Sin datos'], ['103', 'Derivar a ATC']],
    mock: (p) => {
      const c = cliente(p.cedula);
      return c ? ok('107', 'OK', Object.fromEntries(c.lotes.map((l) => [l.fml, { CTACTE: l.cta, FRACCION: l.fraccion, SUPERFICIE: l.sup }]))) : fail('97', 'No es cliente');
    },
  },
  impuestoInmobiliario: {
    name: 'Impuesto Inmobiliario',
    ref: 'EP 5',
    method: 'POST',
    codes: [['110', 'Impuesto al día'], ['109', 'Con atrasos'], ['111', 'Falta la imagen'], ['112 / 113', 'Adjunto recibido / falló']],
    mock: (p) => {
      if (p.imagen) return ok('112', 'Boleta adjuntada');
      const l = lote(p.cedula, p.fml);
      return l?.impuesto === 'al_dia' ? ok('110', 'Impuesto al día') : ok('109', 'Impuesto con atrasos');
    },
  },
  actualizarDatos: {
    name: 'Actualizar Datos',
    ref: 'EP 6',
    method: 'POST',
    codes: [['118', 'Datos actualizados'], ['119', 'No se actualizó'], ['97', 'No es cliente']],
    mock: (p) => {
      if (!cliente(p.cedula)) return fail('97', 'No es cliente');
      if (!p.opcion) return fail('99', '(...), Peticion incompleta !!');
      return ok('118', 'Datos actualizados');
    },
  },
  requisitosLotes: {
    name: 'Requisitos Lotes',
    ref: 'EP 8',
    method: 'POST',
    codes: [['128', 'Enviar imagen de requisitos'], ['103', 'Derivar a ATC'], ['127', 'Volver a pedir la opción']],
    mock: (p) => (['3', '4'].includes(String(p.opcion)) ? atc(p.opcion === '3' ? 206 : 207, 'Requisitos') : ok('128', 'Enviar imagen', { imagen: '(Base64)' })),
  },
  bocasMunicipios: {
    name: 'Bocas Municipios',
    ref: 'EP 9',
    method: 'POST',
    codes: [['129', 'Enviar la imagen'], ['130', '“Muchas gracias…”: el documento no define cuándo se usa'], ['103', 'Derivar a ATC']],
    todo: 'La imagen llega en Base64: subirla a un storage temporal y enviarla por URL, o pedir a IDESA que el endpoint devuelva la URL.',
    mock: () => ok('129', 'Enviar imagen', { imagen: 'iVBORw0KGgo… (Base64)' }),
  },
  problemasPagoCuota: {
    name: 'Problemas Pago Cuota',
    ref: 'EP 10',
    method: 'POST',
    codes: [['103', 'Derivar a ATC · topicID 209']],
    pending: '¿El endpoint registra la red de pago elegida o la ignora?',
    mock: () => atc(209, 'Problemas con el pago de cuota'),
  },
  reamojonamiento: { name: 'Solicitar Reamojonamiento', ref: 'EP 11', method: 'POST', codes: [['103', 'Derivar a ATC · topicID 210']], mock: () => atc(210, 'Re-amojonamiento') },
  extensionElectrica: { name: 'Solicitar Extensión Eléctrica', ref: 'EP 12', method: 'POST', codes: [['103', 'Derivar a ATC · topicID 211']], mock: () => atc(211, 'Extensión eléctrica') },
  envioFactura: { name: 'Solicitar Envío de Factura', ref: 'EP 13', method: 'POST', codes: [['103', 'Derivar a ATC · topicID 212']], mock: () => atc(212, 'Envío de factura') },
  enviarReclamo: { name: 'Enviar Reclamo', ref: 'EP 14', method: 'POST', codes: [['103', 'Derivar a ATC · topicID 200'], ['136', 'Falta el reclamo']], mock: () => atc(200, 'Reclamo o sugerencia') },
  adjuntarImagenes: {
    name: 'Adjuntar Imágenes WhatsApp',
    ref: 'EP 15',
    method: 'POST',
    codes: [['100', 'Documento adjuntado'], ['105', 'Documento ya adjuntado'], ['111', 'Falta la imagen'], ['113', 'Falló el adjunto']],
    pending: 'Marcado como pendiente en el documento.',
    mock: (p) => {
      const key = `${p.cedula}:${p.tipo}`;
      if (p.tipo === 'CI' && backend.ciAdjuntada.has(key)) return ok('105', 'Documento ya adjuntado');
      if (p.tipo === 'CI') backend.ciAdjuntada.add(key);
      return ok('100', 'Documento adjuntado');
    },
  },
  newsletter: {
    name: 'Suscribirse al Newsletter',
    ref: 'EP 17',
    method: 'POST',
    codes: [['0', 'Suscripción registrada']],
    pending: 'Parámetro "channel" sin definir en el documento.',
    mock: () => ({ code: 0, message: { desc: 'Suscripto', cod: '0' } }),
  },
  autogestionImpuesto: {
    name: 'Autogestionar Impuesto v3',
    ref: 'EP 18',
    method: 'POST',
    codes: [['97', 'Seleccionar lote: viene data.lotes'], ['96', 'VIP, débito automático o sin lotes'], ['999', 'JSON de parametros mal codificado']],
    mock: (p) => {
      const c = cliente(p.cedula);
      if (!c) return fail('96', 'Sin lotes');
      if (p.fml) {
        const l = lote(p.cedula, p.fml);
        return ok('200', 'Cotización generada', { importe: l?.autogestion?.importe, pin: l?.autogestion?.pin });
      }
      if (c.vip) return fail('96', 'Cliente con débito automático');
      return fail('97', 'Seleccione un lote', { lotes: c.lotes.map((l) => ({ fml: l.fml, fraccion: l.fraccion, departamento: l.depto, distrito: l.distrito })) });
    },
  },
};
