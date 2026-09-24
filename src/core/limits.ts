/** Límites de la API de WhatsApp Business para mensajes interactivos. */
export const WA = {
  text: 4096,
  interactiveBody: 1024,
  header: 60,
  footer: 60,
  listButton: 20,
  listRows: 10,
  rowTitle: 24,
  rowDescription: 72,
  sectionTitle: 24,
  buttons: 3,
  buttonTitle: 20,
} as const;

/** Cuenta caracteres como los cuenta WhatsApp (puntos de código, no unidades UTF-16). */
export const chars = (s: string): number => Array.from(s).length;

/**
 * Límites de WhatsApp Flows (developers.facebook.com/docs/whatsapp/flows/reference/components).
 * `cta` es una recomendación de Meta, no un rechazo: el linter lo marca como aviso.
 */
export const FLOW = {
  cta: 30,
  heading: 80,
  body: 4096,
  helper: 80,
  footerButton: 35,
  optionTitle: 30,
  dropdownOptions: 200,
  componentsPerScreen: 50,
  /** Máximo de la etiqueta según el componente. */
  label: { text: 20, textarea: 20, dropdown: 20, radio: 30, checkbox: 30, date: 40, optin: 120 },
} as const;
