import { WhatsAppChat, type WhatsAppChatProps } from '../whatsapp/WhatsAppChat';
import type { Appearance } from './appearance';
import { DeviceRail } from './DeviceRail';
import { PhoneFrame } from './PhoneFrame';

/**
 * Lo que necesita cualquier interfaz de chat. Hoy es la de WhatsApp; los próximos
 * canales (Instagram, Messenger) reciben las mismas props.
 */
export type ChatProps = WhatsAppChatProps;

/** Teléfono con el chat del canal elegido y, al costado, los controles de vista. */
export function Device({ appearance, update, clock, chat }: { appearance: Appearance; update: (p: Partial<Appearance>) => void; clock?: string; chat: ChatProps }) {
  return (
    <div className="dev-wrap">
      <PhoneFrame appearance={appearance} clock={clock}>
        <WhatsAppChat {...chat} />
      </PhoneFrame>
      <DeviceRail appearance={appearance} update={update} />
    </div>
  );
}
