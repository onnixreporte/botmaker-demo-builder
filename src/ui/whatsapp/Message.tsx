import type { ReactNode } from 'react';
import type { ChatItem, ReceiptStatus, UserMedia } from '../../core/engine';
import type { MediaSpec } from '../../core/types';
import { waHtml } from '../../core/text';
import { Icon } from '../shared/icons';
import { MAP_IMAGE, infoImage, videoThumb } from '../shared/placeholders';

type Reply = (choice: { id: string; title: string; description?: string }) => void;

export interface MessageProps {
  item: ChatItem;
  /** Primer mensaje de un grupo del mismo lado: lleva "colita". */
  first: boolean;
  status?: ReceiptStatus;
  onReply?: Reply;
  onOpenList?: () => void;
  /** Color de marca para placeholders. */
  accent?: string;
}

const Text = ({ text }: { text: string }) => <span dangerouslySetInnerHTML={{ __html: waHtml(text) }} />;

function Meta({ time, out, status, overlay }: { time: string; out: boolean; status?: ReceiptStatus; overlay?: boolean }) {
  return (
    <span className={`wa-meta${overlay ? ' ov' : ''}`}>
      {time}
      {out && (
        <span className={`wa-tk${status === 'read' ? ' read' : ''}`} aria-label={status === 'read' ? 'Leído' : status === 'delivered' ? 'Entregado' : 'Enviado'}>
          <Icon name={status === 'sent' ? 'tick' : 'ticks'} size={16} />
        </span>
      )}
    </span>
  );
}

/** Contenido visual de un archivo (del bot o del cliente). */
export function MediaBlock({ media, accent }: { media: MediaSpec | UserMedia; accent?: string }) {
  const m = media as { type: string; src?: string; name?: string; meta?: string; duration?: string; emoji?: string; placeholder?: { title: string; subtitle?: string } };
  switch (m.type) {
    case 'image': {
      const src = m.src ?? infoImage(m.placeholder?.title ?? m.name ?? 'Imagen', m.placeholder?.subtitle, accent);
      return (
        <div className="wa-bmed">
          <img src={src} alt={m.name ?? m.placeholder?.title ?? 'Imagen'} />
        </div>
      );
    }
    case 'video': {
      const src = m.src ?? videoThumb(m.placeholder?.title ?? m.name ?? 'Video', accent);
      return (
        <div className="wa-bmed">
          <img src={src} alt={m.name ?? 'Video'} />
          <span className="wa-play">
            <Icon name="play" size={30} />
          </span>
          <span className="wa-dur">{m.duration ?? '0:42'}</span>
        </div>
      );
    }
    case 'document':
      return (
        <div className="wa-doc">
          <span className="ico">PDF</span>
          <span className="tx">
            <b>{m.name ?? 'documento.pdf'}</b>
            <small>{m.meta ?? 'PDF'}</small>
          </span>
        </div>
      );
    case 'audio': {
      const bars = Array.from({ length: 34 }, (_, i) => 6 + Math.round(Math.abs(Math.sin(i * 1.7 + 3)) * 18));
      return (
        <>
          <div className="wa-voice">
            <span className="av">
              <span>
                <Icon name="mic" size={20} />
              </span>
            </span>
            <span className="pl">
              <Icon name="play" size={30} />
            </span>
            <span className="wa-wave">
              {bars.map((h, i) => (
                <i key={i} style={{ height: h }} />
              ))}
            </span>
          </div>
          <div className="wa-vdur">{m.duration ?? '0:07'}</div>
        </>
      );
    }
    case 'location':
      return (
        <div className="wa-loc">
          <img src={MAP_IMAGE} alt="Mapa de ejemplo" />
          <div>Ubicación compartida</div>
        </div>
      );
    case 'contact':
      return (
        <>
          <div className="wa-ctc">
            <span className="av">
              <Icon name="person" size={26} />
            </span>
            <b>{m.name ?? 'Contacto de ejemplo'}</b>
          </div>
          <div className="wa-ctc-act">Enviar mensaje</div>
        </>
      );
  }
  return null;
}

/** Un mensaje de la conversación, con el aspecto de WhatsApp. */
export function Message({ item, first, status, onReply, onOpenList, accent }: MessageProps) {
  const out = item.from === 'user';
  const cls = `wa-m ${out ? 'out' : 'in'}${first ? ' first' : ''}`;

  if (item.from === 'user' && item.kind === 'media' && item.media.type === 'sticker') {
    return (
      <div className={`${cls} bare`}>
        <div className="wa-wm">
          <div className="wa-stk">{item.media.emoji ?? '🙂'}</div>
          <span className="wa-stk-meta">
            {item.time}
            <span className={`wa-tk${status === 'read' ? ' read' : ''}`}>
              <Icon name="ticks" size={16} />
            </span>
          </span>
        </div>
      </div>
    );
  }

  let inner: ReactNode;
  switch (item.kind) {
    case 'text':
      inner = (
        <div className="wa-b">
          <div className="wa-bt">
            <Text text={item.text} />
            {item.from === 'user' && item.subtext && (
              <>
                {'\n'}
                <span className="wa-sub-reply">{item.subtext}</span>
              </>
            )}
            <Meta time={item.time} out={out} status={status} />
          </div>
        </div>
      );
      break;
    case 'media': {
      const media = item.media;
      const caption = item.from === 'bot' ? item.caption : undefined;
      const overlay = !caption && (media.type === 'image' || media.type === 'video');
      inner = (
        <div className={`wa-b${overlay ? ' onlymedia' : ''}`}>
          <MediaBlock media={media} accent={accent} />
          {caption ? (
            <div className="wa-bt">
              <Text text={caption} />
              <Meta time={item.time} out={out} status={status} />
            </div>
          ) : overlay ? (
            <Meta time={item.time} out={out} status={status} overlay />
          ) : (
            <div className="wa-bt" style={{ paddingTop: 0 }}>
              <Meta time={item.time} out={out} status={status} />
            </div>
          )}
        </div>
      );
      break;
    }
    case 'list':
      inner = (
        <div className="wa-b">
          <div className="wa-bt">
            {item.header && <div className="wa-bh">{item.header}</div>}
            <Text text={item.text} />
            {item.footer && <div className="wa-bf">{item.footer}</div>}
            <Meta time={item.time} out={false} />
          </div>
          <button type="button" className="wa-ia-btn" onClick={onOpenList} disabled={!onOpenList}>
            <Icon name="list" size={19} />
            <span>{item.button}</span>
          </button>
        </div>
      );
      break;
    case 'buttons':
      inner = (
        <div className="wa-b">
          {item.header && <MediaBlock media={item.header} accent={accent} />}
          <div className="wa-bt">
            <Text text={item.text} />
            {item.footer && <div className="wa-bf">{item.footer}</div>}
            <Meta time={item.time} out={false} />
          </div>
          {item.buttons.map((b) => (
            <button type="button" key={b.id} className="wa-rb" onClick={() => onReply?.(b)} disabled={!onReply}>
              <Icon name="reply" size={17} />
              <span>{b.title}</span>
            </button>
          ))}
        </div>
      );
      break;
  }

  return (
    <div className={cls}>
      <div className="wa-wm">{inner}</div>
    </div>
  );
}
