import { useState } from 'react';
import type { ChatItem } from '../../core/engine';
import { checkFlowValue, isField } from '../../core/flow';
import type { FlowComponent, FlowValues } from '../../core/types';
import { Icon } from '../shared/icons';

type FlowItem = Extract<ChatItem, { kind: 'flow'; from: 'bot' }>;

export interface FlowSheetProps {
  item: FlowItem;
  /** Nombre de la empresa (pie "Gestionado por…"). */
  business: string;
  onClose: () => void;
  onSubmit: (values: FlowValues) => void;
}

/**
 * Formulario de un WhatsApp Flow a pantalla completa: una pantalla por vez,
 * valida obligatorios y tipos al tocar el botón del pie y en la última envía todo junto.
 */
export function FlowSheet({ item, business, onClose, onSubmit }: FlowSheetProps) {
  const [idx, setIdx] = useState(0);
  const [values, setValues] = useState<FlowValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const screen = item.screens[idx];
  const last = idx === item.screens.length - 1;

  const set = (name: string, v: FlowValues[string]) => {
    setValues((x) => ({ ...x, [name]: v }));
    setErrors((e) => {
      const { [name]: _, ...rest } = e;
      return rest;
    });
  };

  const next = () => {
    const errs: Record<string, string> = {};
    for (const c of screen.children) {
      if (!isField(c)) continue;
      const e = checkFlowValue(c, values[c.name]);
      if (e) errs[c.name] = e;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (last) onSubmit(values);
    else setIdx(idx + 1);
  };

  return (
    <div className="wa-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wa-flow" role="dialog" aria-label={screen.title}>
        <div className="wa-flow-head">
          {idx > 0 ? (
            <button type="button" className="wa-ib" aria-label="Pantalla anterior" onClick={() => setIdx(idx - 1)}>
              <Icon name="back" />
            </button>
          ) : (
            <button type="button" className="wa-ib" aria-label="Cerrar" onClick={onClose}>
              <Icon name="close" />
            </button>
          )}
          <div className="t">{screen.title}</div>
          <span className="wa-flow-step" aria-label={`Pantalla ${idx + 1} de ${item.screens.length}`}>
            {item.screens.length > 1 ? `${idx + 1}/${item.screens.length}` : ''}
          </span>
        </div>
        <div className="wa-flow-body" key={screen.id}>
          {screen.children.map((c, i) => (
            <Component key={isField(c) ? c.name : i} c={c} value={isField(c) ? values[c.name] : undefined} error={isField(c) ? errors[c.name] : undefined} onChange={set} />
          ))}
        </div>
        <div className="wa-flow-foot">
          <button type="button" className="wa-flow-btn" onClick={next}>
            {screen.button}
          </button>
          <small>
            Gestionado por {business}. <span className="wa-link">Más información</span>
          </small>
        </div>
      </div>
    </div>
  );
}

function Component({ c, value, error, onChange }: { c: FlowComponent; value?: FlowValues[string]; error?: string; onChange: (name: string, v: FlowValues[string]) => void }) {
  if (!isField(c)) {
    if (c.kind === 'heading') return <h2 className="wa-flow-h">{c.text}</h2>;
    if (c.kind === 'subheading') return <h3 className="wa-flow-sh">{c.text}</h3>;
    return <p className="wa-flow-p">{c.text}</p>;
  }
  const id = `flow-${c.name}`;
  const label = `${c.label}${c.required ? '' : ' (opcional)'}`;
  const foot = (error || c.helper) && <div className={`wa-flow-help${error ? ' err' : ''}`}>{error ?? c.helper}</div>;
  const str = typeof value === 'string' ? value : '';

  switch (c.kind) {
    case 'text':
    case 'textarea':
    case 'date':
    case 'dropdown': {
      const input = c.kind === 'text' ? c.input : undefined;
      return (
        <div className={`wa-flow-field${error ? ' err' : ''}`}>
          <label htmlFor={id}>{label}</label>
          {c.kind === 'textarea' ? (
            <textarea id={id} rows={3} value={str} onChange={(e) => onChange(c.name, e.target.value)} />
          ) : c.kind === 'dropdown' ? (
            <select id={id} value={str} onChange={(e) => onChange(c.name, e.target.value)}>
              <option value="" disabled>
                Seleccionar
              </option>
              {c.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={id}
              type={c.kind === 'date' ? 'date' : input === 'email' ? 'email' : input === 'phone' ? 'tel' : 'text'}
              inputMode={input === 'number' ? 'decimal' : undefined}
              value={str}
              onChange={(e) => onChange(c.name, e.target.value)}
            />
          )}
          {foot}
        </div>
      );
    }
    case 'radio':
    case 'checkbox': {
      const multi = c.kind === 'checkbox';
      const picked = multi ? (Array.isArray(value) ? value : []) : [str];
      return (
        <fieldset className={`wa-flow-group${error ? ' err' : ''}`}>
          <legend>{label}</legend>
          {c.options.map((o) => {
            const on = picked.includes(o.id);
            return (
              <label key={o.id} className="wa-flow-opt">
                <span className="tx">
                  <b>{o.title}</b>
                  {o.description && <small>{o.description}</small>}
                </span>
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name={c.name}
                  checked={on}
                  onChange={() => onChange(c.name, multi ? (on ? picked.filter((x) => x !== o.id) : [...picked, o.id]) : o.id)}
                />
              </label>
            );
          })}
          {foot}
        </fieldset>
      );
    }
    case 'optin':
      return (
        <div className={`wa-flow-optin${error ? ' err' : ''}`}>
          <label>
            <input type="checkbox" checked={value === true} onChange={(e) => onChange(c.name, e.target.checked)} />
            <span>{label}</span>
          </label>
          {foot}
        </div>
      );
  }
}
