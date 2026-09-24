import { useEffect } from 'react';
import { botById } from './bots';
import { DemoPage } from './pages/DemoPage';
import { FlowPage } from './pages/FlowPage';
import { HomePage } from './pages/HomePage';
import { TestPage } from './pages/TestPage';
import { href, onLink, useRoute } from './ui/shared/router';

export function App() {
  const route = useRoute();
  const bot = route.page !== 'home' && route.page !== 'notfound' ? botById(route.bot) : undefined;

  useEffect(() => {
    const suffix = route.page === 'flow' ? ' · Flujo' : route.page === 'test' ? ' · Prueba' : '';
    document.title = bot ? `${bot.config.name}${suffix}` : 'Demos de bots';
  }, [route, bot]);

  if (route.page === 'home') return <HomePage />;
  if (!bot) return <NotFound />;
  // `key` fuerza un motor nuevo al cambiar de bot o de vista
  if (route.page === 'demo') return <DemoPage key={`d-${bot.config.id}`} bot={bot} />;
  if (route.page === 'test') return <TestPage key={`t-${bot.config.id}`} bot={bot} />;
  return <FlowPage key={`f-${bot.config.id}`} bot={bot} initialIntent={route.page === 'flow' ? route.intent : undefined} />;
}

function NotFound() {
  return (
    <div style={{ padding: '64px 20px', maxWidth: 560, margin: '0 auto' }}>
      <div className="eyebrow">404</div>
      <h1 style={{ margin: '6px 0 8px' }}>No existe esa demo</h1>
      <p style={{ color: 'var(--ink-2)' }}>Revisá el enlace o volvé a la lista de bots.</p>
      <a className="btn pri" href={href('/')} onClick={(e) => onLink(e, '/')}>
        Ver los bots
      </a>
    </div>
  );
}
