import type { EndpointDef } from '../../core/types';

/**
 * Endpoints simulados. Cada `mock` recibe los parámetros del paso `api` y devuelve
 * lo que respondería el servicio real según el documento del cliente.
 * Usar datos de ejemplo del documento y cubrir cada código de respuesta con un dato de prueba.
 */
const CLIENTES: Record<string, { nombre: string; saldo: string }> = {
  '1234567': { nombre: 'Cliente de prueba', saldo: '150.000' },
};

export const endpoints: Record<string, EndpointDef> = {
  consultarCliente: {
    name: 'Consultar cliente',
    ref: 'EP 1',
    method: 'POST',
    path: '/api/cliente',
    codes: [['200', 'Cliente encontrado'], ['404', 'No es cliente']],
    mock: (p) => {
      const c = CLIENTES[String(p.documento)];
      return c ? { message: { cod: '200', desc: 'OK' }, data: c } : { message: { cod: '404', desc: 'No encontrado' }, data: null };
    },
  },
};
