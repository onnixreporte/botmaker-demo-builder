import type { ReactNode } from 'react';
import type { ChatItem } from '../../core/engine';
import type { Issue } from '../../core/lint';
import { WA, chars } from '../../core/limits';
import type { BotDef, Row } from '../../core/types';
import { Icon } from '../shared/icons';
import { Message } from '../whatsapp/Message';
import '../whatsapp/whatsapp.css';
import { targetName, type RNode } from './tree';

const TYPE: Record<RNode['kind'], string> = {
  start: 'Inicio de intención',
  message: 'Mensaje de texto',
  media: 'Enviar archivo',
  ask: 'Pregunta',
  menu: 'Menú',
  option: 'Opción',
  condition: 'Condición',
  action: 'Acción',
  api: 'Acción de código · endpoint',
  goto: 'Ir a intención',
  handoff: 'Derivación a asesor',
  pass: 'Continúa',
  event: 'Evento',
};

const T = '10:00';
const txt = (t: unknown, example?: string) => (typeof t === 'string' ? t : example ?? '(Texto calculado en tiempo de ejecución)');

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="fl-sec">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Rows({ rows, max, maxDesc }: { rows: Row[]; max: number; maxDesc?: number }) {
  return (
    <div className="fl-rows">
      {rows.map((r) => (
        <div className="fl-row" key={r.id}>
          <div>
            <div className="t">{r.title}</div>
            {r.description && <div className="d">{r.description}</div>}
          </div>
          <div className="fl-lims">
            <span className={`fl-lim${chars(r.title) > max ? ' over' : ''}`}>
              {chars(r.title)}/{max}
            </span>
            {r.description && maxDesc && (
              <span className={`fl-lim${chars(r.description) > maxDesc ? ' over' : ''}`}>
                {chars(r.description)}/{maxDesc}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Preview({ items }: { items: ChatItem[] }) {
  return (
    <div className="wa-preview">
      {items.map((it, i) => (
        <Message key={it.id} item={it} first={i === 0 || items[i - 1].from !== it.from} />
      ))}
    </div>
  );
}

export interface DetailPanelProps {
  bot: BotDef;
  node: RNode;
  issues: Issue[];
  refs: { id: string; name: string; count: number }[];
  onOpen: (intentId: string) => void;
  onClose: () => void;
}

export function DetailPanel({ bot, node: n, issues, refs, onOpen, onClose }: DetailPanelProps) {
  const s = n.step;
  const blocks: ReactNode[] = [];
  const kv: [string, string][] = [];
  let preview: ChatItem[] | null = null;
  let rows: ReactNode = null;

  if (n.kind === 'start' && n.intent) {
    if (n.intent.description) blocks.push(<p key="d">{n.intent.description}</p>);
    if (refs.length)
      blocks.push(
        <Section key="refs" title="Se llega desde">
          <div className="fl-refs">
            {refs.map((r) => (
              <button type="button" key={r.id} className="fl-ref" onClick={() => onOpen(r.id)}>
                {r.name}
                {r.count > 1 && <i>×{r.count}</i>}
              </button>
            ))}
          </div>
        </Section>,
      );
  }

  if (s) {
    switch (s.kind) {
      case 'message':
        preview = [{ id: 'p', from: 'bot', kind: 'text', text: txt(s.text, s.example), time: T }];
        if (s.once) kv.push(['Envío', 'Una vez por sesión']);
        break;
      case 'media':
        preview = [{ id: 'p', from: 'bot', kind: 'media', media: s.media, caption: s.caption ? txt(s.caption) : undefined, time: T }];
        break;
      case 'ask':
        preview = [
          { id: 'p', from: 'bot', kind: 'text', text: txt(s.text, s.example), time: T },
          s.expect === 'image' ? { id: 'u', from: 'user', kind: 'media', media: { type: 'image', name: 'foto' }, time: T } : { id: 'u', from: 'user', kind: 'text', text: 'Respuesta del cliente', time: T },
        ];
        kv.push(['Guarda en', s.saveAs]);
        kv.push(['Espera', s.expect === 'image' ? 'Una foto' : 'Texto']);
        if (s.validate) kv.push(['Validación', s.validate.name]);
        if (s.error) kv.push(['Si no es válido', txt(s.error)]);
        if (s.skipIf) kv.push(['Se saltea', 'Si el dato ya está en la sesión (skipIf)']);
        if (s.escape === false) kv.push(['Escape al menú', 'Desactivado']);
        break;
      case 'list':
      case 'buttons':
        if (n.kind === 'menu') {
          const isList = s.kind === 'list';
          const dyn = isList && s.dynamic ? s.dynamic.example : [];
          const all: Row[] = [...dyn, ...(isList ? s.rows : s.buttons).map((c) => ({ id: c.id, title: c.title, description: c.description }))];
          preview = [
            isList
              ? { id: 'p', from: 'bot', kind: 'list', text: txt(s.text, s.example), header: s.header, footer: s.footer, button: s.button, section: s.section, rows: all, time: T }
              : { id: 'p', from: 'bot', kind: 'buttons', text: txt(s.text, s.example), header: s.header, footer: s.footer, buttons: all, time: T },
          ];
          kv.push(['Tipo', isList ? `Lista interactiva (máx. ${WA.listRows} filas, ${WA.rowTitle} caracteres)` : `Botones de respuesta (máx. ${WA.buttons}, ${WA.buttonTitle} caracteres)`]);
          if (isList) kv.push(['Botón de la lista', `${s.button} (${chars(s.button)}/${WA.listButton})`]);
          if (s.saveAs) kv.push(['Guarda en', s.saveAs]);
          if (isList && s.dynamic) kv.push(['Filas dinámicas', `${s.dynamic.label} → ${s.dynamic.saveAs}${s.dynamic.max ? ` · máx. ${s.dynamic.max}` : ''}`]);
          if (s.onFreeText) kv.push(['Texto libre', 'Ejecuta su propia rama (no dispara "No entiende")']);
          if (s.onTimeout) kv.push(['Tiempo límite', `${s.timeoutMin ?? 5} min`]);
          const txtBody = typeof s.text === 'string' ? s.text : null;
          if (txtBody) kv.push(['Cuerpo', `${chars(txtBody)}/${WA.interactiveBody} caracteres`]);
          rows = (
            <Section title={`${isList ? 'Filas' : 'Botones'} · ${all.length} de ${isList ? WA.listRows : WA.buttons}${dyn.length ? ' (con filas de ejemplo)' : ''}`}>
              <Rows rows={all} max={isList ? WA.rowTitle : WA.buttonTitle} maxDesc={isList ? WA.rowDescription : undefined} />
            </Section>
          );
        } else if (n.kind === 'option' && n.dashed && s.kind === 'list' && s.dynamic) {
          kv.push(['Filas', s.dynamic.label]);
          kv.push(['Guarda en', s.dynamic.saveAs]);
          rows = (
            <Section title="Filas de ejemplo">
              <Rows rows={s.dynamic.example} max={WA.rowTitle} maxDesc={WA.rowDescription} />
            </Section>
          );
        }
        break;
      case 'condition':
        kv.push(['Ramas', s.branches.map((b) => b.label).join(' · ') + (s._noElse ? '' : ' · NO CUMPLE NINGUNA')]);
        break;
      case 'api': {
        const ep = bot.endpoints[s.endpoint];
        if (ep) {
          kv.push(['Endpoint', `${ep.ref ? ep.ref + ' · ' : ''}${ep.name}`]);
          kv.push(['Método', `${ep.method ?? 'POST'} ${ep.path ?? ''}`.trim()]);
        } else kv.push(['Endpoint', `⚠ "${s.endpoint}" no está definido`]);
        kv.push(['Parámetros', s.params.toString().replace(/\s+/g, ' ').slice(0, 280)]);
        if (s.saveAs) kv.push(['Guarda en', s.saveAs]);
        if (ep?.codes?.length)
          blocks.push(
            <Section key="codes" title="Respuestas documentadas">
              <table className="fl-codes">
                <tbody>
                  {ep.codes.map(([c, d]) => (
                    <tr key={c}>
                      <td>{c}</td>
                      <td>{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>,
          );
        if (ep?.note) blocks.push(<div key="epn" className="fl-note info"><b>Nota del endpoint</b>{ep.note}</div>);
        break;
      }
      case 'set':
        Object.entries(s.values).forEach(([k, v]) => kv.push([k, typeof v === 'function' ? 'Calculado' : v === null ? '(borrar)' : JSON.stringify(v)]));
        break;
      case 'action':
        if (s.detail) kv.push(['Detalle', s.detail]);
        if (s.run) kv.push(['Tipo', 'Acción de código']);
        break;
      case 'handoff': {
        const q = bot.config.handoff.queues[s.queue];
        kv.push(['Cola', q ? `${q.label}${q.hours ? ' · ' + q.hours : ''}` : `⚠ ${s.queue}`]);
        if (s.topic) kv.push(['Tema', txt(s.topic, 'Calculado')]);
        if (s.topicId != null) kv.push(['topicID', String(s.topicId)]);
        blocks.push(
          <p key="h">
            En horario: establece la cola, etiqueta la conversación, asigna un asesor y apaga el bot. Fuera de horario: ejecuta “Fuera de horario” de los comportamientos globales.
          </p>,
        );
        break;
      }
      case 'close':
        blocks.push(<p key="c">Borra las variables de sesión (quedan {bot.config.contactVars.join(', ') || 'ninguna'}) y ejecuta las acciones de cierre. El próximo mensaje del cliente empieza una sesión nueva.</p>);
        break;
    }
  }

  if (n.kind === 'option' && n.choice && 'title' in n.choice) {
    const c = n.choice;
    const max = n.inButtons ? WA.buttonTitle : WA.rowTitle;
    rows = (
      <Section title={n.inButtons ? 'Botón' : 'Fila de la lista'}>
        <Rows rows={[{ id: c.id, title: c.title, description: c.description }]} max={max} maxDesc={n.inButtons ? undefined : WA.rowDescription} />
      </Section>
    );
    kv.push(['Id', c.id]);
    if (c.match) kv.push(['También elige', c.match.join(', ')]);
    if (c.set) kv.push(['Guarda', Object.entries(c.set).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join('\n')]);
  }

  const goTarget = n.kind === 'goto' && n.target ? n.target : null;
  if (n.kind === 'goto') {
    blocks.push(<p key="g">{n.dynamic ? 'Destino dinámico: depende de dónde estaba el cliente.' : `Salta a la intención “${n.title}”.`}</p>);
  }

  const notes = n.notes;
  const myIssues = issues;

  return (
    <section className="fl-panel" aria-label="Detalle del bloque">
      <div className="fl-ph">
        <div className="fl-pt">
          <span className={`fl-sw ${n.kind}`} />
          {n.kind === 'menu' && s ? (s.kind === 'list' ? 'Menú · lista interactiva' : 'Menú · botones') : TYPE[n.kind]}
        </div>
        <button type="button" className="fl-px" aria-label="Cerrar detalle" onClick={onClose}>
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className="fl-pb">
        <h2>{n.kind === 'pass' ? 'Continúa sin acción' : n.title}</h2>
        {notes.suggested && <span className="fl-tag">Texto sugerido · no viene del documento</span>}
        {goTarget && (
          <button type="button" className="fl-go" onClick={() => onOpen(goTarget)}>
            Abrir “{targetName(bot, goTarget).name}” →
          </button>
        )}
        {blocks}
        {preview && (
          <Section title="Lo que ve el cliente">
            <Preview items={preview} />
          </Section>
        )}
        {rows}
        {kv.length > 0 && (
          <Section title="Configuración">
            <dl className="fl-kv">
              {kv.map(([k, v], i) => (
                <div key={i} style={{ display: 'contents' }}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}
        {myIssues.map((i, k) => (
          <div key={k} className={`fl-note ${i.level === 'error' ? 'err' : 'pending'}`}>
            <b>{i.level === 'error' ? 'Error del linter' : 'Aviso del linter'}</b>
            {i.message}
          </div>
        ))}
        {notes.todo && (
          <div className="fl-note todo">
            <b>Lógica a implementar</b>
            {notes.todo}
          </div>
        )}
        {notes.pending && (
          <div className="fl-note pending">
            <b>Consulta pendiente</b>
            {notes.pending}
          </div>
        )}
        {notes.rec && (
          <div className="fl-note rec">
            <b>Recomendación</b>
            {notes.rec}
          </div>
        )}
        {notes.note && (
          <div className="fl-note info">
            <b>Nota</b>
            {notes.note}
          </div>
        )}
      </div>
    </section>
  );
}
