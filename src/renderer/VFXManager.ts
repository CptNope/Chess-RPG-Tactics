import * as THREE from 'three';
import type { MapData } from '../data/maps';

/** Weather particles and camera shake. Spell and hit effects are pixel art (PixelEffects + BattleFx). */
export class VFXManager {
  private scene: THREE.Scene;

  // Ambient Weather / Atmospheric Particles
  private ambientParticles: THREE.Points | null = null;
  private ambientPositions: Float32Array | null = null;
  private ambientCount: number = 200;
  public currentTheme: MapData['theme'] = 'day';

  // Camera Trauma / Shake
  public cameraTrauma: number = 0;
  public cameraShakeOffset: THREE.Vector3 = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initAmbientParticles('day');
  }

  public setWeatherTheme(theme: MapData['theme']): void {
    this.currentTheme = theme;
    if (this.ambientParticles) {
      this.scene.remove(this.ambientParticles);
      this.ambientParticles.geometry.dispose();
      (this.ambientParticles.material as THREE.Material).dispose();
      this.ambientParticles = null;
    }
    this.initAmbientParticles(theme);
  }

  private initAmbientParticles(theme: MapData['theme']): void {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(this.ambientCount * 3);
    const colors = new Float32Array(this.ambientCount * 3);

    let baseColor = new THREE.Color(0xfef08a); // Golden pollen / leaves for day
    if (theme === 'night') {
      baseColor = new THREE.Color(0x60a5fa); // Night motes / glowing embers
    } else if (theme === 'swamp') {
      baseColor = new THREE.Color(0x34d399); // Toxic green spores
    } else if (theme === 'desert') {
      baseColor = new THREE.Color(0xf5deb3); // Blowing sand (0.34.0)
    } else if (theme === 'snow') {
      baseColor = new THREE.Color(0xf8fbff); // Snowflakes (0.34.0)
    }

    for (let i = 0; i < this.ambientCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 16 + 5;
      positions[i * 3 + 1] = Math.random() * 8 + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 16 + 5;

      const variance = (Math.random() - 0.5) * 0.2;
      colors[i * 3 + 0] = Math.min(1, Math.max(0, baseColor.r + variance));
      colors[i * 3 + 1] = Math.min(1, Math.max(0, baseColor.g + variance));
      colors[i * 3 + 2] = Math.min(1, Math.max(0, baseColor.b + variance));
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: theme === 'night' || theme === 'snow' ? 0.25 : 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.ambientParticles = new THREE.Points(geom, mat);
    this.ambientPositions = positions;
    this.scene.add(this.ambientParticles);
  }

  private reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  public triggerScreenShake(intensity: number = 0.5): void {
    if (this.reduceMotion) intensity *= 0.15;
    this.cameraTrauma = Math.min(1.0, this.cameraTrauma + intensity);
  }

  public update(delta: number): void {
    // 1. Update Ambient Floating Particles
    if (this.ambientParticles && this.ambientPositions) {
      const posAttr = this.ambientParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
      const count = this.ambientCount;
      const time = Date.now() * 0.001;

      for (let i = 0; i < count; i++) {
        let y = posAttr.getY(i) - delta * 0.45;
        let x = posAttr.getX(i) + Math.sin(time + i) * 0.008;
        let z = posAttr.getZ(i) + Math.cos(time + i) * 0.008;

        if (y < 0.2) {
          y = 8.0;
        }

        posAttr.setXYZ(i, x, y, z);
      }
      posAttr.needsUpdate = true;
    }

    // 2. Update Camera Shake / Trauma Decay
    if (this.cameraTrauma > 0) {
      const shakePower = Math.pow(this.cameraTrauma, 2) * 0.45;
      this.cameraShakeOffset.set(
        (Math.random() - 0.5) * shakePower,
        (Math.random() - 0.5) * shakePower,
        (Math.random() - 0.5) * shakePower
      );
      this.cameraTrauma = Math.max(0, this.cameraTrauma - delta * 2.2);
    } else {
      this.cameraShakeOffset.set(0, 0, 0);
    }
  }
}
