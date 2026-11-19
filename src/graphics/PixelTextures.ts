import * as THREE from 'three';
import { FacingDirection } from '../core/types';

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

// Unit Sprite Texture Cache to avoid redundant canvas & GPU texture allocations
const unitSpriteTextureCache = new Map<string, THREE.CanvasTexture>();

// Procedural 32x32 Character Pixel Art Sprites
export function createUnitSpriteTexture(jobClass: string, facing: FacingDirection, isEnemy: boolean = false): THREE.CanvasTexture {
  const cacheKey = `${jobClass}_${facing}_${isEnemy ? 'e' : 'p'}`;
  const cached = unitSpriteTextureCache.get(cacheKey);
  if (cached) return cached;

  const texture = createPixelTexture(32, 32, (ctx) => {
    ctx.clearRect(0, 0, 32, 32);

    const skin = '#fcd34d';
    let hairColor = '#b45309';
    let mainColor = isEnemy ? '#dc2626' : '#2563eb';
    let subColor = isEnemy ? '#991b1b' : '#1d4ed8';

    if (jobClass === 'knight') {
      hairColor = '#475569';
      mainColor = isEnemy ? '#7f1d1d' : '#64748b';
      subColor = isEnemy ? '#450a0a' : '#334155';
    } else if (jobClass === 'white_mage') {
      hairColor = '#d97706';
      mainColor = '#f8fafc';
      subColor = isEnemy ? '#dc2626' : '#ef4444';
    } else if (jobClass === 'archer') {
      hairColor = '#78350f';
      mainColor = isEnemy ? '#991b1b' : '#15803d';
      subColor = isEnemy ? '#7f1d1d' : '#166534';
    } else if (jobClass === 'black_mage') {
      hairColor = '#1e1b4b';
      mainColor = isEnemy ? '#581c87' : '#312e81';
      subColor = '#f59e0b';
    } else if (jobClass === 'dragoon') {
      hairColor = '#64748b';
      mainColor = isEnemy ? '#991b1b' : '#0284c7'; // Deep azure dragon mail
      subColor = isEnemy ? '#7f1d1d' : '#0369a1';
    } else if (jobClass === 'ninja') {
      hairColor = '#0f172a';
      mainColor = isEnemy ? '#881337' : '#1e293b'; // Midnight shinobi garb
      subColor = isEnemy ? '#dc2626' : '#ef4444'; // Red sash
    } else if (jobClass === 'geomancer') {
      hairColor = '#3f6212';
      mainColor = isEnemy ? '#9a3412' : '#4d7c0f'; // Moss-green terramancer cloak
      subColor = isEnemy ? '#7c2d12' : '#a16207'; // Earthen sash
    } else if (jobClass === 'time_mage') {
      hairColor = '#831843';
      mainColor = isEnemy ? '#701a75' : '#be123c'; // Crimson starry chronomancer
      subColor = '#fbbf24';
    }

    // Shadow on the ground
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(16, 29, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw sprite body based on facing: Front ('S'), Back ('N'), or Sides ('E'/'W')
    if (facing === 'S') {
      // FRONT VIEW
      if (jobClass === 'black_mage') {
        // Pointy Wizard Hat
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.moveTo(16, 2);
        ctx.lineTo(8, 14);
        ctx.lineTo(24, 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(7, 13, 18, 3);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(10, 16, 12, 6);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(12, 17, 2, 2);
        ctx.fillRect(18, 17, 2, 2);
      } else if (jobClass === 'time_mage') {
        // Starry Chronomancer Hat
        ctx.fillStyle = '#be123c';
        ctx.beginPath();
        ctx.moveTo(16, 1);
        ctx.lineTo(9, 13);
        ctx.lineTo(23, 13);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(15, 3, 2, 2); // Star jewel
        ctx.fillRect(8, 12, 16, 3);
        ctx.fillStyle = skin;
        ctx.fillRect(12, 15, 8, 7);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(13, 17, 2, 2);
        ctx.fillRect(17, 17, 2, 2);
      } else if (jobClass === 'dragoon') {
        // Winged Dragon Greathelm
        ctx.fillStyle = mainColor;
        ctx.fillRect(10, 5, 12, 11);
        ctx.fillStyle = '#cbd5e1'; // Wing plumes
        ctx.fillRect(8, 4, 3, 5);
        ctx.fillRect(21, 4, 3, 5);
        ctx.fillStyle = '#0f172a'; // T-Visor
        ctx.fillRect(12, 10, 8, 2);
        ctx.fillRect(15, 12, 2, 4);
      } else if (jobClass === 'ninja') {
        // Ninja Cowl & Mask
        ctx.fillStyle = mainColor;
        ctx.fillRect(10, 5, 12, 12);
        ctx.fillStyle = skin; // Eye slit
        ctx.fillRect(12, 10, 8, 4);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(13, 11, 2, 2);
        ctx.fillRect(17, 11, 2, 2);
      } else {
        // Standard Head & Hair
        ctx.fillStyle = hairColor;
        ctx.fillRect(11, 6, 10, 6);
        ctx.fillStyle = skin;
        ctx.fillRect(12, 9, 8, 7);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(13, 12, 2, 2);
        ctx.fillRect(17, 12, 2, 2);
      }

      // Torso / Tunic / Armor
      ctx.fillStyle = mainColor;
      ctx.fillRect(10, 16, 12, 8);
      ctx.fillStyle = subColor;
      ctx.fillRect(11, 21, 10, 2);

      // Legs / Boots
      ctx.fillStyle = '#334155';
      ctx.fillRect(11, 24, 4, 5);
      ctx.fillRect(17, 24, 4, 5);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(10, 27, 5, 2);
      ctx.fillRect(17, 27, 5, 2);

      // Weapons held
      if (jobClass === 'knight' || jobClass === 'squire') {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(23, 10, 2, 14);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(21, 22, 6, 2);
      } else if (jobClass === 'dragoon') {
        // Long Dragon Spear
        ctx.fillStyle = '#78350f'; // Pole
        ctx.fillRect(24, 2, 2, 26);
        ctx.fillStyle = '#e2e8f0'; // Spearhead
        ctx.fillRect(23, 0, 4, 6);
        ctx.fillStyle = '#f59e0b'; // Wing guard
        ctx.fillRect(22, 6, 6, 2);
      } else if (jobClass === 'ninja') {
        // Dual Katana / Daggers
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(7, 14, 2, 10);
        ctx.fillRect(23, 14, 2, 10);
      } else if (jobClass === 'time_mage') {
        // Hourglass Staff
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(23, 6, 2, 20);
        ctx.fillStyle = '#38bdf8'; // Crystal hourglass
        ctx.fillRect(22, 3, 4, 4);
      } else if (jobClass === 'archer') {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(6, 11, 2, 13);
        ctx.fillRect(7, 9, 2, 2);
        ctx.fillRect(7, 23, 2, 2);
      } else if (jobClass === 'white_mage' || jobClass === 'black_mage') {
        ctx.fillStyle = jobClass === 'white_mage' ? '#f59e0b' : '#78350f';
        ctx.fillRect(23, 8, 2, 18);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(22, 6, 4, 4);
      } else if (jobClass === 'geomancer') {
        // Gnarled oak staff topped with a jade earth-stone
        ctx.fillStyle = '#713f12';
        ctx.fillRect(23, 7, 2, 19);
        ctx.fillRect(22, 9, 1, 2);
        ctx.fillStyle = '#34d399';
        ctx.fillRect(22, 4, 4, 4);
        ctx.fillStyle = '#065f46';
        ctx.fillRect(23, 5, 2, 2);
      }

    } else if (facing === 'N') {
      // BACK VIEW
      if (jobClass === 'black_mage' || jobClass === 'time_mage') {
        ctx.fillStyle = jobClass === 'time_mage' ? '#be123c' : '#b45309';
        ctx.beginPath();
        ctx.moveTo(16, 2);
        ctx.lineTo(8, 14);
        ctx.lineTo(24, 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = subColor;
        ctx.fillRect(7, 13, 18, 3);
      } else if (jobClass === 'dragoon') {
        ctx.fillStyle = mainColor;
        ctx.fillRect(10, 5, 12, 11);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(8, 4, 3, 5);
        ctx.fillRect(21, 4, 3, 5);
      } else {
        ctx.fillStyle = hairColor;
        ctx.fillRect(11, 6, 10, 9);
      }

      ctx.fillStyle = subColor;
      ctx.fillRect(9, 15, 14, 9);

      ctx.fillStyle = '#334155';
      ctx.fillRect(11, 24, 4, 5);
      ctx.fillRect(17, 24, 4, 5);

      if (jobClass === 'dragoon') {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(24, 2, 2, 26);
      }

    } else {
      // SIDE VIEW ('E' or 'W')
      const flip = facing === 'W';
      ctx.save();
      if (flip) {
        ctx.translate(32, 0);
        ctx.scale(-1, 1);
      }

      if (jobClass === 'black_mage' || jobClass === 'time_mage') {
        ctx.fillStyle = jobClass === 'time_mage' ? '#be123c' : '#b45309';
        ctx.beginPath();
        ctx.moveTo(13, 2);
        ctx.lineTo(9, 14);
        ctx.lineTo(23, 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = subColor;
        ctx.fillRect(8, 13, 16, 3);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(13, 16, 8, 6);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(18, 17, 2, 2);
      } else if (jobClass === 'dragoon') {
        ctx.fillStyle = mainColor;
        ctx.fillRect(10, 5, 10, 11);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(7, 4, 3, 5);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(16, 9, 4, 3);
      } else if (jobClass === 'ninja') {
        ctx.fillStyle = mainColor;
        ctx.fillRect(10, 5, 10, 11);
        ctx.fillStyle = skin;
        ctx.fillRect(15, 9, 4, 3);
      } else {
        ctx.fillStyle = hairColor;
        ctx.fillRect(10, 6, 9, 7);
        ctx.fillStyle = skin;
        ctx.fillRect(15, 10, 5, 6);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(18, 12, 2, 2);
      }

      ctx.fillStyle = mainColor;
      ctx.fillRect(11, 16, 9, 8);
      ctx.fillStyle = subColor;
      ctx.fillRect(11, 21, 9, 2);

      ctx.fillStyle = '#334155';
      ctx.fillRect(11, 24, 4, 5);
      ctx.fillRect(16, 24, 4, 5);

      if (jobClass === 'dragoon') {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(22, 2, 2, 26);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(21, 0, 4, 5);
      } else if (jobClass === 'ninja') {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(20, 14, 2, 9);
      } else if (jobClass === 'knight' || jobClass === 'squire') {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(20, 11, 2, 13);
      }

      ctx.restore();
    }
  });

  unitSpriteTextureCache.set(cacheKey, texture);
  return texture;
}
