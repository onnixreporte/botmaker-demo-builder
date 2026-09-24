import type { ReactNode } from 'react';
import type { Appearance } from './appearance';
import './device.css';

/**
 * Marco de teléfono común a todos los canales: bisel, barra de estado y barra de inicio.
 * Pone `data-theme` y `data-channel` para que el CSS de cada canal elija sus colores.
 * En pantallas chicas desaparece el marco y el chat ocupa todo.
 */
export function PhoneFrame({ appearance, clock, children }: { appearance: Appearance; clock?: string; children: ReactNode }) {
  return (
    <div className="dev" data-theme={appearance.theme} data-channel={appearance.channel}>
      <div className="dev-screen">
        <div className="dev-sbar" aria-hidden="true">
          <span>{clock ?? ''}</span>
          <span className="cam" />
          <span className="si">
            <svg width="16" height="12" viewBox="0 0 16 12">
              <path d="M1 11h2V8H1zm4 0h2V6H5zm4 0h2V3H9zm4 0h2V0h-2z" fill="currentColor" />
            </svg>
            <svg width="16" height="12" viewBox="0 0 24 18">
              <path d="M12 18l4-5a6.4 6.4 0 0 0-8 0zm-6.9-8.3 2.2 2.8a7.6 7.6 0 0 1 9.4 0l2.2-2.8a11.2 11.2 0 0 0-13.8 0zM0 3.4l2.2 2.8a15.4 15.4 0 0 1 19.6 0L24 3.4a19 19 0 0 0-24 0z" fill="currentColor" />
            </svg>
            <svg width="24" height="12" viewBox="0 0 24 12">
              <rect x=".5" y=".5" width="20" height="11" rx="3" fill="none" stroke="currentColor" />
              <rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor" />
              <rect x="21.5" y="4" width="2" height="4" rx="1" fill="currentColor" />
            </svg>
          </span>
        </div>
        {children}
        <div className="dev-homebar" aria-hidden="true">
          <i />
        </div>
      </div>
    </div>
  );
}
