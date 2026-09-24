import { bots } from '../bots';
import { lintBot } from '../core/lint';
import { Avatar } from '../ui/shared/Avatar';
import { href, onLink } from '../ui/shared/router';
import './home.css';

/** Inicio interno: lista de bots con sus tres vistas. */
export function HomePage() {
  return (
    <div className="home">
      <header className="home-h">
        <div className="eyebrow">Builder de demos</div>
        <h1>Bots de WhatsApp</h1>
        <p>Cada bot tiene una demo para compartir con el cliente, una versión con panel de prueba y su flujograma estilo Botmaker. Todo sale del mismo archivo de definición.</p>
      </header>
      <ul className="home-list">
        {bots.map((b) => {
          const c = b.config;
          const issues = lintBot(b);
          const errors = issues.filter((i) => i.level === 'error').length;
          const warns = issues.length - errors;
          return (
            <li key={c.id} className="home-card">
              <div className="home-id">
                <Avatar profile={c.profile} className="av" />
                <div>
                  <b>{c.name}</b>
                  <span>{c.client}</span>
                </div>
              </div>
              <p>{c.description}</p>
              <div className="home-meta">
                <span>{b.intents.length} intenciones</span>
                <span>{Object.keys(b.endpoints).length} endpoints</span>
                <span className={errors ? 'bad' : 'good'}>{errors ? `${errors} errores` : 'Sin errores'}</span>
                {warns > 0 && <span className="warn">{warns} avisos</span>}
              </div>
              <div className="home-links">
                <a className="btn pri" href={href(`/${c.id}`)} onClick={(e) => onLink(e, `/${c.id}`)}>
                  Demo para el cliente
                </a>
                <a className="btn" href={href(`/${c.id}/prueba`)} onClick={(e) => onLink(e, `/${c.id}/prueba`)}>
                  Probar con panel
                </a>
                <a className="btn" href={href(`/${c.id}/flujo`)} onClick={(e) => onLink(e, `/${c.id}/flujo`)}>
                  Flujograma
                </a>
              </div>
            </li>
          );
        })}
      </ul>
      <footer className="home-f">
        Para crear un bot nuevo: <code>npm run new-bot -- &lt;id&gt; "&lt;Cliente&gt;"</code> y seguí las instrucciones de CLAUDE.md.
      </footer>
    </div>
  );
}
