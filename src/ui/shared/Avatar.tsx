import type { BotConfig } from '../../core/types';

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

/** Ruta de un archivo de `public/`, respetando BASE_URL. */
export const asset = (path: string) => (/^(https?:|data:)/.test(path) ? path : `${BASE}/${path.replace(/^\//, '')}`);

/** Foto de perfil del bot: la imagen de `profile.avatar` o, si no hay, las iniciales sobre el color de marca. */
export function Avatar({ profile, className }: { profile: BotConfig['profile']; className: string }) {
  if (profile.avatar)
    return (
      <span className={`${className} img`} aria-hidden="true">
        <img src={asset(profile.avatar)} alt="" />
      </span>
    );
  return (
    <span className={className} style={{ background: profile.color }} aria-hidden="true">
      {profile.initials}
    </span>
  );
}
