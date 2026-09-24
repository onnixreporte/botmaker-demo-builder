import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/**
 * Interfaz de mensajería que se muestra dentro del teléfono.
 * Para sumar un canal: agregarlo acá y en CHANNELS, crear su componente de chat
 * (como `WhatsAppChat`) y elegirlo en `ChannelChat`.
 */
export type Channel = 'whatsapp';

export const CHANNELS: { id: Channel; label: string }[] = [{ id: 'whatsapp', label: 'WhatsApp' }];

export interface Appearance {
  theme: Theme;
  channel: Channel;
}

const KEY = 'demo-appearance';
const DEFAULT: Appearance = { theme: 'light', channel: 'whatsapp' };

function load(): Appearance {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Appearance> | null;
    return {
      theme: v?.theme === 'dark' ? 'dark' : 'light',
      channel: CHANNELS.some((c) => c.id === v?.channel) ? (v!.channel as Channel) : DEFAULT.channel,
    };
  } catch {
    return DEFAULT;
  }
}

/** Tema y canal del teléfono. Se recuerdan en este navegador (es solo una preferencia de vista). */
export function useAppearance() {
  const [appearance, setAppearance] = useState<Appearance>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(appearance));
    } catch {
      /* sin almacenamiento: la preferencia dura lo que la pestaña */
    }
  }, [appearance]);
  const update = (patch: Partial<Appearance>) => setAppearance((a) => ({ ...a, ...patch }));
  return { appearance, update };
}
