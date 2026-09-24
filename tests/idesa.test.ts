import { describe, expect, it } from 'vitest';
import idesa from '../src/bots/idesa/bot';
import { createSession } from '../src/core/testing';

/** Conversaciones reales contra el bot de IDESA. Sirven de ejemplo para escribir los tests de un bot nuevo. */
describe('IDESA', () => {
  it('cliente con 2 lotes consulta cuánto debe', async () => {
    const s = createSession(idesa);
    await s.send('hola');
    expect(s.botTexts()[0]).toContain('bienvenida');
    await s.pick('Soy cliente de IDESA');
    expect(s.lastText()).toContain('Nro. de Cédula');
    await s.send('1234567');
    expect(s.vars.es_cliente).toBe(true);
    expect(s.botTexts().some((t) => t.startsWith('Estimado cliente'))).toBe(true);
    await s.pick('Saldos y pagos');
    await s.pick('Cuánto debo pagar');
    expect(s.lastText()).toContain('Gs. 657.950');
    expect(s.lastText()).toContain('Gs. 311.500');
    expect(s.options()).toEqual(['Menú principal', 'Hablar con Agente', 'Finalizar Sesión']);
  });

  it('la cédula se pide una sola vez por sesión', async () => {
    const s = createSession(idesa);
    await s.send('hola');
    await s.pick('Soy cliente de IDESA');
    await s.send('1234567');
    await s.pick('Menú principal');
    await s.pick('Soy cliente de IDESA');
    expect(s.botTexts().filter((t) => t.includes('Nro. de Cédula'))).toHaveLength(1);
  });

  it('no cliente (cod 97): se borra la cédula y se ofrecen salidas', async () => {
    const s = createSession(idesa);
    await s.send('hola');
    await s.pick('Soy cliente de IDESA');
    await s.send('1111111');
    expect(s.vars.cedula).toBeUndefined();
    expect(s.options()).toEqual(['Adquirir un lote', 'Hablar con ejecutivo', 'Menú principal']);
  });

  it('autogestión del impuesto con lista dinámica de lotes', async () => {
    const s = createSession(idesa);
    await s.send('hola');
    await s.pick('Soy cliente de IDESA');
    await s.send('1234567');
    await s.pick('Impuestos inmobiliarios');
    await s.pick('Gestionar pago impuesto');
    expect(s.options()).toEqual(['938-8-9 Nueva Canada II', '938-8-10 Nueva Canada II', 'Menú principal ⤴']);
    await s.pick('938-8-10');
    expect(s.vars.fml_seleccionado).toBe('938-8-10');
    expect(s.lastText()).toContain('PIN: 5821');
  });

  it('cliente VIP no puede autogestionar (cod 96)', async () => {
    const s = createSession(idesa);
    await s.send('hola');
    await s.pick('Soy cliente de IDESA');
    await s.send('7654321');
    await s.pick('Impuestos inmobiliarios');
    await s.pick('Gestionar pago impuesto');
    expect(s.lastText()).toContain('débito automático');
  });

  it('boleta con atrasos pide la foto', async () => {
    const s = createSession(idesa);
    await s.send('hola');
    await s.pick('Soy cliente de IDESA');
    await s.send('1234567');
    await s.pick('Impuestos inmobiliarios');
    await s.pick('Enviar boleta de pago');
    await s.pick('938-8-10');
    expect(s.lastText()).toContain('foto de la boleta');
    await s.send('acá va');
    expect(s.lastText()).toContain('foto');
    await s.sendMedia({ type: 'image', name: 'boleta.jpg' });
    expect(s.lastText()).toBe('Recibimos tu boleta ✅');
  });

  it('vender propiedad sin cédula: el EP1 responde 99 y el lead no se registra', async () => {
    const s = createSession(idesa);
    await s.send('hola');
    await s.pick('Vender mi propiedad');
    await s.send('Ana López');
    await s.send('0981 123 456');
    await s.send('Luque');
    await s.send('150.000.000');
    await s.send('12,5');
    expect(s.logTitles('act')).toContain('El lead no se registró');
    expect(s.intent).toBe('fin');
  });

  it('vender propiedad de menos de 5 ha', async () => {
    const s = createSession(idesa);
    await s.send('hola');
    await s.pick('Vender mi propiedad');
    for (const t of ['Ana López', '0981123456', 'Luque', '150000000', '3']) await s.send(t);
    expect(s.botTexts()).toContain('IDESA solo compra propiedades de 5 hectáreas en adelante.');
    expect(s.options()).toEqual(['Menú principal', 'Finalizar sesión']);
  });

  it('derivación fuera de horario', async () => {
    const s = createSession(idesa, { inHours: false });
    await s.send('hola');
    await s.pick('Hablar con un ejecutivo');
    expect(s.botTexts().some((t) => t.includes('fuera del horario'))).toBe(true);
    expect(s.mode).toBe('bot');
  });

  it('encuesta y cierre completo', async () => {
    const s = createSession(idesa);
    await s.send('hola');
    await s.pick('Cerrar sesión');
    await s.pick('Regular');
    expect(s.logTitles('act')).toContain('Notificar al supervisor');
    expect(s.logTitles('act').slice(-4)).toEqual(['Limpiar variables de sesión', 'Cerrar conversación', 'Archivar conversación', 'UNASSIGN_BOT']);
    expect(s.mode).toBe('idle');
    expect(s.vars.csat_nota).toBe('2');
  });

  it('plantilla de recordatorio: "Ver mi saldo" va directo a saldos', async () => {
    const s = createSession(idesa);
    await s.template('recordatorio_pago', 'Ver mi saldo');
    expect(s.intent).toBe('saldos');
    await s.pick('Cuánto debo pagar');
    expect(s.lastText()).toContain('Gs. 657.950');
  });

  it('adjuntar la CI dos veces: la segunda responde "ya adjuntado"', async () => {
    const s = createSession(idesa);
    await s.send('hola');
    await s.pick('Soy cliente de IDESA');
    await s.send('2222222');
    for (let i = 0; i < 2; i++) {
      await s.pick('Adjuntar Documento(s)');
      await s.pick('CI');
      await s.sendMedia({ type: 'image', name: 'frente.jpg' });
      await s.sendMedia({ type: 'image', name: 'dorso.jpg' });
      if (i === 0) {
        expect(s.lastText()).toContain('correctamente');
        await s.pick('Menú Principal');
        await s.pick('Soy cliente de IDESA');
      }
    }
    expect(s.lastText()).toBe('Documento ya adjuntado');
  });
});
