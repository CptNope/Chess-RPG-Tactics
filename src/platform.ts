/**
 * Where the game is running, and the links it offers. The same build runs on GitHub Pages and
 * inside itch.io's embed iframe (served from *.itch.zone), so anything that depends on the page's
 * address goes through here.
 */

/** The free web version (also where share links open). */
export const PLAY_URL = 'https://cptnope.github.io/Chess-RPG-Tactics/';
/** The itch.io page: downloads, devlogs and donations. */
export const ITCH_URL = 'https://cptnope.itch.io/chess-rpg-tactics';
export const SOURCE_URL = 'https://github.com/CptNope/Chess-RPG-Tactics';
export const AUTHOR_URL = 'https://jeremyanderson.tech';

/** True inside itch.io's HTML5 embed (or the itch app). */
export const ON_ITCH = /(^|\.)itch\.(zone|io)$/i.test(location.hostname);

/** True when the game is inside another page's iframe (itch, a blog embed...). */
export const EMBEDDED = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin parent
  }
})();

/**
 * Base address for Workshop share links. Inside itch the page address is an upload-specific
 * iframe URL (and itch's own page can't pass a #hash into the game), so links point at the web
 * version, which always opens them.
 */
export function shareBase(): string {
  if (ON_ITCH || EMBEDDED || !/^https?:$/.test(location.protocol)) return PLAY_URL;
  return `${location.origin}${location.pathname}`;
}

/** Fullscreen works only if the browser allows it here (itch's iframe needs its fullscreen option on). */
export function canFullscreen(): boolean {
  const d = document as Document & { webkitFullscreenEnabled?: boolean };
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  const d = document as Document & { webkitFullscreenElement?: Element };
  return !!(document.fullscreenElement || d.webkitFullscreenElement);
}

export function toggleFullscreen(): void {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  const d = document as Document & { webkitExitFullscreen?: () => void };
  try {
    if (isFullscreen()) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else d.webkitExitFullscreen?.();
    } else if (el.requestFullscreen) {
      void el.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
    } else {
      el.webkitRequestFullscreen?.();
    }
  } catch {
    /* not allowed here */
  }
}

/**
 * Keys that scroll a page: inside an iframe they would scroll the store page around the game
 * once the game doesn't use them. Registered after the game's own handlers, so it only stops the
 * browser default, never the game.
 */
export function guardPageScroll(): void {
  const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'PageUp', 'PageDown', 'Home', 'End']);
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (!SCROLL_KEYS.has(e.key) || t?.matches?.('input, textarea, select, [contenteditable]')) return;
    // Space and Enter on a focused button still click it (their default action is the click)
    if (e.key === ' ' && t?.closest?.('button, [role="button"]')) return;
    e.preventDefault();
  });
  // Clicking into the game gives it keyboard focus inside an iframe
  window.addEventListener('pointerdown', () => window.focus(), { passive: true });
}

/**
 * Installable app (0.19.0). On the web version (not inside itch.io or another page) a service
 * worker caches the build so the game plays offline after one visit, and browsers that support
 * it offer "Install app". Returns a function that shows the browser's install prompt, or null.
 */
export function setupInstall(onInstallable: (prompt: () => void) => void, onInstalled: () => void): void {
  // https only, so the local dev server (http) never caches a stale build
  if (ON_ITCH || EMBEDDED || location.protocol !== 'https:' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  type BeforeInstall = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    const ev = e as BeforeInstall;
    onInstallable(() => {
      ev.prompt().catch(() => undefined);
      ev.userChoice.then((c) => { if (c.outcome === 'accepted') onInstalled(); }).catch(() => undefined);
    });
  });
  window.addEventListener('appinstalled', onInstalled);
}

/** True when running as an installed app rather than in a browser tab. */
export function isInstalledApp(): boolean {
  return window.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
