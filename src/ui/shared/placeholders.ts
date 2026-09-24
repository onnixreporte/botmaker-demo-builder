/**
 * Imágenes de ejemplo generadas como SVG (sin archivos externos).
 * Todas llevan la leyenda "ejemplo" para que nadie las confunda con material real.
 */
const xml = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const uri = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

export function infoImage(title: string, subtitle = 'Imagen de ejemplo', color = '#0E6E5C'): string {
  const rows = [0, 1, 2, 3, 4]
    .map((i) => `<rect x="36" y="${128 + i * 38}" width="${i % 2 ? 300 : 360}" height="12" rx="6" fill="#D5DDE5"/><rect x="36" y="${146 + i * 38}" width="${i % 2 ? 180 : 230}" height="9" rx="4.5" fill="#E6ECF1"/>`)
    .join('');
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" fill="#F4F7FA"/><rect width="480" height="96" fill="${xml(color)}"/><text x="36" y="48" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#fff">${xml(title)}</text><text x="36" y="76" font-family="Arial,sans-serif" font-size="14" fill="#fff" fill-opacity=".75">${xml(subtitle)}</text>${rows}<text x="444" y="344" text-anchor="end" font-family="Arial,sans-serif" font-size="12" fill="#98A2B3">Imagen de ejemplo</text></svg>`,
  );
}

export function videoThumb(title: string, color = '#0E6E5C'): string {
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${xml(color)}"/><stop offset="1" stop-color="#15384A"/></linearGradient></defs><rect width="480" height="270" fill="url(#g)"/><text x="30" y="52" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#fff">${xml(title)}</text><text x="30" y="80" font-family="Arial,sans-serif" font-size="14" fill="#fff" fill-opacity=".7">Video de ejemplo</text></svg>`,
  );
}

export type SampleKind = 'id-front' | 'id-back' | 'receipt' | 'photo';

export function sampleImage(label: string, kind: SampleKind): string {
  let body = '';
  if (kind === 'id-front')
    body = '<rect x="40" y="60" width="400" height="250" rx="18" fill="#E8EEF3" stroke="#B8C4CE" stroke-width="2"/><rect x="66" y="112" width="100" height="126" rx="10" fill="#C9D4DD"/><circle cx="116" cy="158" r="24" fill="#AEBBC6"/><rect x="82" y="190" width="68" height="36" rx="18" fill="#AEBBC6"/><rect x="192" y="116" width="200" height="14" rx="7" fill="#AEBBC6"/><rect x="192" y="146" width="160" height="12" rx="6" fill="#C9D4DD"/><rect x="192" y="172" width="180" height="12" rx="6" fill="#C9D4DD"/><rect x="192" y="198" width="120" height="12" rx="6" fill="#C9D4DD"/><rect x="66" y="80" width="170" height="14" rx="7" fill="#9FB0BD"/>';
  else if (kind === 'id-back')
    body = '<rect x="40" y="60" width="400" height="250" rx="18" fill="#E8EEF3" stroke="#B8C4CE" stroke-width="2"/><rect x="66" y="96" width="348" height="12" rx="6" fill="#C9D4DD"/><rect x="66" y="122" width="300" height="12" rx="6" fill="#C9D4DD"/><rect x="66" y="148" width="320" height="12" rx="6" fill="#C9D4DD"/>' +
      [0, 1, 2].map((i) => `<rect x="66" y="${206 + i * 24}" width="348" height="14" rx="3" fill="#AEBBC6" opacity=".7"/>`).join('');
  else if (kind === 'receipt')
    body = '<path d="M150 40h180v300l-15-10-15 10-15-10-15 10-15-10-15 10-15-10-15 10-15-10-15 10-15-10-15 10z" fill="#fff" stroke="#C9D4DD" stroke-width="2"/><rect x="172" y="66" width="136" height="14" rx="7" fill="#9FB0BD"/>' +
      [0, 1, 2, 3, 4, 5].map((i) => `<rect x="172" y="${104 + i * 26}" width="${i % 2 ? 90 : 136}" height="10" rx="5" fill="#D5DDE5"/>`).join('') +
      '<rect x="172" y="272" width="136" height="16" rx="4" fill="#AEBBC6"/>';
  else
    body = '<rect width="480" height="190" fill="#CFE6F5"/><rect y="190" width="480" height="170" fill="#9CCB7A"/><path d="M0 230 Q120 200 240 226 T480 214 V360 H0z" fill="#86BA66"/><path d="M60 360 L230 196 L250 196 L420 360z" fill="#C8B28A" opacity=".8"/>';
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" fill="#F3F5F7"/>${body}<rect x="0" y="322" width="480" height="38" fill="rgba(17,27,33,.55)"/><text x="240" y="347" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#fff">${xml(label.toUpperCase())} · EJEMPLO</text></svg>`,
  );
}

export const MAP_IMAGE = uri(
  '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="260" viewBox="0 0 500 260"><rect width="500" height="260" fill="#E8EFE3"/><path d="M0 70H500M0 170H500M120 0V260M300 0V260M420 0V260" stroke="#fff" stroke-width="14"/><path d="M0 120 C120 100 220 160 500 110" stroke="#FCE7A4" stroke-width="16" fill="none"/><path d="M250 150c-18 0-32-14-32-32 0-24 32-58 32-58s32 34 32 58c0 18-14 32-32 32z" fill="#E5484D"/><circle cx="250" cy="116" r="10" fill="#fff"/></svg>',
);

export const DEFAULT_GALLERY: { label: string; kind: SampleKind }[] = [
  { label: 'Foto', kind: 'photo' },
  { label: 'Documento', kind: 'id-front' },
  { label: 'Comprobante', kind: 'receipt' },
];
