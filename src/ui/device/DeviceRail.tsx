import { Icon } from '../shared/icons';
import { CHANNELS, type Appearance, type Theme } from './appearance';

type Update = (patch: Partial<Appearance>) => void;

const THEMES: { id: Theme; label: string; icon: 'sun' | 'moon' }[] = [
  { id: 'light', label: 'Tema claro', icon: 'sun' },
  { id: 'dark', label: 'Tema oscuro', icon: 'moon' },
];

/**
 * Controles de vista a la derecha del teléfono (solo en pantallas grandes).
 * Cada grupo es una opción de apariencia; el de canal aparece cuando haya más de uno.
 */
export function DeviceRail({ appearance, update }: { appearance: Appearance; update: Update }) {
  return (
    <div className="dev-rail" role="toolbar" aria-label="Vista del teléfono">
      {CHANNELS.length > 1 && (
        <div className="grp" role="radiogroup" aria-label="Canal">
          {CHANNELS.map((c) => (
            <button type="button" key={c.id} role="radio" aria-checked={appearance.channel === c.id} title={c.label} onClick={() => update({ channel: c.id })}>
              {c.label.slice(0, 2)}
            </button>
          ))}
        </div>
      )}
      <div className="grp" role="radiogroup" aria-label="Tema">
        {THEMES.map((t) => (
          <button type="button" key={t.id} role="radio" aria-checked={appearance.theme === t.id} aria-label={t.label} title={t.label} onClick={() => update({ theme: t.id })}>
            <Icon name={t.icon} size={20} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Botón único para la barra superior en el celular: alterna claro/oscuro. */
export function ThemeToggle({ appearance, update }: { appearance: Appearance; update: Update }) {
  const dark = appearance.theme === 'dark';
  return (
    <button type="button" className="btn icon" aria-label={dark ? 'Pasar a tema claro' : 'Pasar a tema oscuro'} title={dark ? 'Tema claro' : 'Tema oscuro'} onClick={() => update({ theme: dark ? 'light' : 'dark' })}>
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
