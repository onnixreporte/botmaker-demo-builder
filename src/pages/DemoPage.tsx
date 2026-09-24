import { useState } from 'react';
import type { BotDef } from '../core/types';
import { WhatsAppChat } from '../ui/whatsapp/WhatsAppChat';
import { useClock, useEngine } from '../ui/simulator/useEngine';
import './pages.css';

/**
 * Demo para compartir con el cliente: solo el chat, sin registro técnico.
 * En pantallas grandes muestra una presentación al costado; en el celular, el chat ocupa todo.
 */
export function DemoPage({ bot }: { bot: BotDef }) {
  const cfg = bot.config;
  const { engine, items, receipts, state } = useEngine(bot, 'real');
  const clock = useClock(state.clockOffsetMin);
  const [prefill, setPrefill] = useState<{ value: string; nonce: number }>();
  const [info, setInfo] = useState(false);
  const ids = cfg.demo?.shareIdentities ? cfg.demo.identities ?? [] : [];

  const Tips = () => (
    <>
      {!!cfg.demo?.tips?.length && (
        <ol>
          {cfg.demo.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      )}
      {!!ids.length && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Datos de prueba
          </div>
          <div className="chips">
            {ids.map((c) => (
              <button type="button" key={c.value} className="ced" onClick={() => (setPrefill({ value: c.value, nonce: Date.now() }), setInfo(false))}>
                <b>{c.value}</b>
                <small>{c.label}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="page-demo">
      <div className="mbar">
        <b>{cfg.client} · demo</b>
        <button type="button" className="btn" onClick={() => setInfo(true)}>
          Cómo probar
        </button>
        <button type="button" className="btn" onClick={() => engine.reset()}>
          Reiniciar
        </button>
      </div>

      <section className="intro">
        <div className="intro-brand">
          <span className="av" style={{ background: cfg.profile.color }}>
            {cfg.profile.initials}
          </span>
          <span className="eyebrow">Demo · {cfg.client}</span>
        </div>
        <h1>Probá el asistente de WhatsApp</h1>
        <p>{cfg.description}</p>
        <Tips />
        <div>
          <button type="button" className="btn" onClick={() => engine.reset()}>
            Reiniciar la demo
          </button>
        </div>
        <p className="fine">Es una demo con datos de ejemplo: no envía mensajes reales ni consulta sistemas de {cfg.client}.</p>
      </section>

      <main className="stage">
        <WhatsAppChat
          profile={cfg.profile}
          items={items}
          receipts={receipts}
          typing={state.typing}
          online={state.mode !== 'idle'}
          notice={cfg.demo?.notice}
          gallery={cfg.demo?.gallery}
          clock={clock}
          prefill={prefill}
          onSend={(i) => engine.send(i)}
          menu={[{ label: 'Reiniciar conversación', onSelect: () => engine.reset() }]}
        />
      </main>

      {info && (
        <div className="msheet" onClick={(e) => e.target === e.currentTarget && setInfo(false)}>
          <div role="dialog" aria-label="Cómo probar la demo">
            <h2>Cómo probar la demo</h2>
            <Tips />
            <button type="button" className="btn pri" onClick={() => setInfo(false)}>
              Volver al chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
