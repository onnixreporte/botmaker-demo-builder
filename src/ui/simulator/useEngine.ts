import { useEffect, useMemo, useState } from 'react';
import { Engine, type ChatItem, type EngineState, type LogEntry, type ReceiptStatus } from '../../core/engine';
import type { BotDef } from '../../core/types';

export type Speed = 'fast' | 'real' | 'instant';

/** Conecta el motor con React: mensajes, confirmaciones de lectura, registro y estado. */
export function useEngine(bot: BotDef, initialSpeed: Speed = 'real') {
  const engine = useMemo(() => {
    const e = new Engine(bot);
    e.setSpeed(initialSpeed);
    return e;
  }, [bot]); // la velocidad inicial solo importa al crear el motor
  const [items, setItems] = useState<ChatItem[]>([]);
  const [receipts, setReceipts] = useState<Record<string, ReceiptStatus>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [state, setState] = useState<EngineState>(() => ({ ...engine.state }));
  const [speed, setSpeedState] = useState<Speed>(initialSpeed);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const off = engine.subscribe((e) => {
      switch (e.type) {
        case 'chat':
          setItems((prev) => [...prev, e.item]);
          if (e.item.from === 'user') setReceipts((r) => ({ ...r, [e.item.id]: 'sent' }));
          break;
        case 'receipt':
          // pequeña demora para que se vea el cambio de ✓ a ✓✓ azul
          timers.push(setTimeout(() => setReceipts((r) => ({ ...r, [e.id]: e.status })), 280));
          break;
        case 'log':
          setLogs((prev) => (prev.length > 600 ? [...prev.slice(-500), e.entry] : [...prev, e.entry]));
          break;
        case 'state':
          setState(e.state);
          if (e.state.mode === 'agent' && e.state.agentSpoke) setReceipts((r) => Object.fromEntries(Object.entries(r).map(([k]) => [k, 'read' as const])));
          break;
        case 'reset':
          setItems([]);
          setReceipts({});
          setLogs([]);
          break;
      }
    });
    return () => {
      off();
      timers.forEach(clearTimeout);
    };
  }, [engine]);

  // al salir de la página, cortar cualquier ejecución pendiente
  useEffect(() => () => engine.reset(), [engine]);

  const setSpeed = (s: Speed) => {
    engine.setSpeed(s);
    setSpeedState(s);
  };

  return { engine, items, receipts, logs, state, speed, setSpeed };
}

/** Hora de la barra de estado, con el reloj simulado del motor. */
export function useClock(offsetMin: number): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  const d = new Date(now + offsetMin * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
