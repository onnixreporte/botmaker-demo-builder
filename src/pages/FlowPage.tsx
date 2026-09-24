import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { childSteps } from '../core/dsl';
import { lintBot, type Issue } from '../core/lint';
import { SYSTEM_GROUP, TEMPLATE_GROUP, systemIntents } from '../core/system';
import type { BotDef, Intent, Step, Target } from '../core/types';
import { NodeCard } from '../ui/canvas/NodeCard';
import { DetailPanel } from '../ui/canvas/DetailPanel';
import { buildTree, layout, walk, type Layout, type RNode } from '../ui/canvas/tree';
import { Icon } from '../ui/shared/icons';
import { href, onLink } from '../ui/shared/router';
import '../ui/canvas/canvas.css';

/** Referencias entrantes: quién salta a cada intención. */
function computeRefs(bot: BotDef, all: Intent[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  const resolve = (t: Target) => (t === '@entry' ? bot.config.entry : t === '@close' ? bot.config.closeIntent : t.startsWith('@') ? null : t);
  const add = (t: Target | undefined, from: string) => {
    if (!t) return;
    const id = resolve(t);
    if (!id || id === from) return;
    const m = out.get(id) ?? new Map<string, number>();
    m.set(from, (m.get(from) ?? 0) + 1);
    out.set(id, m);
  };
  const visit = (steps: Step[] | undefined, from: string) =>
    steps?.forEach((s) => {
      if (s.kind === 'goto') add(s.target, from);
      if (s.kind === 'list') s.rows.forEach((r) => add(r.goto, from));
      if (s.kind === 'buttons') s.buttons.forEach((b) => add(b.goto, from));
      if (s.kind === 'condition' || s.kind === 'api') {
        (s.branches ?? []).forEach((b) => add(b.goto, from));
        add(s.otherwiseGoto, from);
      }
      childSteps(s).forEach((c) => visit(c, from));
    });
  all.forEach((it) => visit(it.steps, it.id));
  return out;
}

const countNodes = (bot: BotDef, it: Intent) => {
  let n = 0;
  walk(buildTree(bot, it), (x) => x.kind !== 'pass' && x.kind !== 'start' && n++);
  return n;
};

export function FlowPage({ bot, initialIntent }: { bot: BotDef; initialIntent?: string }) {
  const cfg = bot.config;
  const sys = useMemo(() => systemIntents(bot), [bot]);
  const all = useMemo(() => [...bot.intents, ...sys], [bot, sys]);
  const issues = useMemo(() => lintBot(bot), [bot]);
  const refs = useMemo(() => computeRefs(bot, all), [bot, all]);
  const counts = useMemo(() => new Map(all.map((it) => [it.id, countNodes(bot, it)])), [bot, all]);
  const groups = useMemo(() => {
    const order = [...cfg.groups, ...all.map((i) => i.group).filter((g) => !cfg.groups.includes(g) && g !== TEMPLATE_GROUP && g !== SYSTEM_GROUP), TEMPLATE_GROUP, SYSTEM_GROUP];
    return [...new Set(order)].map((g) => ({ g, items: all.filter((i) => i.group === g) })).filter((x) => x.items.length);
  }, [all, cfg.groups]);

  const [intentId, setIntentId] = useState(() => (initialIntent && all.some((i) => i.id === initialIntent) ? initialIntent : cfg.entry));
  const [history, setHistory] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const intent = all.find((i) => i.id === intentId) ?? all[0];

  const tree = useMemo(() => buildTree(bot, intent), [bot, intent]);
  const nodes = useMemo(() => {
    const a: RNode[] = [];
    walk(tree, (n) => a.push(n));
    return a;
  }, [tree]);
  const [lay, setLay] = useState<Layout | null>(null);
  const [fontsReady, setFontsReady] = useState(0);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const vpRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const view = useRef({ s: 1, tx: 0, ty: 0 });
  const [zoom, setZoom] = useState(100);

  const open = useCallback(
    (id: string, fromBack = false) => {
      if (!all.some((i) => i.id === id)) return;
      if (!fromBack && id !== intentId) setHistory((h) => [...h, intentId]);
      setIntentId(id);
      setSelected(null);
      setSideOpen(false);
      setIssuesOpen(false);
    },
    [all, intentId],
  );

  // si cambia el #hash desde afuera (link o barra de direcciones), abrir esa intención
  useEffect(() => {
    if (initialIntent && initialIntent !== intentId && all.some((i) => i.id === initialIntent)) open(initialIntent);
  }, [initialIntent]);

  useEffect(() => {
    try {
      window.history.replaceState(null, '', href(`/${cfg.id}/flujo#${intentId}`));
    } catch {
      /* el entorno no permite cambiar la URL */
    }
  }, [cfg.id, intentId]);

  useEffect(() => {
    document.fonts?.ready.then(() => setFontsReady((n) => n + 1));
  }, []);

  /* ---------- medir y ubicar ---------- */
  useLayoutEffect(() => {
    setLay(null);
  }, [tree, fontsReady]);

  const apply = useCallback(() => {
    const w = worldRef.current;
    const vp = vpRef.current;
    const v = view.current;
    if (w) w.style.transform = `translate(${v.tx}px,${v.ty}px) scale(${v.s})`;
    if (vp) {
      vp.style.backgroundSize = `${22 * v.s}px ${22 * v.s}px`;
      vp.style.backgroundPosition = `${v.tx}px ${v.ty}px`;
    }
    setZoom(Math.round(v.s * 100));
  }, []);

  const fit = useCallback(
    (l: Layout | null = lay) => {
      const vp = vpRef.current;
      if (!vp || !l) return;
      const r = vp.getBoundingClientRect();
      const headH = headRef.current?.getBoundingClientRect().height ?? 60;
      const top = Math.min(headH + 22, 160);
      const sW = (r.width - 32) / l.width;
      const sH = (r.height - top - 16) / l.height;
      const s = Math.max(0.4, Math.min(1, sW, Math.max(sH, 0.72)));
      view.current = { s, tx: (r.width - l.width * s) / 2, ty: top - 70 * s * 0.6 };
      apply();
    },
    [lay, apply],
  );

  useLayoutEffect(() => {
    if (lay) return;
    const heights = new Map<string, number>();
    nodeRefs.current.forEach((el, key) => heights.set(key, el.offsetHeight));
    const l = layout(tree, heights);
    setLay(l);
    fit(l);
    // fit depende de lay; acá se le pasa el layout nuevo explícitamente
  }, [lay, tree, fit]);

  /* ---------- pan y zoom ---------- */
  const zoomAt = useCallback(
    (cx: number, cy: number, f: number) => {
      const vp = vpRef.current;
      if (!vp) return;
      const r = vp.getBoundingClientRect();
      const x = cx - r.left;
      const y = cy - r.top;
      const v = view.current;
      const ns = Math.max(0.2, Math.min(2.4, v.s * f));
      const k = ns / v.s;
      view.current = { s: ns, tx: x - (x - v.tx) * k, ty: y - (y - v.ty) * k };
      apply();
    },
    [apply],
  );

  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const mouse = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY));
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      else if (mouse) zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
      else {
        view.current = { ...view.current, tx: view.current.tx - e.deltaX, ty: view.current.ty - e.deltaY };
        apply();
      }
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [zoomAt, apply]);

  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ sx: number; sy: number; tx: number; ty: number; moved: boolean; target: EventTarget | null } | null>(null);
  const pinch = useRef<{ d: number; s: number; mx: number; my: number; tx: number; ty: number } | null>(null);

  const tap = (target: EventTarget | null) => {
    const el = (target as HTMLElement | null)?.closest?.('.nd') as HTMLElement | null;
    if (!el) return setSelected(null);
    const n = nodes.find((x) => x.key === el.dataset.key);
    if (!n) return;
    if (n.kind === 'goto' && n.target && !n.dynamic && (target as HTMLElement).closest('[data-dot]')) return open(n.target);
    setSelected(n.key);
    setIssuesOpen(false);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* sin captura */
    }
    if (ptrs.current.size === 1) drag.current = { sx: e.clientX, sy: e.clientY, tx: view.current.tx, ty: view.current.ty, moved: false, target: e.target };
    else if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: view.current.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, tx: view.current.tx, ty: view.current.ty };
      drag.current = null;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pinch.current;
    if (p && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()];
      const r = vpRef.current!.getBoundingClientRect();
      const ns = Math.max(0.2, Math.min(2.4, (p.s * Math.hypot(a.x - b.x, a.y - b.y)) / p.d));
      const k = ns / p.s;
      const mx = (a.x + b.x) / 2 - r.left;
      const my = (a.y + b.y) / 2 - r.top;
      view.current = { s: ns, tx: mx - (p.mx - r.left - p.tx) * k, ty: my - (p.my - r.top - p.ty) * k };
      apply();
      return;
    }
    const d = drag.current;
    if (d) {
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) > 4) {
        d.moved = true;
        vpRef.current?.classList.add('grabbing');
      }
      if (d.moved) {
        view.current = { ...view.current, tx: d.tx + dx, ty: d.ty + dy };
        apply();
      }
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.delete(e.pointerId);
    if (drag.current && !drag.current.moved && e.type === 'pointerup') tap(drag.current.target);
    if (ptrs.current.size < 2) pinch.current = null;
    if (!ptrs.current.size) {
      drag.current = null;
      vpRef.current?.classList.remove('grabbing');
    }
  };

  const centerZoom = (f: number) => {
    const r = vpRef.current?.getBoundingClientRect();
    if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, f);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelected(null);
        setSideOpen(false);
        setIssuesOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------- datos para la vista ---------- */
  const sel = nodes.find((n) => n.key === selected) ?? null;
  const issuesFor = (n: RNode) => issues.filter((i) => i.stepId && (i.stepId === n.key || (n.choice && i.stepId === n.choice._id)));
  const intentIssues = (id: string) => issues.filter((i) => i.where === id);
  const refsOf = (id: string) =>
    [...(refs.get(id) ?? new Map<string, number>()).entries()].map(([from, count]) => ({ id: from, name: all.find((i) => i.id === from)?.name ?? from, count }));
  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level === 'warn');
  const eps = new Set<string>();
  bot.intents.forEach((it) => {
    const visit = (steps?: Step[]) => steps?.forEach((s) => (s.kind === 'api' && eps.add(s.endpoint), childSteps(s).forEach(visit)));
    visit(it.steps);
  });
  const groupName = intent.group;

  return (
    <div className="fl">
      <header className="fl-top">
        <button type="button" className="btn fl-menu-btn" onClick={() => setSideOpen(true)}>
          <Icon name="menu" size={18} /> Intenciones
        </button>
        <div className="fl-brand">
          <b>{cfg.name}</b>
          <span>Flujograma · {cfg.client}</span>
        </div>
        <div className="fl-stats">
          <span className="fl-stat">{bot.intents.length} intenciones</span>
          <span className="fl-stat">{[...counts.entries()].filter(([k]) => !k.startsWith('sys:')).reduce((a, [, v]) => a + v, 0)} bloques</span>
          <span className="fl-stat">{eps.size} endpoints</span>
          <button type="button" className={`fl-stat${errors.length ? ' err' : ''}`} onClick={() => (setIssuesOpen(true), setSelected(null))}>
            {errors.length} errores
          </button>
          <button type="button" className={`fl-stat${warns.length ? ' warn' : ''}`} onClick={() => (setIssuesOpen(true), setSelected(null))}>
            {warns.length} avisos
          </button>
        </div>
        <div className="fl-spacer" />
        <nav className="topnav" aria-label="Vistas">
          <a href={href(`/${cfg.id}`)} onClick={(e) => onLink(e, `/${cfg.id}`)}>
            Demo cliente
          </a>
          <a href={href(`/${cfg.id}/prueba`)} onClick={(e) => onLink(e, `/${cfg.id}/prueba`)}>
            Prueba
          </a>
          <a href={href(`/${cfg.id}/flujo`)} aria-current="page">
            Flujo
          </a>
        </nav>
        <div className="fl-zoom" role="group" aria-label="Zoom">
          <button type="button" aria-label="Alejar" onClick={() => centerZoom(1 / 1.2)}>
            −
          </button>
          <button type="button" className="zv" aria-label="Zoom al 100%" onClick={() => centerZoom(1 / view.current.s)}>
            {zoom}%
          </button>
          <button type="button" aria-label="Acercar" onClick={() => centerZoom(1.2)}>
            +
          </button>
          <button type="button" style={{ borderLeft: '1px solid var(--line)' }} onClick={() => fit()}>
            Ajustar
          </button>
        </div>
      </header>

      <aside className="fl-side" data-open={sideOpen} aria-label="Intenciones">
        {groups.map(({ g, items }) => (
          <div key={g}>
            <h4>{g}</h4>
            {items.map((it) => {
              const iss = intentIssues(it.id);
              const hasErr = iss.some((i) => i.level === 'error');
              let pend = false;
              walk(buildTree(bot, it), (n) => (pend = pend || !!n.notes.pending));
              return (
                <button type="button" key={it.id} className="fl-sv" aria-current={it.id === intentId} onClick={() => open(it.id)}>
                  <span className="nm">{it.name}</span>
                  {(hasErr || pend) && <span className="dot" style={{ background: hasErr ? 'var(--err)' : 'var(--warn)' }} title={hasErr ? 'Tiene errores' : 'Tiene consultas pendientes'} />}
                  <span className="ct">{counts.get(it.id)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </aside>
      <div className="fl-scrim" data-open={sideOpen} onClick={() => setSideOpen(false)} />

      <main className="fl-stage">
        <div className="fl-vp" ref={vpRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <div
            className={`fl-world${lay ? '' : ' measuring'}`}
            ref={worldRef}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              const el = (e.target as HTMLElement).closest('.nd') as HTMLElement | null;
              const n = el && nodes.find((x) => x.key === el.dataset.key);
              if (!n) return;
              e.preventDefault();
              if (n.kind === 'goto' && n.target && !n.dynamic) open(n.target);
              else setSelected(n.key);
            }}
          >
            {lay && (
              <svg className="fl-edges" width={lay.width} height={lay.height} viewBox={`0 0 ${lay.width} ${lay.height}`}>
                <defs>
                  <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0 0 L10 5 L0 10 z" fill="#A7B1BF" />
                  </marker>
                </defs>
                {lay.edges.map((e, i) => (
                  <path key={i} d={e.d} className={e.dashed ? 'dash' : undefined} markerEnd="url(#ah)" />
                ))}
              </svg>
            )}
            {nodes.map((n) => (
              <NodeCard
                key={n.key}
                n={n}
                selected={n.key === selected}
                errors={issuesFor(n).filter((i) => i.level === 'error').length}
                ref={(el) => {
                  if (el) nodeRefs.current.set(n.key, el);
                  else nodeRefs.current.delete(n.key);
                }}
                style={lay ? { left: n.x, top: n.y } : { left: 0, top: 0 }}
              />
            ))}
            {lay?.labels.map((l, i) => (
              <span key={i} className={`fl-el ${l.tone}`} style={{ left: l.x, top: l.y }}>
                {l.text}
              </span>
            ))}
          </div>
        </div>

        <div className="fl-head" ref={headRef}>
          <button type="button" className="fl-back" aria-label="Volver a la intención anterior" disabled={!history.length} onClick={() => (open(history[history.length - 1], true), setHistory((h) => h.slice(0, -1)))}>
            <Icon name="back" size={18} />
          </button>
          <div>
            <div className="g">{groupName}</div>
            <div className="n">{intent.name}</div>
            {intent.description && <div className="d">{intent.description}</div>}
          </div>
        </div>

        <details className="fl-legend">
          <summary>Leyenda</summary>
          <div className="fl-lg">
            <span><i className="fl-sw start" />Inicio</span>
            <span><i className="fl-sw message" />Mensaje / archivo</span>
            <span><i className="fl-sw ask" />Pregunta</span>
            <span><i className="fl-sw flow" />WhatsApp Flow</span>
            <span><i className="fl-sw condition" />Condición</span>
            <span><i className="fl-sw action" />Acción / endpoint</span>
            <span><i className="fl-sw menu" />Menú y opciones</span>
            <span><i className="fl-sw goto" />Ir a intención</span>
            <span><i className="fl-sw event" />Evento / continúa</span>
            <span><i className="bdg-i w">!</i>Consulta pendiente</span>
            <span><i className="bdg-i t">ƒ</i>Lógica a implementar</span>
          </div>
          <div className="fl-hint">
            Arrastrá para mover · rueda o pellizco para zoom.
            <br />
            Tocá un bloque para ver el detalle y el círculo rojo para entrar a esa intención.
          </div>
        </details>

        {sel && <DetailPanel bot={bot} node={sel} issues={issuesFor(sel)} refs={sel.kind === 'start' ? refsOf(intent.id) : []} onOpen={(id) => open(id)} onClose={() => setSelected(null)} />}

        {issuesOpen && (
          <section className="fl-panel" aria-label="Revisión del linter">
            <div className="fl-ph">
              <div className="fl-pt">Revisión del flujo</div>
              <button type="button" className="fl-px" aria-label="Cerrar" onClick={() => setIssuesOpen(false)}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="fl-pb">
              <p>
                {errors.length} errores y {warns.length} avisos contra los límites de WhatsApp y la coherencia del flujo. Los errores harían fallar el bot en producción.
              </p>
              <div>
                {[...errors, ...warns].map((i: Issue, k) => (
                  <button
                    type="button"
                    key={k}
                    className="fl-issue"
                    onClick={() => {
                      const target = all.find((x) => x.id === i.where) ? i.where : null;
                      if (target) {
                        open(target);
                        if (i.stepId) setTimeout(() => setSelected(i.stepId!), 0);
                      }
                    }}
                  >
                    <span className={`bdg-i ${i.level === 'error' ? 'e' : 'w'}`}>{i.level === 'error' ? '✖' : '!'}</span>
                    <span>
                      <span className="w">{i.where}</span> · {i.message}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
