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
    // Base green
    ctx.fillStyle = '#4f9437';
    ctx.fillRect(0, 0, 16, 16);

    // Darker green patches
    ctx.fillStyle = '#3d7829';
    const darkPixels = [[2, 3], [3, 3], [7, 8], [8, 8], [8, 9], [13, 2], [14, 2], [1, 12], [2, 12], [11, 13]];
    darkPixels.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));

    // Lighter highlight green blades
    ctx.fillStyle = '#6ab848';
    const lightPixels = [[3, 2], [7, 7], [13, 1], [1, 11], [12, 12], [5, 14], [10, 5], [9, 4]];
    lightPixels.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));

    // Dark grid edge for tactical definition
    ctx.strokeStyle = '#2b581b';
    ctx.strokeRect(0, 0, 16, 16);
  });
}

export function createDirtSideTexture(): THREE.CanvasTexture {
  return createPixelTexture(16, 16, (ctx) => {
    // Rich earthy brown
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(0, 0, 16, 16);

    // Darker pebbles
    ctx.fillStyle = '#59391e';
    const dark = [[2, 4], [3, 4], [7, 10], [12, 6], [13, 6], [4, 13], [9, 14]];
    dark.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));

    // Lighter sand grains
    ctx.fillStyle = '#9e6d42';
    const light = [[5, 2], [10, 8], [1, 9], [14, 11], [8, 3]];
    light.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));

    // Top grass overhang
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

    // Mortar lines
    ctx.fillStyle = '#474b50';
    ctx.fillRect(0, 7, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(8, 0, 1, 7);
    ctx.fillRect(4, 8, 1, 7);
    ctx.fillRect(12, 8, 1, 7);

    // Stone highlights
    ctx.fillStyle = '#9aa1a8';
    ctx.fillRect(1, 1, 6, 1);
    ctx.fillRect(9, 1, 6, 1);
    ctx.fillRect(5, 9, 6, 1);
    ctx.fillRect(13, 9, 2, 1);

    // Border grid
    ctx.strokeStyle = '#32363a';
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

// Procedural 32x32 Character Pixel Art Sprites
export function createUnitSpriteTexture(jobClass: string, facing: FacingDirection, isEnemy: boolean = false): THREE.CanvasTexture {
  return createPixelTexture(32, 32, (ctx) => {
    // Clear transparent
    ctx.clearRect(0, 0, 32, 32);

    // Palette setups
    const skin = '#fcd34d';
    const hairColor = jobClass === 'knight' ? '#475569' : jobClass === 'black_mage' ? '#1e1b4b' : '#b45309';
    let mainColor = isEnemy ? '#dc2626' : '#2563eb';
    let subColor = isEnemy ? '#991b1b' : '#1d4ed8';

    if (jobClass === 'knight') {
      mainColor = isEnemy ? '#7f1d1d' : '#64748b';
      subColor = isEnemy ? '#450a0a' : '#334155';
    } else if (jobClass === 'white_mage') {
      mainColor = '#f8fafc';
      subColor = isEnemy ? '#dc2626' : '#ef4444'; // Red triangular hems
    } else if (jobClass === 'archer') {
      mainColor = isEnemy ? '#991b1b' : '#15803d';
      subColor = isEnemy ? '#7f1d1d' : '#166534';
    } else if (jobClass === 'black_mage') {
      mainColor = isEnemy ? '#581c87' : '#312e81';
      subColor = '#f59e0b'; // Gold belt/brim
    }

    // Shadow on the ground underneath sprite
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(16, 29, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw sprite body based on facing: Front ('S'), Back ('N'), or Sides ('E'/'W')
    if (facing === 'S') {
      // Front View
      // Head / Hair
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
        // Shadow face with glowing yellow eyes
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(10, 16, 12, 6);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(12, 17, 2, 2);
        ctx.fillRect(18, 17, 2, 2);
      } else {
        // Standard Head & Hair
        ctx.fillStyle = hairColor;
        ctx.fillRect(11, 6, 10, 6);
        ctx.fillStyle = skin;
        ctx.fillRect(12, 9, 8, 7);
        // Eyes
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(13, 12, 2, 2);
        ctx.fillRect(17, 12, 2, 2);
      }

      // Torso / Tunic / Armor
      ctx.fillStyle = mainColor;
      ctx.fillRect(10, 16, 12, 8);
      // Detail / Belt
      ctx.fillStyle = subColor;
      ctx.fillRect(11, 21, 10, 2);

      // Legs / Boots
      ctx.fillStyle = '#334155';
      ctx.fillRect(11, 24, 4, 5);
      ctx.fillRect(17, 24, 4, 5);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(10, 27, 5, 2);
      ctx.fillRect(17, 27, 5, 2);

      // Weapon / Hands
      if (jobClass === 'knight' || jobClass === 'squire') {
        // Sword in hand
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(23, 10, 2, 14);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(21, 22, 6, 2);
      } else if (jobClass === 'archer') {
        // Wooden bow
        ctx.fillStyle = '#78350f';
        ctx.fillRect(6, 11, 2, 13);
        ctx.fillRect(7, 9, 2, 2);
        ctx.fillRect(7, 23, 2, 2);
      } else if (jobClass === 'white_mage' || jobClass === 'black_mage') {
        // Wooden / golden staff
        ctx.fillStyle = jobClass === 'white_mage' ? '#f59e0b' : '#78350f';
        ctx.fillRect(23, 8, 2, 18);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(22, 6, 4, 4);
      }

    } else if (facing === 'N') {
      // Back View
      if (jobClass === 'black_mage') {
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.moveTo(16, 2);
        ctx.lineTo(8, 14);
        ctx.lineTo(24, 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(7, 13, 18, 3);
      } else {
        ctx.fillStyle = hairColor;
        ctx.fillRect(11, 6, 10, 9);
      }

      // Cape / Back Armor
      ctx.fillStyle = subColor;
      ctx.fillRect(9, 15, 14, 9);

      // Legs
      ctx.fillStyle = '#334155';
      ctx.fillRect(11, 24, 4, 5);
      ctx.fillRect(17, 24, 4, 5);

    } else {
      // Side View ('E' or 'W')
      const flip = facing === 'W';
      ctx.save();
      if (flip) {
        ctx.translate(32, 0);
        ctx.scale(-1, 1);
      }

      // Hair & Profile
      if (jobClass === 'black_mage') {
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.moveTo(13, 2);
        ctx.lineTo(9, 14);
        ctx.lineTo(23, 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(8, 13, 16, 3);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(13, 16, 8, 6);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(18, 17, 2, 2);
      } else {
        ctx.fillStyle = hairColor;
        ctx.fillRect(10, 6, 9, 7);
        ctx.fillStyle = skin;
        ctx.fillRect(15, 10, 5, 6);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(18, 12, 2, 2); // Side eye
      }

      // Torso
      ctx.fillStyle = mainColor;
      ctx.fillRect(11, 16, 9, 8);
      ctx.fillStyle = subColor;
      ctx.fillRect(11, 21, 9, 2);

      // Walking Stance Legs
      ctx.fillStyle = '#334155';
      ctx.fillRect(11, 24, 4, 5);
      ctx.fillRect(16, 24, 4, 5);

      // Weapon held forward
      if (jobClass === 'knight' || jobClass === 'squire') {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(20, 11, 2, 13);
      }

      ctx.restore();
    }
  });
}
