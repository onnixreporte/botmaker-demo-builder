import type { Validator } from './types';

/**
 * Validadores reutilizables para `ask({ validate })`.
 * Cada uno devuelve el valor normalizado o null si no es válido.
 */
export const V = {
  /** Cédula paraguaya: solo dígitos, 6 a 8. Acepta puntos y espacios. */
  cedulaPY: {
    name: 'Cédula: solo números, 6 a 8 dígitos',
    fn: (t) => {
      const d = t.replace(/[.\s-]/g, '');
      return /^\d{6,8}$/.test(d) ? d : null;
    },
  } satisfies Validator,

  /** Celular paraguayo: 09XXXXXXXX. Acepta +595 / 595. */
  phonePY: {
    name: 'Celular 09XXXXXXXX',
    fn: (t) => {
      let d = t.replace(/[\s\-().]/g, '');
      if (d.startsWith('+595')) d = '0' + d.slice(4);
      else if (d.startsWith('595')) d = '0' + d.slice(3);
      return /^09\d{8}$/.test(d) ? d : null;
    },
  } satisfies Validator,

  email: {
    name: 'Email válido',
    fn: (t) => {
      const e = t.trim().toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
    },
  } satisfies Validator,

  /** Fecha DD/MM/AAAA real y no futura. */
  date: {
    name: 'Fecha DD/MM/AAAA',
    fn: (t) => {
      const m = t.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
      if (!m) return null;
      const [d, mo, y] = [+m[1], +m[2], +m[3]];
      const dt = new Date(y, mo - 1, d);
      if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d || y < 1900 || dt > new Date()) return null;
      return `${String(d).padStart(2, '0')}/${String(mo).padStart(2, '0')}/${y}`;
    },
  } satisfies Validator,

  /** Monto entero positivo. Acepta separadores de miles y "Gs". */
  money: {
    name: 'Monto en números',
    fn: (t) => {
      const d = t.replace(/[.\s]|gs/gi, '');
      return /^\d+$/.test(d) && +d > 0 ? d : null;
    },
  } satisfies Validator,

  /** Número decimal positivo. Acepta coma decimal. */
  decimal: {
    name: 'Número (acepta decimales)',
    fn: (t) => {
      const d = t.trim().replace(/\s|ha|hect[aá]reas/gi, '').replace(',', '.');
      return /^\d+(\.\d+)?$/.test(d) && +d > 0 ? d : null;
    },
  } satisfies Validator,

  /** Nombre: 3 o más caracteres con al menos una letra. */
  name: {
    name: 'Nombre (3 o más letras)',
    fn: (t) => {
      const s = t.trim();
      return s.length >= 3 && /\p{L}/u.test(s) ? s : null;
    },
  } satisfies Validator,

  minLength: (n: number): Validator => ({
    name: `Texto de ${n} caracteres o más`,
    fn: (t) => (t.trim().length >= n ? t.trim() : null),
  }),

  regex: (re: RegExp, name: string): Validator => ({
    name,
    fn: (t) => (re.test(t.trim()) ? t.trim() : null),
  }),
};
