/**
 * Spatial focus navigation for menus, so arrow keys and a controller d-pad can reach every
 * button without a mouse. Picks the nearest visible, enabled control in the pressed direction.
 */

export type Dir = 'up' | 'down' | 'left' | 'right';

const FOCUSABLE =
  'button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), .story-choice-card, .learn-item, .job-item';

export function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.closest('.hidden')) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const s = getComputedStyle(el);
  return s.visibility !== 'hidden' && s.display !== 'none';
}

export function focusablesIn(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => isVisible(el) && !el.closest('[inert]'));
}

/** Makes clickable non-button elements (cards, list items) reachable with Tab and Enter. */
export function ensureFocusable(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.story-choice-card, .learn-item, .job-item, .ability-slot-box.cyclable, .gear-slot-box').forEach((el) => {
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
  });
}

/** Focuses an element and shows the focus ring even when focus did not come from the keyboard. */
export function focusVisible(el: HTMLElement): void {
  try {
    (el as HTMLElement & { focus(o?: { focusVisible?: boolean; preventScroll?: boolean }): void }).focus({ focusVisible: true });
  } catch {
    el.focus();
  }
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/** Moves focus within `root` in direction `dir`. Returns the newly focused element. */
export function moveFocus(root: Element, dir: Dir): HTMLElement | null {
  const items = focusablesIn(root);
  if (items.length === 0) return null;
  const current = document.activeElement as HTMLElement | null;
  if (!current || !root.contains(current) || !items.includes(current)) {
    focusVisible(items[0]);
    return items[0];
  }
  const a = current.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === current) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    const dx = bx - ax;
    const dy = by - ay;
    let primary: number;
    let secondary: number;
    if (dir === 'up') { primary = -dy; secondary = Math.abs(dx); }
    else if (dir === 'down') { primary = dy; secondary = Math.abs(dx); }
    else if (dir === 'left') { primary = -dx; secondary = Math.abs(dy); }
    else { primary = dx; secondary = Math.abs(dy); }
    if (primary <= 2) continue;
    const score = primary + secondary * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  // Wrap around within lists (e.g. bottom of the ability menu back to the top)
  if (!best) {
    const idx = items.indexOf(current);
    if (dir === 'down' || dir === 'right') best = items[(idx + 1) % items.length];
    else best = items[(idx - 1 + items.length) % items.length];
  }
  focusVisible(best);
  return best;
}
