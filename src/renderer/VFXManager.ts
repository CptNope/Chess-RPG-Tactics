import * as THREE from 'three';

interface ActiveParticle {
  mesh: THREE.Points | THREE.Mesh | THREE.Line;
  velocities?: Float32Array;
  lifetime: number;
  maxLifetime: number;
  light?: THREE.PointLight;
  update: (delta: number) => boolean;
}

export class VFXManager {
  private scene: THREE.Scene;
  private activeEffects: ActiveParticle[] = [];

  // Ambient Weather / Atmospheric Particles
  private ambientParticles: THREE.Points | null = null;
  private ambientPositions: Float32Array | null = null;
  private ambientCount: number = 200;
  public currentTheme: 'day' | 'night' | 'swamp' = 'day';

  // Camera Trauma / Shake
  public cameraTrauma: number = 0;
  public cameraShakeOffset: THREE.Vector3 = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initAmbientParticles('day');
  }

  public setWeatherTheme(theme: 'day' | 'night' | 'swamp'): void {
    this.currentTheme = theme;
    if (this.ambientParticles) {
      this.scene.remove(this.ambientParticles);
      this.ambientParticles.geometry.dispose();
      (this.ambientParticles.material as THREE.Material).dispose();
      this.ambientParticles = null;
    }
    this.initAmbientParticles(theme);
  }

  private initAmbientParticles(theme: 'day' | 'night' | 'swamp'): void {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(this.ambientCount * 3);
    const colors = new Float32Array(this.ambientCount * 3);

    let baseColor = new THREE.Color(0xfef08a); // Golden pollen / leaves for day
    if (theme === 'night') {
      baseColor = new THREE.Color(0x60a5fa); // Night motes / glowing embers
    } else if (theme === 'swamp') {
      baseColor = new THREE.Color(0x34d399); // Toxic green spores
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
      size: theme === 'night' ? 0.25 : 0.2,
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

  public spawnSlashFX(pos: THREE.Vector3): void {
    // 1. Slashing energy arc
    const arcGeom = new THREE.RingGeometry(0.2, 0.7, 16, 1, 0, Math.PI * 0.8);
    const arcMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const arcMesh = new THREE.Mesh(arcGeom, arcMat);
    arcMesh.position.copy(pos);
    arcMesh.position.y += 0.6;
    arcMesh.rotation.x = Math.PI / 4;
    arcMesh.rotation.y = Math.random() * Math.PI;
    this.scene.add(arcMesh);

    // 2. Spark particles
    const sparkCount = 20;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(sparkCount * 3);
    const velocities = new Float32Array(sparkCount * 3);

    for (let i = 0; i < sparkCount; i++) {
      positions[i * 3 + 0] = pos.x;
      positions[i * 3 + 1] = pos.y + 0.6;
      positions[i * 3 + 2] = pos.z;

      velocities[i * 3 + 0] = (Math.random() - 0.5) * 4;
      velocities[i * 3 + 1] = Math.random() * 3 + 1;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfde047,
      size: 0.22,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });
    const sparks = new THREE.Points(geom, mat);
    this.scene.add(sparks);

    let age = 0;
    this.activeEffects.push({
      mesh: sparks,
      velocities,
      lifetime: 0,
      maxLifetime: 20,
      update: (delta) => {
        age += delta;
        arcMesh.rotation.z += 0.2;
        arcMesh.scale.multiplyScalar(1.05);
        (arcMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - age / 0.35);

        const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < sparkCount; i++) {
          posAttr.setX(i, posAttr.getX(i) + velocities[i * 3 + 0] * delta);
          posAttr.setY(i, posAttr.getY(i) + velocities[i * 3 + 1] * delta);
          posAttr.setZ(i, posAttr.getZ(i) + velocities[i * 3 + 2] * delta);
          velocities[i * 3 + 1] -= 9.8 * delta; // gravity
        }
        posAttr.needsUpdate = true;
        mat.opacity = Math.max(0, 1 - age / 0.35);

        if (age >= 0.35) {
          this.scene.remove(arcMesh);
          arcGeom.dispose();
          arcMat.dispose();
          return false;
        }
        return true;
      }
    });

    this.triggerScreenShake(0.35);
  }

  public spawnFireFX(pos: THREE.Vector3): void {
    const fireCount = 40;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(fireCount * 3);
    const colors = new Float32Array(fireCount * 3);
    const velocities = new Float32Array(fireCount * 3);

    for (let i = 0; i < fireCount; i++) {
      positions[i * 3 + 0] = pos.x + (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 1] = pos.y + 0.2;
      positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.4;

      velocities[i * 3 + 0] = (Math.random() - 0.5) * 2;
      velocities[i * 3 + 1] = Math.random() * 4 + 2;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 2;

      colors[i * 3 + 0] = 1.0;
      colors[i * 3 + 1] = Math.random() * 0.6 + 0.2; // Red-orange to yellow
      colors[i * 3 + 2] = 0.05;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geom, mat);
    this.scene.add(points);

    // Warm dramatic fire flare light
    const light = new THREE.PointLight(0xf97316, 3.5, 6);
    light.position.set(pos.x, pos.y + 1.2, pos.z);
    this.scene.add(light);

    let age = 0;
    this.activeEffects.push({
      mesh: points,
      velocities,
      lifetime: 0,
      maxLifetime: 30,
      light,
      update: (delta) => {
        age += delta;
        const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < fireCount; i++) {
          posAttr.setX(i, posAttr.getX(i) + velocities[i * 3 + 0] * delta);
          posAttr.setY(i, posAttr.getY(i) + velocities[i * 3 + 1] * delta);
          posAttr.setZ(i, posAttr.getZ(i) + velocities[i * 3 + 2] * delta);
        }
        posAttr.needsUpdate = true;
        mat.opacity = Math.max(0, 1 - age / 0.55);
        light.intensity = Math.max(0, 3.5 * (1 - age / 0.55));

        return age < 0.55;
      }
    });

    this.triggerScreenShake(0.45);
  }

  public spawnIceFX(pos: THREE.Vector3): void {
    // Frost spike crystal pillar
    const geom = new THREE.ConeGeometry(0.4, 1.6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      wireframe: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const spike = new THREE.Mesh(geom, mat);
    spike.position.set(pos.x, pos.y + 0.8, pos.z);
    this.scene.add(spike);

    const light = new THREE.PointLight(0x60a5fa, 3.0, 5);
    light.position.set(pos.x, pos.y + 1.0, pos.z);
    this.scene.add(light);

    let age = 0;
    this.activeEffects.push({
      mesh: spike,
      lifetime: 0,
      maxLifetime: 30,
      light,
      update: (delta) => {
        age += delta;
        spike.rotation.y += 0.15;
        spike.scale.x = 1 + age * 0.8;
        spike.scale.z = 1 + age * 0.8;
        mat.opacity = Math.max(0, 1 - age / 0.5);
        light.intensity = Math.max(0, 3.0 * (1 - age / 0.5));
        return age < 0.5;
      }
    });

    this.triggerScreenShake(0.3);
  }

  public spawnLightningFX(pos: THREE.Vector3): void {
    // Jagged vertical lightning bolt points
    const points: THREE.Vector3[] = [];
    const topY = pos.y + 7.0;
    let cur = new THREE.Vector3(pos.x, topY, pos.z);
    points.push(cur.clone());

    while (cur.y > pos.y + 0.3) {
      cur.y -= 0.6;
      cur.x += (Math.random() - 0.5) * 0.6;
      cur.z += (Math.random() - 0.5) * 0.6;
      points.push(cur.clone());
    }
    points.push(new THREE.Vector3(pos.x, pos.y + 0.1, pos.z));

    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xfef08a,
      linewidth: 3,
      blending: THREE.AdditiveBlending
    });
    const bolt = new THREE.Line(geom, lineMat);
    this.scene.add(bolt);

    const light = new THREE.PointLight(0xfef08a, 5.0, 8);
    light.position.set(pos.x, pos.y + 1.5, pos.z);
    this.scene.add(light);

    let age = 0;
    this.activeEffects.push({
      mesh: bolt,
      lifetime: 0,
      maxLifetime: 20,
      light,
      update: (delta) => {
        age += delta;
        lineMat.opacity = Math.max(0, 1 - age / 0.35);
        light.intensity = Math.max(0, 5.0 * (1 - age / 0.35));
        return age < 0.35;
      }
    });

    this.triggerScreenShake(0.6); // Big shake on lightning!
  }

  public spawnHolyFX(pos: THREE.Vector3): void {
    // Swirling ascending golden ring of light
    const geom = new THREE.TorusGeometry(0.65, 0.08, 8, 24);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(geom, mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(pos.x, pos.y + 0.1, pos.z);
    this.scene.add(ring);

    const light = new THREE.PointLight(0xfde047, 2.8, 5);
    light.position.set(pos.x, pos.y + 1.2, pos.z);
    this.scene.add(light);

    let age = 0;
    this.activeEffects.push({
      mesh: ring,
      lifetime: 0,
      maxLifetime: 35,
      light,
      update: (delta) => {
        age += delta;
        ring.position.y += delta * 2.5; // Ascend upward
        ring.rotation.z += 0.2;
        ring.scale.multiplyScalar(0.98);
        mat.opacity = Math.max(0, 1 - age / 0.65);
        light.intensity = Math.max(0, 2.8 * (1 - age / 0.65));
        return age < 0.65;
      }
    });
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

    // 2. Update Active Spell / Slash VFX
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeEffects[i];
      const isAlive = effect.update(delta);
      if (!isAlive) {
        this.scene.remove(effect.mesh);
        if (effect.mesh.geometry) effect.mesh.geometry.dispose();
        if (effect.light) {
          this.scene.remove(effect.light);
        }
        this.activeEffects.splice(i, 1);
      }
    }

    // 3. Update Camera Shake / Trauma Decay
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
