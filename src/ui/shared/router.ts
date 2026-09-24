import type React from 'react';
import { useEffect, useState } from 'react';

/**
 * Router mínimo con History API.
 *   /                 inicio (lista de bots)
 *   /:bot             demo para el cliente
 *   /:bot/prueba      demo con panel de prueba
 *   /:bot/flujo       flujograma estilo Botmaker (#intención para abrir una)
 * Respeta BASE_URL de Vite para publicar en un subdirectorio.
 */
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

export type Route =
  | { page: 'home' }
  | { page: 'demo'; bot: string }
  | { page: 'test'; bot: string }
  | { page: 'flow'; bot: string; intent?: string }
  | { page: 'notfound'; path: string };

export function parse(pathname: string, hash: string): Route {
  const path = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { page: 'home' };
  const [bot, sub] = parts;
  if (parts.length === 1) return { page: 'demo', bot };
  if (sub === 'prueba' && parts.length === 2) return { page: 'test', bot };
  if (sub === 'flujo' && parts.length === 2) return { page: 'flow', bot, intent: hash.replace(/^#/, '') || undefined };
  return { page: 'notfound', path };
}

export const href = (path: string) => `${BASE}${path.startsWith('/') ? path : '/' + path}`;

export function navigate(path: string): void {
  window.history.pushState(null, '', href(path));
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const read = () => parse(window.location.pathname, window.location.hash);
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('popstate', on);
    window.addEventListener('hashchange', on);
    return () => {
      window.removeEventListener('popstate', on);
      window.removeEventListener('hashchange', on);
    };
  }, []);
  return route;
}

/** Link interno que no recarga la página. */
export function onLink(e: React.MouseEvent<HTMLAnchorElement>, path: string): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.currentTarget.target === '_blank') return;
  e.preventDefault();
  navigate(path);
}
