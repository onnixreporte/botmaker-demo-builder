import type React from 'react';
import { forwardRef } from 'react';
import { Icon, type IconName } from '../shared/icons';
import type { RNode } from './tree';

const ICON: Partial<Record<RNode['kind'], IconName>> = {
  media: 'image',
  ask: 'cursor',
  flow: 'form',
  menu: 'list',
  action: 'bolt',
  api: 'code',
  handoff: 'agent',
  event: 'clock',
};

export interface NodeCardProps {
  n: RNode;
  selected: boolean;
  errors: number;
  style?: React.CSSProperties;
}

/** Un bloque del flujograma con el aspecto de Botmaker. */
export const NodeCard = forwardRef<HTMLDivElement, NodeCardProps>(function NodeCard({ n, selected, errors, style }, ref) {
  const cls = ['nd', `k-${n.kind}`, selected && 'sel', n.dynamic && 'dyn', n.dashed && 'dashed', n.inButtons && 'in-buttons'].filter(Boolean).join(' ');
  const badges = (
    <>
      {(errors > 0 || n.notes.pending || n.notes.todo) && (
        <span className="bdgs">
          {errors > 0 && (
            <span className="bdg-i e" title={`${errors} error(es) del linter`}>
              ✖
            </span>
          )}
          {n.notes.pending && (
            <span className="bdg-i w" title="Consulta pendiente">
              !
            </span>
          )}
          {n.notes.todo && (
            <span className="bdg-i t" title="Lógica a implementar">
              ƒ
            </span>
          )}
        </span>
      )}
    </>
  );
  const common = { ref, className: cls, style: { width: n.w, ...style }, 'data-key': n.key, tabIndex: 0, role: 'button', 'aria-label': `${n.title}${n.sub ? ' · ' + n.sub : ''}` };

  if (n.kind === 'condition')
    return (
      <div {...common}>
        <span className="dia" />
        <span className="tt">{n.title}</span>
        {badges}
      </div>
    );
  if (n.kind === 'goto')
    return (
      <div {...common}>
        <span className="dot" data-dot>
          <Icon name="flow" size={18} />
        </span>
        <span className="tt">{n.title}</span>
        {n.sub && <span className="sb">{n.sub}</span>}
        {badges}
      </div>
    );
  if (n.kind === 'pass') return <div {...common} />;
  if (n.kind === 'start')
    return (
      <div {...common}>
        <span className="tt">{n.title}</span>
        {badges}
      </div>
    );
  if (n.kind === 'option')
    return (
      <div {...common}>
        <span className="bd">
          <span className="tt">{n.title}</span>
          {n.sub && <span className="sb">{n.sub}</span>}
        </span>
        {badges}
      </div>
    );

  const icon = ICON[n.kind];
  return (
    <div {...common}>
      <span className="ic">{n.kind === 'message' ? <b className="ia">A</b> : icon ? <Icon name={icon} size={15} /> : null}</span>
      <span className="bd">
        <span className="tt">{n.title}</span>
        {n.sub && <span className="sb">{n.sub}</span>}
      </span>
      {n.pill && <span className={`pl${n.pillFull ? ' full' : ''}`}>{n.pill}</span>}
      {badges}
    </div>
  );
});
