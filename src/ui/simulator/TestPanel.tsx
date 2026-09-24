import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Engine, EngineState, LogEntry } from '../../core/engine';
import type { BotConfig } from '../../core/types';
import { display } from '../../core/text';
import { href } from '../shared/router';
import type { Speed } from './useEngine';
import './panel.css';

const KIND_LABEL: Record<LogEntry['kind'], string> = {
  intent: 'Intención',
  cond: 'Condición',
  act: 'Acción',
  api: 'Endpoint',
  var: 'Variable',
  info: 'Info',
  warn: 'Revisar',
  user: 'Cliente',
};

export function statusOf(s: EngineState, cfg: BotConfig): { cls: string; text: string; short: string } {
  if (s.mode === 'bot') return { cls: 'bot', text: s.typing ? 'Bot escribiendo…' : 'Bot esperando respuesta', short: 'Bot activo' };
  if (s.mode === 'queue') return { cls: 'queue', text: `En cola ${cfg.handoff.queues[s.queue ?? '']?.label ?? ''} · sin asesor`, short: 'En cola' };
  if (s.mode === 'agent') return { cls: 'agent', text: 'Con asesor · bot apagado', short: 'Con asesor' };
  return { cls: '', text: 'Sin sesión · el próximo mensaje la inicia', short: 'Sin sesión' };
}

function tickInfo(s: EngineState, cfg: BotConfig): { label: string; enabled: boolean } {
  if (s.mode === 'bot') {
    if (s.waiting === 'timed') return { label: 'Pasar el tiempo límite', enabled: true };
    return s.inactStage === 1
      ? { label: `Pasar ${cfg.inactivity.closeAfterMin} min más sin responder`, enabled: true }
      : { label: `Pasar ${cfg.inactivity.reminderAfterMin} min sin responder`, enabled: true };
  }
  if (s.mode === 'queue') return cfg.handoff.queueWait ? { label: `Pasar ${cfg.handoff.queueWait.afterMin} min en cola`, enabled: true } : { label: 'Sin espera en cola configurada', enabled: false };
  if (s.mode === 'agent') return { label: 'Con asesor, el cierre lo decide él', enabled: false };
  return { label: `Pasar ${cfg.inactivity.reminderAfterMin} min sin responder`, enabled: false };
}

export interface TestPanelProps {
  engine: Engine;
  state: EngineState;
  logs: LogEntry[];
  speed: Speed;
  setSpeed: (s: Speed) => void;
  onPrefill: (value: string) => void;
  /** En móvil el panel es una capa: se muestra solo si está abierto. */
  mobileOpen?: boolean;
  onClose?: () => void;
}

/** Panel con estado, registro, variables y escenario. Se muestra en /:bot/prueba. */
export function TestPanel({ engine, state, logs, speed, setSpeed, onPrefill, mobileOpen = false, onClose }: TestPanelProps) {
  const cfg = engine.bot.config;
  const [tab, setTab] = useState<'log' | 'vars' | 'cfg'>('log');
  const [agentText, setAgentText] = useState('');
  const [scenario, setScenario] = useState(engine.scenario);
  const paneRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = paneRef.current;
    if (el && tab === 'log' && stick.current) el.scrollTop = el.scrollHeight;
  }, [logs, tab]);

  const st = statusOf(state, cfg);
  const tick = tickInfo(state, cfg);
  const flow = (intent: string) => href(`/${cfg.id}/flujo#${intent}`);
  const varKeys = Object.keys(state.vars);
  const session = varKeys.filter((k) => !cfg.contactVars.includes(k));
  const contact = varKeys.filter((k) => cfg.contactVars.includes(k));

  const toggle = (k: keyof typeof scenario) => (e: ChangeEvent<HTMLInputElement>) => {
    const next = { ...scenario, [k]: e.target.checked };
    setScenario(next);
    engine.setScenario({ [k]: e.target.checked });
  };

  const sendAgent = (e: FormEvent) => {
    e.preventDefault();
    const t = agentText.trim();
    if (!t) return;
    setAgentText('');
    engine.agentSay(t);
  };

  const table = (keys: string[]) =>
    keys.length ? (
      <table className="tp-vt">
        <tbody>
          {keys.map((k) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{display(state.vars[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div className="tp-empty">Sin variables todavía.</div>
    );

  return (
    <aside className="tp" aria-label="Panel de prueba" data-open={mobileOpen}>
      <div className="tp-top">
        {onClose && (
          <button type="button" className="btn tp-close" onClick={onClose}>
            Volver al chat
          </button>
        )}
        <div>
          <div className="eyebrow">Panel de prueba</div>
          <h1>{cfg.name}</h1>
          <p>Escribí o tocá como si fueras el cliente. Los endpoints responden con los datos de ejemplo.</p>
        </div>
        <div className="tp-status">
          <span className={`pill ${st.cls}`}>
            <i />
            {st.text}
          </span>
          {state.intent && state.mode !== 'idle' && (
            <span className="tp-cur">
              Intención:{' '}
              <a href={flow(state.intent)} target="_blank" rel="noopener">
                {engine.bot.intents.find((i) => i.id === state.intent)?.name ?? state.intent} ↗
              </a>
            </span>
          )}
        </div>
        <div className="tp-acts">
          <button type="button" className="btn pri" disabled={!tick.enabled} onClick={() => engine.tick()}>
            {tick.label}
          </button>
          <button type="button" className="btn" onClick={() => engine.reset()}>
            Reiniciar conversación
          </button>
        </div>
        {(state.mode === 'agent' || state.mode === 'queue') && (
          <div className="tp-agent">
            <div className="lbl">{state.mode === 'agent' ? `${cfg.handoff.agentName ?? 'Asesor de prueba'} · bot apagado` : 'En cola · esperando un asesor'}</div>
            {state.mode === 'agent' ? (
              <>
                <form onSubmit={sendAgent}>
                  <input value={agentText} onChange={(e) => setAgentText(e.target.value)} placeholder="Responder como asesor…" aria-label="Mensaje del asesor" />
                  <button className="btn" type="submit">
                    Enviar
                  </button>
                </form>
                <button type="button" className="btn" onClick={() => engine.agentClose()}>
                  El asesor cierra el chat
                </button>
              </>
            ) : (
              <span className="tp-lbl" style={{ margin: 0 }}>
                Encendé “Hay asesores disponibles” en Escenario para asignarla.
              </span>
            )}
          </div>
        )}
        {!!cfg.demo?.identities?.length && (
          <div>
            <div className="tp-lbl">Datos de prueba · tocá uno para escribirlo en el chat</div>
            <div className="chips">
              {cfg.demo.identities.map((c) => (
                <button type="button" key={c.value} className="ced" onClick={() => onPrefill(c.value)}>
                  <b>{c.value}</b>
                  <small>{c.label}</small>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="tp-tabs" role="tablist">
        <button type="button" role="tab" className="tp-tab" aria-selected={tab === 'log'} onClick={() => setTab('log')}>
          Registro <span className="n">{logs.length}</span>
        </button>
        <button type="button" role="tab" className="tp-tab" aria-selected={tab === 'vars'} onClick={() => setTab('vars')}>
          Variables <span className="n">{varKeys.length}</span>
        </button>
        <button type="button" role="tab" className="tp-tab" aria-selected={tab === 'cfg'} onClick={() => setTab('cfg')}>
          Escenario
        </button>
      </div>

      <div
        className="tp-pane"
        ref={paneRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {tab === 'log' &&
          (logs.length ? (
            logs.map((l) => (
              <div key={l.id} className={`tp-le${l.kind === 'warn' ? ' warn' : ''}`}>
                <span className="t">{l.time}</span>
                <span className={`k k-${l.kind}`}>{KIND_LABEL[l.kind]}</span>
                <div className="x">
                  <b>{l.title}</b>
                  {l.intent && (
                    <a href={flow(l.intent)} target="_blank" rel="noopener">
                      canvas ↗
                    </a>
                  )}
                  {l.detail && <small>{l.detail}</small>}
                  {l.api && (
                    <details>
                      <summary>Request y respuesta</summary>
                      <pre>
                        {`${l.api.ref ? l.api.ref + ' · ' : ''}${l.api.name}\n\n${JSON.stringify(l.api.request, null, 2)}\n\n→ ${typeof l.api.response === 'string' ? l.api.response : JSON.stringify(l.api.response, null, 2)}`}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="tp-empty">Escribí “hola” en el chat para empezar.</div>
          ))}

        {tab === 'vars' && (
          <>
            <div className="tp-vg">
              <h3>Sesión · se borran al cerrar</h3>
              {table(session)}
            </div>
            <div className="tp-vg">
              <h3>Contacto · quedan entre sesiones</h3>
              {table(contact)}
            </div>
          </>
        )}

        {tab === 'cfg' && (
          <div className="tp-cfg">
            <div>
              <h3>Condiciones</h3>
              <label className="tg">
                <input type="checkbox" checked={scenario.inHours} onChange={toggle('inHours')} />
                <span className="sw" />
                <span className="tx">
                  <b>Dentro del horario de atención</b>
                  <small>Apagado: las derivaciones muestran el mensaje de fuera de horario.</small>
                </span>
              </label>
              <label className="tg">
                <input type="checkbox" checked={scenario.agentsAvailable} onChange={toggle('agentsAvailable')} />
                <span className="sw" />
                <span className="tx">
                  <b>Hay asesores disponibles</b>
                  <small>Apagado: la conversación queda en cola sin asignar. Al encenderlo se asigna.</small>
                </span>
              </label>
              <label className="tg">
                <input type="checkbox" checked={scenario.endpointsDown} onChange={toggle('endpointsDown')} />
                <span className="sw" />
                <span className="tx">
                  <b>Endpoints caídos</b>
                  <small>Toda llamada da timeout: reintento y después el aviso de error.</small>
                </span>
              </label>
            </div>
            <div>
              <h3>Velocidad del bot</h3>
              <div className="seg" role="group" aria-label="Velocidad">
                {(
                  [
                    ['fast', 'Rápida'],
                    ['real', 'Realista'],
                  ] as const
                ).map(([k, label]) => (
                  <button type="button" key={k} aria-pressed={speed === k} onClick={() => setSpeed(k)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {!!cfg.templates?.length && (
              <div>
                <h3>Plantillas salientes</h3>
                <div className="tp-tpl">
                  {cfg.templates.map((t) => (
                    <button type="button" key={t.id} onClick={() => (engine.sendTemplate(t.id), onClose?.())}>
                      <b>{t.name}</b>
                      <small>
                        <code>{t.id}</code> · {t.category} · {t.buttons.map((b) => b.title).join(', ')}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
