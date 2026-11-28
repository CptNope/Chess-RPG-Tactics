import * as THREE from 'three';

/**
 * Per-battlefield lighting and sky. Each preset sets a painted gradient sky, distance fog,
 * hemisphere (sky/ground bounce) light, a key "sun" and a cool rim light. Night maps also
 * place flickering torches.
 */
export interface AtmospherePreset {
  skyTop: string;
  skyHorizon: string;
  skyBottom: string;
  stars: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sunColor: number;
  sunIntensity: number;
  sunDir: [number, number, number];
  rimColor: number;
  rimIntensity: number;
  exposure: number;
  /** Bloom strength on High quality. */
  bloom: number;
  torchColor: number;
}

export const ATMOSPHERES: Record<string, AtmospherePreset> = {
  // Riverside Ruins: late-afternoon gold
  day: {
    skyTop: '#2b4a7a', skyHorizon: '#e9b77a', skyBottom: '#1a2236', stars: 0,
    fog: 0x8a7a68, fogNear: 44, fogFar: 92,
    hemiSky: 0xbfd8ff, hemiGround: 0x5a4630, hemiIntensity: 1.25,
    sunColor: 0xffe2b0, sunIntensity: 2.6, sunDir: [18, 34, 10],
    rimColor: 0x7fb2ff, rimIntensity: 0.55,
    exposure: 1.0, bloom: 0.35, torchColor: 0xffa040
  },
  // Night Battlement: moonlit blue, warm torches
  night: {
    skyTop: '#03050d', skyHorizon: '#1b2a4d', skyBottom: '#04060d', stars: 160,
    fog: 0x0b1428, fogNear: 44, fogFar: 92,
    hemiSky: 0x8aa6e8, hemiGround: 0x2a3348, hemiIntensity: 1.7,
    sunColor: 0xb4ccff, sunIntensity: 2.2, sunDir: [-14, 30, 16],
    rimColor: 0x8a7cff, rimIntensity: 0.6,
    exposure: 1.3, bloom: 0.75, torchColor: 0xff8a2a
  },
  // Gloomy Mire: green murk
  swamp: {
    skyTop: '#06140e', skyHorizon: '#3b5a3a', skyBottom: '#050c08', stars: 0,
    fog: 0x2c3f2c, fogNear: 44, fogFar: 92,
    hemiSky: 0xc7f0d4, hemiGround: 0x2c3a24, hemiIntensity: 1.3,
    sunColor: 0xe0f6c8, sunIntensity: 2.0, sunDir: [10, 30, -14],
    rimColor: 0x7ad3a0, rimIntensity: 0.5,
    exposure: 1.2, bloom: 0.5, torchColor: 0x9cff7a
  },
  // Saltglass Shore (0.34.0): white-hot noon over the sea
  saltglass_shore: {
    skyTop: '#2a6fb0', skyHorizon: '#f3d9a2', skyBottom: '#1d3550', stars: 0,
    fog: 0xc9b48a, fogNear: 46, fogFar: 96,
    hemiSky: 0xfff1d0, hemiGround: 0x8a6a3a, hemiIntensity: 1.35,
    sunColor: 0xfff0c8, sunIntensity: 2.9, sunDir: [10, 38, 14],
    rimColor: 0x8ad8ff, rimIntensity: 0.45,
    exposure: 1.0, bloom: 0.4, torchColor: 0xffa040
  },
  // Frostfang Pass (0.34.0): cold grey light and blowing snow
  frostfang_pass: {
    skyTop: '#3a4a66', skyHorizon: '#c8d4e4', skyBottom: '#1c2433', stars: 0,
    fog: 0xa8b6c8, fogNear: 40, fogFar: 88,
    hemiSky: 0xe0ecff, hemiGround: 0x5a6478, hemiIntensity: 1.4,
    sunColor: 0xe8f0ff, sunIntensity: 2.2, sunDir: [-12, 32, 16],
    rimColor: 0x9fc8ff, rimIntensity: 0.6,
    exposure: 1.05, bloom: 0.45, torchColor: 0xffa040
  },
  // The Drowned City (0.35.0): pale towers under a green moon, the sea's light still in the stone
  drowned_city: {
    skyTop: '#06121c', skyHorizon: '#2c6f6a', skyBottom: '#030a10', stars: 140,
    fog: 0x1d4a4f, fogNear: 34, fogFar: 82,
    hemiSky: 0x9fe8dc, hemiGround: 0x16303a, hemiIntensity: 1.1,
    sunColor: 0xc8fff0, sunIntensity: 1.5, sunDir: [-8, 34, 10],
    rimColor: 0x5fd3c6, rimIntensity: 0.9,
    exposure: 1.05, bloom: 0.75, torchColor: 0x5fd3c6
  },
  // Cinder Caldera (0.48.0): smoke-red sky, ash haze, the ground's glow carrying the light
  cinder_caldera: {
    skyTop: '#1a0704', skyHorizon: '#8a2f12', skyBottom: '#0c0402', stars: 30,
    fog: 0x3a160c, fogNear: 34, fogFar: 84,
    hemiSky: 0xffb08a, hemiGround: 0x3a1a10, hemiIntensity: 1.15,
    sunColor: 0xffc08a, sunIntensity: 1.7, sunDir: [10, 30, 14],
    rimColor: 0xff7a3a, rimIntensity: 0.9,
    exposure: 1.05, bloom: 0.8, torchColor: 0xff8a3a
  },
  // Zodiac Summit: violet aurora above the clouds
  zodiac_summit: {
    skyTop: '#0a0420', skyHorizon: '#5b2a7a', skyBottom: '#120a24', stars: 240,
    fog: 0x2a1a44, fogNear: 44, fogFar: 92,
    hemiSky: 0xb8a8ff, hemiGround: 0x2a2040, hemiIntensity: 1.4,
    sunColor: 0xe6dcff, sunIntensity: 2.2, sunDir: [12, 32, 18],
    rimColor: 0xff7ad9, rimIntensity: 0.5,
    exposure: 1.1, bloom: 0.9, torchColor: 0xb889ff
  }
};

export function presetFor(mapId: string, theme: string): AtmospherePreset {
  return ATMOSPHERES[mapId] || ATMOSPHERES[theme] || ATMOSPHERES.day;
}

/** Paints a vertical gradient sky (with optional stars) into a texture used as scene.background. */
export function createSkyTexture(p: AtmospherePreset): THREE.CanvasTexture {
  const big = document.createElement('canvas');
  big.width = 512;
  big.height = 512;
  const ctx = big.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, p.skyTop);
  g.addColorStop(0.62, p.skyHorizon);
  g.addColorStop(1, p.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);

  // Deterministic star field (same sky every load)
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < p.stars; i++) {
    const x = rnd() * 512;
    const y = rnd() * 300;
    const b = 0.35 + rnd() * 0.65;
    ctx.fillStyle = `rgba(255,255,255,${b * (1 - y / 340)})`;
    const s = rnd() < 0.08 ? 2 : 1;
    ctx.fillRect(Math.round(x), Math.round(y), s, s);
  }
  const tex = new THREE.CanvasTexture(big);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
