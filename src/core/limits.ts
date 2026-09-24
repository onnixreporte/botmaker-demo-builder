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
