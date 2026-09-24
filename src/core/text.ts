import type { Vars } from './types';

/** Normaliza para comparar lo que escribe el cliente: minúsculas, sin tildes ni símbolos. */
export function norm(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Reemplaza {{variable}} o {{objeto.campo}} por su valor. */
export function interpolate(text: string, vars: Vars): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const v = path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), vars);
    return v == null ? '' : String(v);
  });
}

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/**
 * Formato de WhatsApp a HTML seguro: *negrita*, _cursiva_, ~tachado~, ```mono``` y links.
 * Escapa todo antes de aplicar el formato.
 */
export function waHtml(text: string): string {
  let h = escapeHtml(text);
  h = h
    .replace(/```([\s\S]+?)```/g, '<code>$1</code>')
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
    .replace(/~([^~\n]+)~/g, '<s>$1</s>')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g, '$1<i>$2</i>');
  h = h.replace(/(https?:\/\/[^\s<]+)/g, (u) =>
    u.includes('…')
      ? `<span class="wa-link">${u}</span>`
      : `<a class="wa-link" href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`,
  );
  return h;
}

export function firstLine(s: string, max = 90): string {
  const line = String(s).split('\n').find((l) => l.trim()) ?? '';
  return line.length > max ? line.slice(0, max - 1) + '…' : line;
}

/** Valor legible para el panel de variables y el registro. */
export function display(v: unknown): string {
  if (v === true) return 'sí';
  if (v === false) return 'no';
  if (v == null) return '(vacía)';
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s.length > 160 ? s.slice(0, 157) + '…' : s;
  }
  return String(v);
}
