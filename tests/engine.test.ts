import { describe, expect, it } from 'vitest';
import { F, api, ask, buttons, close, cod, cond, defineBot, flow, handoff, intent, list, opt, resumeQueue, say, screen, set, when } from '../src/core/dsl';
import { V } from '../src/core/validators';
import { createSession } from '../src/core/testing';
import type { BotDef } from '../src/core/types';

/** Bot mínimo que ejercita todos los tipos de paso. */
function miniBot(): BotDef {
  return defineBot({
    config: {
      id: 'mini',
      name: 'Mini',
      client: 'Test',
      description: 'Bot de prueba del motor',
      profile: { name: 'Mini', initials: 'MI', color: '#333' },
      entry: 'main',
      closeIntent: 'fin',
      groups: ['A'],
      contactVars: ['csat'],
      keywords: [
        { words: ['menu'], goto: 'main' },
        { words: ['agente'], goto: 'humano' },
        { words: ['formulario'], goto: 'form' },
      ],
      askEscape: { input: '1', goto: 'main' },
      fallback: {
        maxAttempts: 3,
        list: 'No entendí (lista)',
        buttons: 'No entendí (botones)',
        retry: 'Probá de nuevo',
        invalidInput: 'Dato inválido',
        offerAgentOnAttempt: 2,
        agentChoice: { list: 'Hablar con alguien', buttons: 'Hablar con alguien' },
        escalateTo: 'humano',
      },
      media: { audio: 'No escucho audios', fileInChoice: 'Elegí una opción', fileInAsk: 'Escribilo', imageNeeded: 'Necesito una foto' },
      inactivity: { reminderAfterMin: 10, reminder: '¿Seguís ahí?', closeAfterMin: 5, goto: 'fin' },
      handoff: {
        queues: { Q: { label: 'Cola Q' } },
        outOfHours: [say('Fuera de horario'), buttons('¿Y ahora?', [opt('m', 'Menú', 'main'), opt('f', 'Salir', 'fin')])],
        queueWait: { afterMin: 30, steps: [buttons('¿Esperás?', [opt('w', 'Sí', [resumeQueue()]), opt('m', 'Menú', 'main')])] },
      },
      endpointError: { retries: 1, steps: [say('Falló el servicio'), buttons('¿Qué hacemos?', [opt('r', 'Reintentar', '@self'), opt('m', 'Menú', 'main')])] },
      closeActions: ['Cerrar conversación', 'Archivar conversación', 'UNASSIGN_BOT'],
      templates: [{ id: 'aviso', name: 'Aviso', category: 'utility', text: 'Aviso', buttons: [opt('ver', 'Ver datos', 'datos'), opt('no', 'No', 'fin')] }],
      nav: { menu: { title: 'Menú', goto: 'main' }, back: { title: 'Volver' }, close: { title: 'Salir', goto: 'fin' } },
    },
    intents: [
      intent('main', 'Principal', 'A', [
        say('Hola', { once: true }),
        list('¿Qué querés?', {
          button: 'Ver',
          rows: [opt('datos', 'Mis datos', 'datos'), opt('humano', 'Persona', 'humano'), opt('fin', 'Salir', 'fin')],
        }),
      ]),
      intent('datos', 'Datos', 'A', [
        ask('Tu cédula', 'cedula', { validate: V.cedulaPY, error: 'Cédula inválida' }),
        api('consulta', {
          params: (c) => ({ cedula: c.vars.cedula }),
          branches: [when('cod 1', cod('1'), [say('Sos cliente {{cedula}}')]), when('cod 2', cod('2'), 'fin')],
          otherwise: [say('No te encontré')],
        }),
        cond('¿VIP?', [when('sí', (c) => c.vars.cedula === '7777777', [set({ vip: true })])]),
        buttons('¿Algo más?', [opt('m', 'Menú', 'main'), opt('f', 'Salir', 'fin')]),
      ]),
      intent('humano', 'Humano', 'A', [say('Te derivo'), handoff('Q', { topic: 'Consulta' })]),
      intent('form', 'Formulario', 'A', [
        flow('Completá el formulario', {
          cta: 'Abrir',
          saveAs: 'form',
          screens: [
            screen('UNO', 'Uno', [F.text('nombre', 'Nombre', { required: true }), F.text('m2', 'Superficie', { input: 'number' })]),
            screen('DOS', 'Dos', [F.radio('tipo', 'Tipo', ['Casa', 'Lote']), F.checkbox('extras', 'Extras', [{ id: 'p', title: 'Pileta' }, { id: 'q', title: 'Quincho' }]), F.optin('acepta', 'Acepto', { required: true })], 'Enviar'),
          ],
        }),
        say('Gracias {{nombre}}'),
      ]),
      intent('fin', 'Fin', 'A', [
        list('Calificá', {
          button: 'Calificar',
          saveAs: 'csat',
          rows: [opt('5', 'Excelente', undefined, { match: ['5'] }), opt('1', 'Mala', undefined, { match: ['1'] })],
          onFreeText: [set({ comentario: (c) => c.input })],
          onTimeout: [set({ csat: 'sin respuesta' })],
        }),
        say('Chau'),
        close(),
      ]),
    ],
    endpoints: {
      consulta: {
        name: 'Consulta',
        mock: (p) => (p.cedula === '1234567' || p.cedula === '7777777' ? { message: { cod: '1' } } : p.cedula === '2222222' ? { message: { cod: '2' } } : { message: { cod: '9' } }),
      },
    },
  });
}

describe('motor', () => {
  it('saluda una vez por sesión y muestra el menú', async () => {
    const s = createSession(miniBot());
    await s.send('hola');
    expect(s.botTexts()).toEqual(['Hola', '¿Qué querés?']);
    await s.send('menu');
    expect(s.botTexts().filter((t) => t === 'Hola')).toHaveLength(1);
    expect(s.mode).toBe('bot');
  });

  it('elige por toque, por número y por título', async () => {
    const s = createSession(miniBot());
    await s.send('hola');
    await s.pick('Mis datos');
    expect(s.lastText()).toBe('Tu cédula');
    await s.send('menu');
    await s.send('1');
    expect(s.lastText()).toBe('Tu cédula');
    await s.send('menu');
    await s.send('mis datos');
    expect(s.intent).toBe('datos');
  });

  it('valida, reintenta y deriva después de 3 intentos', async () => {
    const s = createSession(miniBot());
    await s.send('hola');
    await s.pick('Mis datos');
    await s.send('abc');
    expect(s.lastText()).toBe('Cédula inválida');
    await s.send('12');
    expect(s.vars.intentos_fallback).toBe(2);
    await s.send('xx');
    expect(s.mode).toBe('agent');
    expect(s.botTexts()).toContain('Te derivo');
  });

  it('interpola variables y sigue la rama del endpoint', async () => {
    const s = createSession(miniBot());
    await s.send('hola');
    await s.pick('Mis datos');
    await s.send('1.234.567');
    expect(s.botTexts()).toContain('Sos cliente 1234567');
    expect(s.options()).toEqual(['Menú', 'Salir']);
  });

  it('una rama con goto salta de intención', async () => {
    const s = createSession(miniBot());
    await s.send('hola');
    await s.pick('Mis datos');
    await s.send('2222222');
    expect(s.intent).toBe('fin');
    expect(s.lastText()).toBe('Calificá');
  });

  it('"No entiende": aviso, oferta de asesor y derivación', async () => {
    const s = createSession(miniBot());
    await s.send('hola');
    await s.send('qwerty');
    expect(s.botTexts()).toContain('No entendí (lista)');
    await s.send('asdf');
    expect(s.options()).toContain('Hablar con alguien');
    await s.send('zzz');
    expect(s.mode).toBe('agent');
  });

  it('el escape "1" vuelve al menú desde una pregunta', async () => {
    const s = createSession(miniBot());
    await s.send('hola');
    await s.pick('Mis datos');
    await s.send('1');
    expect(s.intent).toBe('main');
  });

  it('audio en un menú: aviso y repite el menú', async () => {
    const s = createSession(miniBot());
    await s.send('hola');
    await s.sendMedia({ type: 'audio' });
    expect(s.botTexts().slice(-2)).toEqual(['No escucho audios', '¿Qué querés?']);
  });

  it('inactividad: recordatorio y después cierre', async () => {
    const s = createSession(miniBot());
    await s.send('hola');
    await s.tick();
    expect(s.lastText()).toBe('¿Seguís ahí?');
    await s.tick();
    expect(s.intent).toBe('fin');
    await s.tick();
    expect(s.mode).toBe('idle');
    expect(s.vars.csat).toBe('sin respuesta');
  });

  it('el cierre borra la sesión y conserva las variables del contacto', async () => {
    const s = createSession(miniBot());
    await s.send('hola');
    await s.pick('Mis datos');
    await s.send('1234567');
    await s.pick('Salir');
    await s.send('5');
    expect(s.mode).toBe('idle');
    expect(s.vars).toEqual({ csat: '5' });
    expect(s.logTitles('act')).toEqual(expect.arrayContaining(['Limpiar variables de sesión', 'Cerrar conversación', 'Archivar conversación', 'UNASSIGN_BOT']));
  });

  it('texto libre en la encuesta se guarda como comentario', async () => {
    const s = createSession(miniBot());
    await s.send('hola');
    await s.pick('Salir');
    await s.send('muy bien todo');
    expect(s.mode).toBe('idle');
  });

  it('derivación: con asesor, sin asesor y fuera de horario', async () => {
    const a = createSession(miniBot());
    await a.send('hola');
    await a.pick('Persona');
    expect(a.mode).toBe('agent');
    a.engine.agentClose();
    await a.engine.settle();
    expect(a.lastText()).toBe('Calificá');

    const b = createSession(miniBot(), { agentsAvailable: false });
    await b.send('hola');
    await b.pick('Persona');
    expect(b.mode).toBe('queue');
    await b.tick();
    expect(b.lastText()).toBe('¿Esperás?');
    await b.pick('Sí');
    expect(b.mode).toBe('queue');
    b.engine.setScenario({ agentsAvailable: true });
    expect(b.mode).toBe('agent');

    const c = createSession(miniBot(), { inHours: false });
    await c.send('hola');
    await c.pick('Persona');
    expect(c.botTexts()).toContain('Fuera de horario');
    expect(c.options()).toEqual(['Menú', 'Salir']);
  });

  it('endpoint caído: reintento, aviso y "Reintentar" repite la intención', async () => {
    const s = createSession(miniBot(), { endpointsDown: true });
    await s.send('hola');
    await s.pick('Mis datos');
    await s.send('1234567');
    expect(s.botTexts()).toContain('Falló el servicio');
    s.engine.setScenario({ endpointsDown: false });
    await s.pick('Reintentar');
    expect(s.intent).toBe('datos');
    expect(s.lastText()).toBe('Tu cédula');
  });

  it('plantilla saliente: su botón inicia su propio camino', async () => {
    const s = createSession(miniBot());
    await s.template('aviso', 'Ver datos');
    expect(s.intent).toBe('datos');
    expect(s.lastText()).toBe('Tu cédula');
  });

  it('palabra clave global interrumpe una pregunta', async () => {
    const s = createSession(miniBot());
    await s.send('hola');
    await s.pick('Mis datos');
    await s.send('agente');
    expect(s.mode).toBe('agent');
  });

  it('WhatsApp Flow: guarda cada campo normalizado y sigue con el paso siguiente', async () => {
    const s = createSession(miniBot());
    await s.send('hola');
    await s.send('formulario');
    expect(s.lastText()).toBe('Completá el formulario');
    await s.submitFlow({ nombre: ' Ana ', m2: '12,5', tipo: 'Casa', extras: ['p', 'q'], acepta: true });
    expect(s.vars).toMatchObject({ nombre: 'Ana', m2: '12.5', tipo: 'Casa', extras: ['p', 'q'], acepta: true });
    expect(s.vars.form).toMatchObject({ nombre: 'Ana', m2: '12.5' });
    expect(s.lastText()).toBe('Gracias Ana');
    const reply = s.items.find((i) => i.from === 'user' && i.kind === 'flow');
    expect(reply && 'answers' in reply ? reply.answers : []).toContainEqual({ label: 'Extras', value: 'Pileta, Quincho' });
  });

  it('WhatsApp Flow: obligatorios, texto libre y escape al menú', async () => {
    const s = createSession(miniBot());
    await s.send('hola');
    await s.send('formulario');
    await expect(s.submitFlow({ m2: 'doce' })).rejects.toThrow(/nombre: Este campo es obligatorio.*m2: Ingresá solo números.*acepta: Este campo es obligatorio/);
    await s.send('no quiero completar nada');
    expect(s.botTexts()).toContain('Para continuar, tocá “Abrir” y completá el formulario.');
    expect(s.items[s.items.length - 1]).toMatchObject({ from: 'bot', kind: 'flow' });
    await s.send('1');
    expect(s.intent).toBe('main');
  });

  it('reset vuelve todo al estado inicial', async () => {
    const s = createSession(miniBot());
    await s.send('hola');
    s.engine.reset();
    expect(s.items).toHaveLength(0);
    expect(s.mode).toBe('idle');
  });
});
