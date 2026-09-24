import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatItem, ReceiptStatus, UserInput } from '../../core/engine';
import type { BotConfig, Row } from '../../core/types';
import { Icon } from '../shared/icons';
import { Avatar } from '../shared/Avatar';
import { DEFAULT_GALLERY, sampleImage, type SampleKind } from '../shared/placeholders';
import { FlowSheet } from './FlowSheet';
import { Message } from './Message';
import './whatsapp.css';

export interface MenuAction {
  label: string;
  onSelect: () => void;
}

export interface WhatsAppChatProps {
  profile: BotConfig['profile'];
  items: ChatItem[];
  receipts: Record<string, ReceiptStatus>;
  typing: boolean;
  /** Hay una sesión activa (muestra "en línea"). */
  online: boolean;
  notice?: string;
  gallery?: { label: string; kind: SampleKind }[];
  onSend: (input: UserInput) => void;
  /** Opciones del menú ⋮ del encabezado. */
  menu?: MenuAction[];
  /** Texto a precargar en el campo de mensaje (cambiar `nonce` para volver a aplicarlo). */
  prefill?: { value: string; nonce: number };
}

type Layer =
  | { type: 'list'; item: Extract<ChatItem, { kind: 'list' }> }
  | { type: 'flow'; item: Extract<ChatItem, { kind: 'flow'; from: 'bot' }> }
  | { type: 'attach' | 'gallery' | 'emoji' | 'menu' }
  | null;

const EMOJIS = ['👍', '🙏', '😊', '😂', '❤️', '👋', '🙌', '🤔', '😅', '🏡', '✅', '💵'];
const ATTACH: { key: string; label: string; color: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { key: 'document', label: 'Documento', color: '#7F66FF', icon: 'doc' },
  { key: 'camera', label: 'Cámara', color: '#FE2E74', icon: 'camera' },
  { key: 'gallery', label: 'Galería', color: '#BF59CF', icon: 'image' },
  { key: 'audio', label: 'Audio', color: '#F96533', icon: 'headset' },
  { key: 'location', label: 'Ubicación', color: '#1FA855', icon: 'pin' },
  { key: 'contact', label: 'Contacto', color: '#009DE2', icon: 'person' },
];

/**
 * Pantalla de chat con el aspecto de WhatsApp. No conoce el motor:
 * recibe los mensajes y avisa lo que envía el cliente con `onSend`.
 */
export function WhatsAppChat({ profile, items, receipts, typing, online, notice, gallery, onSend, menu = [], prefill }: WhatsAppChatProps) {
  const [text, setText] = useState('');
  const [layer, setLayer] = useState<Layer>(null);
  const [picked, setPicked] = useState<Row | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  /** Flows ya enviados: su botón queda deshabilitado, como en WhatsApp. */
  const [flowsDone, setFlowsDone] = useState<Set<string>>(new Set());
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nearBottom = useRef(true);
  const lastCount = useRef(0);

  useEffect(() => {
    if (prefill) {
      setText(prefill.value);
      inputRef.current?.focus();
    }
  }, [prefill]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  useLayoutEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const added = items.length - lastCount.current;
    lastCount.current = items.length;
    if (items.length === 0) {
      setUnread(0);
      return;
    }
    const last = items[items.length - 1];
    if (nearBottom.current || last.from === 'user') {
      el.scrollTop = el.scrollHeight;
      setUnread(0);
    } else if (added > 0) setUnread((u) => u + added);
  }, [items]);

  const onScroll = () => {
    const el = chatRef.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom.current) setUnread(0);
  };

  const send = (input: UserInput) => {
    setLayer(null);
    setPicked(null);
    onSend(input);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (t) {
      setText('');
      send({ text: t });
    } else send({ media: { type: 'audio' } });
  };

  const onAttach = (key: string) => {
    if (key === 'gallery' || key === 'camera') return setLayer({ type: 'gallery' });
    if (key === 'document') return send({ media: { type: 'document', name: 'documento-ejemplo.pdf' } });
    send({ media: { type: key as 'audio' | 'location' | 'contact' } });
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => send({ media: { type: 'image', src: String(rd.result), name: f.name } });
    rd.readAsDataURL(f);
  };

  const samples = (gallery?.length ? gallery : DEFAULT_GALLERY).slice(0, 6).map((g) => ({ ...g, src: sampleImage(g.label, g.kind) }));
  const hasText = text.trim().length > 0;

  return (
    <div className="wa-app">
      <header className="wa-head">
        <button type="button" className="wa-ib" aria-label="Volver" onClick={() => setToast('Este chat es una demo')}>
          <Icon name="back" />
        </button>
        <Avatar profile={profile} className="wa-avatar" />
        <div className="wa-who">
          <b>{profile.name}</b>
          <span className={typing ? 'typing' : ''}>{typing ? 'escribiendo…' : online ? 'en línea' : profile.about ?? 'Cuenta de empresa'}</span>
        </div>
        <button type="button" className="wa-ib" aria-label="Videollamada" onClick={() => setToast('Las llamadas no forman parte de la demo')}>
          <Icon name="video" />
        </button>
        <button type="button" className="wa-ib" aria-label="Llamar" onClick={() => setToast('Las llamadas no forman parte de la demo')}>
          <Icon name="call" />
        </button>
        <button type="button" className="wa-ib" aria-label="Más opciones" aria-haspopup="menu" onClick={() => setLayer({ type: 'menu' })}>
          <Icon name="more" />
        </button>
      </header>

      <div className="wa-chat" ref={chatRef} onScroll={onScroll} aria-live="polite">
        <div className="wa-chip">Hoy</div>
        {notice && <div className="wa-chip note">{notice}</div>}
        {items.map((it, i) => {
          const prev = items[i - 1];
          const side = it.from === 'user' ? 'out' : 'in';
          const first = !prev || (prev.from === 'user' ? 'out' : 'in') !== side;
          return (
            <Message
              key={it.id}
              item={it}
              first={first}
              status={receipts[it.id]}
              accent={profile.color}
              onReply={it.kind === 'buttons' ? (b) => send({ text: b.title, replyTo: { messageId: it.id, choiceId: b.id } }) : undefined}
              onOpenList={it.kind === 'list' ? () => setLayer({ type: 'list', item: it }) : undefined}
              onOpenFlow={it.kind === 'flow' && it.from === 'bot' ? () => setLayer({ type: 'flow', item: it }) : undefined}
              flowDone={flowsDone.has(it.id)}
            />
          );
        })}
      </div>

      {unread > 0 && (
        <button
          type="button"
          className="wa-tobottom"
          aria-label="Ir al último mensaje"
          onClick={() => {
            const el = chatRef.current;
            if (el) el.scrollTop = el.scrollHeight;
            setUnread(0);
          }}
        >
          <Icon name="down" size={26} />
          <span>{unread}</span>
        </button>
      )}

      <form className="wa-composer" onSubmit={submit} autoComplete="off">
        <div className="wa-cbox">
          <button type="button" className="wa-ib" aria-label="Emojis" onClick={() => setLayer({ type: 'emoji' })}>
            <Icon name="emoji" />
          </button>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !text.trim()) e.preventDefault();
            }}
            placeholder="Mensaje"
            aria-label="Escribir un mensaje"
            enterKeyHint="send"
          />
          <button type="button" className="wa-ib" aria-label="Adjuntar" onClick={() => setLayer({ type: 'attach' })}>
            <Icon name="attach" style={{ transform: 'rotate(-45deg)' }} />
          </button>
          <button type="button" className="wa-ib" aria-label="Cámara" onClick={() => setLayer({ type: 'gallery' })}>
            <Icon name="camera" />
          </button>
        </div>
        <button type="submit" className="wa-send" aria-label={hasText ? 'Enviar' : 'Enviar nota de voz'}>
          <Icon name={hasText ? 'send' : 'mic'} />
        </button>
      </form>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))} />

      {layer?.type === 'list' && (
        <div className="wa-scrim" onClick={(e) => e.target === e.currentTarget && setLayer(null)}>
          <div className="wa-sheet" role="dialog" aria-label={layer.item.button}>
            <div className="wa-sh-head">
              <button type="button" className="wa-ib" aria-label="Cerrar" onClick={() => setLayer(null)}>
                <Icon name="close" />
              </button>
              <div className="t">{layer.item.button}</div>
            </div>
            <div className="wa-sh-body">
              {layer.item.section && <div className="wa-sh-sec">{layer.item.section}</div>}
              {layer.item.rows.map((r) => (
                <button type="button" key={r.id} className={`wa-sh-row${picked?.id === r.id ? ' on' : ''}`} onClick={() => setPicked(r)} aria-pressed={picked?.id === r.id}>
                  <span className="tx">
                    <b>{r.title}</b>
                    {r.description && <small>{r.description}</small>}
                  </span>
                  <span className="wa-radio" />
                </button>
              ))}
            </div>
            <div className="wa-sh-foot">
              {picked && (
                <button
                  type="button"
                  className="wa-send"
                  aria-label="Enviar"
                  onClick={() => send({ text: picked.title, subtext: picked.description, replyTo: { messageId: layer.item.id, choiceId: picked.id } })}
                >
                  <Icon name="send" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {layer?.type === 'flow' && (
        <FlowSheet
          item={layer.item}
          business={profile.name}
          onClose={() => setLayer(null)}
          onSubmit={(values) => {
            const id = layer.item.id;
            setFlowsDone((d) => new Set(d).add(id));
            send({ flowReply: { messageId: id, values } });
          }}
        />
      )}

      {layer?.type === 'attach' && (
        <div className="wa-scrim clear" onClick={(e) => e.target === e.currentTarget && setLayer(null)}>
          <div className="wa-pop wa-attach">
            {ATTACH.map((a) => (
              <button type="button" key={a.key} className="wa-att" onClick={() => onAttach(a.key)}>
                <i style={{ background: a.color }}>
                  <Icon name={a.icon} size={26} />
                </i>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {layer?.type === 'gallery' && (
        <div className="wa-scrim" onClick={(e) => e.target === e.currentTarget && setLayer(null)}>
          <div className="wa-sheet" role="dialog" aria-label="Elegí una imagen">
            <div className="wa-sh-head">
              <button type="button" className="wa-ib" aria-label="Cerrar" onClick={() => setLayer(null)}>
                <Icon name="close" />
              </button>
              <div className="t">Elegí una imagen</div>
            </div>
            <div className="wa-gal">
              <div className="grid">
                {samples.map((s) => (
                  <button type="button" key={s.label} aria-label={s.label} onClick={() => send({ media: { type: 'image', src: s.src, name: `${s.label}.jpg` } })}>
                    <img src={s.src} alt="" />
                  </button>
                ))}
              </div>
              <div className="cap">
                {samples.map((s) => (
                  <span key={s.label}>{s.label} · ejemplo</span>
                ))}
              </div>
              <button type="button" className="wa-btn-line" onClick={() => fileRef.current?.click()}>
                Elegir una imagen de tu equipo…
              </button>
            </div>
          </div>
        </div>
      )}

      {layer?.type === 'emoji' && (
        <div className="wa-scrim clear" onClick={(e) => e.target === e.currentTarget && setLayer(null)}>
          <div className="wa-pop wa-emojis">
            <div className="g">
              {EMOJIS.map((e) => (
                <button type="button" key={e} onClick={() => (setText((t) => t + e), inputRef.current?.focus())}>
                  {e}
                </button>
              ))}
            </div>
            <button type="button" className="wa-btn-line" onClick={() => send({ media: { type: 'sticker', emoji: '🥳' } })}>
              Enviar un sticker
            </button>
          </div>
        </div>
      )}

      {layer?.type === 'menu' && (
        <div className="wa-scrim clear" onClick={(e) => e.target === e.currentTarget && setLayer(null)}>
          <div className="wa-pop wa-menu" role="menu">
            {menu.map((m) => (
              <button type="button" role="menuitem" key={m.label} onClick={() => (setLayer(null), m.onSelect())}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {toast && <div className="wa-toast">{toast}</div>}
    </div>
  );
}
