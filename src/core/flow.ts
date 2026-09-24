import type { FlowComponent, FlowField, FlowScreen, FlowValues } from './types';

/*
 * Utilidades de WhatsApp Flows compartidas por el motor, la interfaz y los tests.
 */

export const isField = (c: FlowComponent): c is FlowField => 'name' in c;

/** Todos los campos del Flow, en orden de pantalla. */
export function flowFields(screens: FlowScreen[]): FlowField[] {
  return screens.flatMap((s) => s.children.filter(isField));
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Lo que valida WhatsApp en el teléfono antes de dejar avanzar: obligatorios y tipo de entrada.
 * Devuelve el mensaje de error o `null`.
 */
export function checkFlowValue(f: FlowField, v: FlowValues[string] | undefined): string | null {
  const empty = v == null || v === '' || v === false || (Array.isArray(v) && v.length === 0);
  if (empty) return f.required ? 'Este campo es obligatorio' : null;
  if (f.kind === 'text' && typeof v === 'string') {
    if (f.input === 'email' && !EMAIL.test(v.trim())) return 'Ingresá un email válido';
    if (f.input === 'number' && !/^\d+([.,]\d+)?$/.test(v.trim())) return 'Ingresá solo números';
    if (f.input === 'phone' && !/^\+?[\d\s()-]{6,}$/.test(v.trim())) return 'Ingresá un teléfono válido';
  }
  return null;
}

/** Normaliza lo que llega del Flow (espacios, coma decimal). */
export function normalizeFlowValue(f: FlowField, v: FlowValues[string]): FlowValues[string] {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  if (f.kind === 'text' && f.input === 'number') return t.replace(',', '.');
  if (f.kind === 'text' && f.input === 'phone') return t.replace(/[\s()-]/g, '');
  return t;
}

/** Respuestas legibles (etiqueta → valor) para la burbuja "Ver respuesta" y el registro. */
export function flowSummary(screens: FlowScreen[], values: FlowValues): { label: string; value: string }[] {
  return flowFields(screens)
    .filter((f) => values[f.name] != null && values[f.name] !== '')
    .map((f) => {
      const v = values[f.name];
      const title = (id: string) => ('options' in f ? f.options.find((o) => o.id === id)?.title : undefined) ?? id;
      const value = typeof v === 'boolean' ? (v ? 'Sí' : 'No') : Array.isArray(v) ? v.map(title).join(', ') : title(v);
      return { label: f.label, value };
    });
}
