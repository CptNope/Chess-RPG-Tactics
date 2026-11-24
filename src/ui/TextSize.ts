/**
 * Text size setting (0.20.0): Normal, Large or Larger. Every UI font size in style.css is
 * `calc(Npx * var(--ts))`; this sets `data-text-size` on <html>, which picks --ts. Saved per device.
 */
export type TextSize = 'normal' | 'large' | 'larger';

export const TEXT_SIZES: readonly TextSize[] = ['normal', 'large', 'larger'];
export const TEXT_SIZE_LABEL: Record<TextSize, string> = { normal: 'Normal', large: 'Large', larger: 'Larger' };
export const TEXT_SIZE_KEY = 'chess_rpg_tactics_text_size_v1';

export function sanitizeTextSize(v: unknown): TextSize {
  return TEXT_SIZES.includes(v as TextSize) ? (v as TextSize) : 'normal';
}

export function nextTextSize(v: TextSize): TextSize {
  return TEXT_SIZES[(TEXT_SIZES.indexOf(v) + 1) % TEXT_SIZES.length];
}

export function savedTextSize(): TextSize {
  try { return sanitizeTextSize(localStorage.getItem(TEXT_SIZE_KEY)); } catch { return 'normal'; }
}

export function applyTextSize(v: TextSize, persist = false): void {
  const root = document.documentElement;
  if (v === 'normal') root.removeAttribute('data-text-size');
  else root.setAttribute('data-text-size', v);
  if (!persist) return;
  try {
    if (v === 'normal') localStorage.removeItem(TEXT_SIZE_KEY);
    else localStorage.setItem(TEXT_SIZE_KEY, v);
  } catch { /* private browsing: the choice lasts for this visit */ }
}
