import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapData } from '../data/maps';
import { sharedTime } from './TileShading';

/**
 * Small set dressing: grass tufts, swamp reeds and pebbles. Each kind is a single
 * InstancedMesh (one draw call), placed deterministically per tile so a map always looks the
 * same, kept to the tile corners so units stay readable, and never raycast.
 */

function hash(x: number, z: number, i: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7 + i * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function bladeTexture(colors: string[], tall: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  const blades = tall ? 5 : 7;
  for (let b = 0; b < blades; b++) {
    const x = 1 + Math.round((b / blades) * 14);
    const h = tall ? 10 + (b % 3) * 2 : 5 + ((b * 7) % 5);
    ctx.fillStyle = colors[b % colors.length];
    for (let y = 0; y < h; y++) {
      const lean = Math.round(((b % 2 ? 1 : -1) * y * y) / 60);
      ctx.fillRect(x + lean, 15 - y, 1, 1);
    }
    if (tall && b % 2 === 0) {
      ctx.fillStyle = '#5b3a1a';
      ctx.fillRect(x - 1, 15 - h, 2, 3); // cattail head
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Two crossed quads, pivot at the base. */
function crossedQuads(w: number, h: number): THREE.BufferGeometry {
  const a = new THREE.PlaneGeometry(w, h);
  a.translate(0, h / 2, 0);
  const b = a.clone();
  b.rotateY(Math.PI / 2);
  return mergeGeometries([a, b])!;
}

function swayMaterial(map: THREE.Texture): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float phase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3;
        #else
          float phase = 0.0;
        #endif
        float sway = sin(uTime * 1.8 + phase) * 0.05 * position.y * 4.0;
        transformed.x += sway;
        transformed.z += sway * 0.5;`
      );
  };
  m.customProgramCacheKey = () => 'deco-sway';
  return m;
}

export class Decorations {
  public readonly group = new THREE.Group();
  private grassGeom = crossedQuads(0.32, 0.2);
  private reedGeom = crossedQuads(0.34, 0.5);
  private pebbleGeom = new THREE.IcosahedronGeometry(0.06, 0);
  private grassMat = swayMaterial(bladeTexture(['#4f8a2b', '#6aa83a', '#3e7024', '#86c24a'], false));
  private reedMat = swayMaterial(bladeTexture(['#4a6a2a', '#5d7d32', '#3b5422'], true));
  private pebbleMat = new THREE.MeshLambertMaterial({ color: 0x8a8578, flatShading: true });

  public rebuild(map: MapData, density: number, theme: string): void {
    this.clear();
    if (density <= 0) return;

    const grass: THREE.Matrix4[] = [];
    const reeds: THREE.Matrix4[] = [];
    const pebbles: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);

    // Corner offsets keep the middle of each tile clear for units and highlights
    const corners = [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32], [0, -0.36], [0.36, 0], [0, 0.36], [-0.36, 0]];

    for (const t of map.tiles) {
      const top = Math.max(0.2, t.height);
      const count = t.terrain === 'grass' ? 4 : t.terrain === 'swamp' ? 3 : t.terrain === 'stone' || t.terrain === 'dirt' || t.terrain === 'parapet' ? 2 : t.terrain === 'sand' || t.terrain === 'snow' ? 1 : 0;
      for (let i = 0; i < count; i++) {
        if (hash(t.x, t.z, i + 9) > density) continue;
        const [cx, cz] = corners[Math.floor(hash(t.x, t.z, i) * corners.length)];
        const jx = (hash(t.x, t.z, i + 3) - 0.5) * 0.12;
        const jz = (hash(t.x, t.z, i + 5) - 0.5) * 0.12;
        const s = 0.75 + hash(t.x, t.z, i + 7) * 0.6;
        q.setFromAxisAngle(up, hash(t.x, t.z, i + 11) * Math.PI);
        m.compose(new THREE.Vector3(t.x + cx + jx, top, t.z + cz + jz), q, new THREE.Vector3(s, s, s));
        if (t.terrain === 'grass') grass.push(m.clone());
        else if (t.terrain === 'swamp') reeds.push(m.clone());
        else if (hash(t.x, t.z, i + 13) > 0.45) pebbles.push(m.clone());
      }
    }

    const tint = theme === 'night' ? 0x8fa6d8 : theme === 'swamp' ? 0xa8c890 : 0xffffff;
    this.grassMat.color.setHex(tint);
    this.reedMat.color.setHex(tint);

    this.addInstanced(this.grassGeom, this.grassMat, grass, false);
    this.addInstanced(this.reedGeom, this.reedMat, reeds, false);
    this.addInstanced(this.pebbleGeom, this.pebbleMat, pebbles, true);
  }

  private addInstanced(geom: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[], castShadow: boolean): void {
    if (list.length === 0) return;
    const mesh = new THREE.InstancedMesh(geom, mat, list.length);
    list.forEach((mx, i) => mesh.setMatrixAt(i, mx));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.raycast = () => undefined; // decorations never block tile picking
    this.group.add(mesh);
  }

  public clear(): void {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      (child as THREE.InstancedMesh).dispose?.();
    }
  }
}
