import * as THREE from 'three';
import { FacingDirection } from '../core/types';
import { drawSprite, SpriteFrame } from './CharacterArt';

// Helper to create a crisp pixel-art canvas texture
function createPixelTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural 16x16 / 32x32 retro pixel tile textures
export function createGrassTopTexture(): THREE.CanvasTexture {
  return createPixelTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#4f9437';
    ctx.fillRect(0, 0, 16, 16);

    ctx.fillStyle = '#3d7829';
    const darkPixels = [[2, 3], [3, 3], [7, 8], [8, 8], [8, 9], [13, 2], [14, 2], [1, 12], [2, 12], [11, 13]];
    darkPixels.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));

    ctx.fillStyle = '#6ab848';
    const lightPixels = [[3, 2], [7, 7], [13, 1], [1, 11], [12, 12], [5, 14], [10, 5], [9, 4]];
    lightPixels.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));

    ctx.strokeStyle = '#2b581b';
    ctx.strokeRect(0, 0, 16, 16);
  });
}

export function createDirtSideTexture(): THREE.CanvasTexture {
  return createPixelTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(0, 0, 16, 16);

    ctx.fillStyle = '#59391e';
    const dark = [[2, 4], [3, 4], [7, 10], [12, 6], [13, 6], [4, 13], [9, 14]];
    dark.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));

    ctx.fillStyle = '#9e6d42';
    const light = [[5, 2], [10, 8], [1, 9], [14, 11], [8, 3]];
    light.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));

    ctx.fillStyle = '#4f9437';
    ctx.fillRect(0, 0, 16, 2);
    ctx.fillStyle = '#3d7829';
    ctx.fillRect(2, 2, 2, 1);
    ctx.fillRect(7, 2, 2, 2);
    ctx.fillRect(12, 2, 3, 1);
  });
}

export function createStoneTexture(): THREE.CanvasTexture {
  return createPixelTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#7a8288';
    ctx.fillRect(0, 0, 16, 16);

    ctx.fillStyle = '#474b50';
    ctx.fillRect(0, 7, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(8, 0, 1, 7);
    ctx.fillRect(4, 8, 1, 7);
    ctx.fillRect(12, 8, 1, 7);

    ctx.fillStyle = '#9aa1a8';
    ctx.fillRect(1, 1, 6, 1);
    ctx.fillRect(9, 1, 6, 1);
    ctx.fillRect(5, 9, 6, 1);
    ctx.fillRect(13, 9, 2, 1);

    ctx.strokeStyle = '#32363a';
    ctx.strokeRect(0, 0, 16, 16);
  });
}

export function createCastleParapetTexture(): THREE.CanvasTexture {
  return createPixelTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#334155'; // Dark slate fortress stone
    ctx.fillRect(0, 0, 16, 16);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 7, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(8, 0, 1, 7);
    ctx.fillRect(4, 8, 1, 7);
    ctx.fillRect(12, 8, 1, 7);

    ctx.fillStyle = '#475569';
    ctx.fillRect(1, 1, 6, 1);
    ctx.fillRect(9, 1, 6, 1);
    ctx.fillRect(5, 9, 6, 1);

    // Subtle blue torchlight tint
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(2, 2, 1, 1);

    ctx.strokeStyle = '#0f172a';
    ctx.strokeRect(0, 0, 16, 16);
  });
}

export function createWaterTexture(): THREE.CanvasTexture {
  return createPixelTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(0, 0, 16, 16);

    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 4, 16, 2);
    ctx.fillRect(0, 11, 16, 2);

    ctx.fillStyle = '#60a5fa';
    const highlights = [[2, 3], [3, 3], [8, 2], [9, 2], [5, 10], [6, 10], [12, 9], [13, 9]];
    highlights.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));

    ctx.strokeStyle = '#1e3a8a';
    ctx.strokeRect(0, 0, 16, 16);
  });
}

export function createSwampTexture(): THREE.CanvasTexture {
  return createPixelTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#1e3a2f'; // Murky green swamp
    ctx.fillRect(0, 0, 16, 16);

    ctx.fillStyle = '#142720';
    ctx.fillRect(0, 5, 16, 2);
    ctx.fillRect(0, 12, 16, 2);

    ctx.fillStyle = '#34d399'; // Swamp toxic bubbles
    const bubbles = [[3, 4], [4, 4], [10, 2], [13, 10], [7, 13]];
    bubbles.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));

    ctx.strokeStyle = '#064e3b';
    ctx.strokeRect(0, 0, 16, 16);
  });
}

/** Sand (0.34.0): warm dunes with wind ripples and glints of sea glass. */
export function createSandTexture(): THREE.CanvasTexture {
  return createPixelTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#d9b97a';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#c4a063'; // ripples
    for (const [x, y, w] of [[1, 3, 5], [9, 2, 6], [3, 8, 6], [11, 9, 4], [0, 13, 4], [7, 14, 6]]) ctx.fillRect(x, y, w, 1);
    ctx.fillStyle = '#ecd6a0';
    for (const [x, y, w] of [[2, 2, 4], [10, 1, 4], [4, 7, 5], [12, 8, 3], [8, 13, 4]]) ctx.fillRect(x, y, w, 1);
    ctx.fillStyle = '#5fd3c4'; // sea glass
    ctx.fillRect(6, 5, 1, 1); ctx.fillRect(13, 12, 1, 1);
    ctx.fillStyle = '#9be7dc';
    ctx.fillRect(2, 11, 1, 1);
    ctx.strokeStyle = '#a8864e';
    ctx.strokeRect(0, 0, 16, 16);
  });
}

/** Snow (0.34.0): packed snow, blue in the hollows, with a few sparkles. */
export function createSnowTexture(): THREE.CanvasTexture {
  return createPixelTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#e8eef6';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#c9d6e6'; // drifts and hollows
    for (const [x, y, w] of [[0, 4, 4], [8, 3, 5], [3, 10, 6], [12, 11, 4], [5, 15, 5]]) ctx.fillRect(x, y, w, 1);
    ctx.fillStyle = '#b4c4da';
    ctx.fillRect(9, 4, 2, 1); ctx.fillRect(4, 11, 2, 1);
    ctx.fillStyle = '#ffffff';
    for (const [x, y] of [[2, 2], [11, 7], [6, 13], [14, 1]]) ctx.fillRect(x, y, 1, 1);
    ctx.strokeStyle = '#9fb0c8';
    ctx.strokeRect(0, 0, 16, 16);
  });
}

// Unit Sprite Texture Cache to avoid redundant canvas & GPU texture allocations
const unitSpriteTextureCache = new Map<string, THREE.CanvasTexture>();

// Procedural 32x32 Character Pixel Art Sprites
/**
 * Battle sprite for a job, facing and animation frame, as a crisp texture. The art itself is
 * drawn in CharacterArt (48×48, outlined, six frames per view).
 */
export function createUnitSpriteTexture(jobClass: string, facing: FacingDirection, isEnemy: boolean = false, frame: SpriteFrame = 'idle0'): THREE.CanvasTexture {
  const cacheKey = `${jobClass}_${facing}_${isEnemy ? 'e' : 'p'}_${frame}`;
  const cached = unitSpriteTextureCache.get(cacheKey);
  if (cached) return cached;
  const texture = new THREE.CanvasTexture(drawSprite(jobClass, facing, isEnemy, frame));
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  unitSpriteTextureCache.set(cacheKey, texture);
  return texture;
}
