import { useState } from 'react';
import type { BotDef } from '../core/types';
import { Device } from '../ui/device/Device';
import { ThemeToggle } from '../ui/device/DeviceRail';
import { useAppearance } from '../ui/device/appearance';
import { TestPanel, statusOf } from '../ui/simulator/TestPanel';
import { useClock, useEngine } from '../ui/simulator/useEngine';
import { href } from '../ui/shared/router';
import './pages.css';

/** Demo con panel de prueba: registro de intenciones, endpoints, variables y escenarios. */
export function TestPage({ bot }: { bot: BotDef }) {
  const cfg = bot.config;
  const { engine, items, receipts, logs, state, speed, setSpeed } = useEngine(bot, 'fast');
  const clock = useClock(state.clockOffsetMin);
  const [prefill, setPrefill] = useState<{ value: string; nonce: number }>();
  const [panelOpen, setPanelOpen] = useState(false);
  const { appearance, update } = useAppearance();
  const st = statusOf(state, cfg);

  return (
    <div className="page-test">
      <div className="mbar">
        <b>{cfg.name}</b>
        <span className={`pill ${st.cls}`}>
          <i />
          {st.short}
        </span>
        <ThemeToggle appearance={appearance} update={update} />
        <button type="button" className="btn" onClick={() => setPanelOpen(true)}>
          Panel
        </button>
      </div>
      <main className="stage">
        <Device
          appearance={appearance}
          update={update}
          clock={clock}
          chat={{
            profile: cfg.profile,
            items,
            receipts,
            typing: state.typing,
            online: state.mode !== 'idle',
            notice: cfg.demo?.notice,
            gallery: cfg.demo?.gallery,
            prefill,
            onSend: (i) => engine.send(i),
            menu: [
              { label: 'Reiniciar conversación', onSelect: () => engine.reset() },
              { label: 'Panel de prueba', onSelect: () => setPanelOpen(true) },
              { label: 'Ver el flujograma', onSelect: () => window.open(href(`/${cfg.id}/flujo`), '_blank', 'noopener') },
            ],
          }}
        />
      </main>
      <TestPanel
        engine={engine}
        state={state}
        logs={logs}
        speed={speed}
        setSpeed={setSpeed}
        mobileOpen={panelOpen}
        onPrefill={(v) => (setPrefill({ value: v, nonce: Date.now() }), setPanelOpen(false))}
        onClose={() => setPanelOpen(false)}
      />
    </div>
  );
}
