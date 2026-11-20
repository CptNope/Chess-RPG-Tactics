import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TerrainType } from '../core/types';

/**
 * Tile materials with small shader upgrades injected into Three's built-in Lambert/Phong
 * shaders (onBeforeCompile), so lights, shadows and fog keep working:
 *
 * - Top faces: darkened bevel at the tile edge, so the grid reads without drawing lines.
 * - Side faces: ambient occlusion toward the ground and a lit lip under the top edge.
 * - Water: world-space flowing UVs (seamless across tiles), sun glints that bloom on High.
 * - Swamp: slow murky swirl and rising bubble glints.
 *
 * All animated materials share one `uTime` uniform, advanced by `tick()`.
 */

export const sharedTime = { value: 0 };

type Kind = 'top' | 'side' | 'water' | 'swamp';

function inject(mat: THREE.Material, kind: Kind): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTileWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTileWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');

    let frag = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vTileWorld;\nuniform float uTime;\nfloat tileHash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }'
    );

    if (kind === 'top') {
      frag = frag.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec2 tl = fract(vTileWorld.xz + 0.5);
        float edge = min(min(tl.x, 1.0 - tl.x), min(tl.y, 1.0 - tl.y));
        diffuseColor.rgb *= mix(0.62, 1.0, smoothstep(0.0, 0.07, edge));`
      );
    } else if (kind === 'side') {
      frag = frag.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float ao = smoothstep(-0.1, 1.4, vTileWorld.y);
        diffuseColor.rgb *= mix(0.45, 1.0, ao);`
      );
    } else if (kind === 'water') {
      frag = frag.replace(
        '#include <map_fragment>',
        `vec2 flow = vTileWorld.xz * 0.5 + vec2(uTime * 0.045, uTime * 0.03);
        flow += vec2(sin(uTime * 0.9 + vTileWorld.z * 2.3), cos(uTime * 0.7 + vTileWorld.x * 2.1)) * 0.035;
        vec4 waterTexel = texture2D(map, flow);
        diffuseColor *= waterTexel;
        vec2 cell = floor(vTileWorld.xz * 14.0);
        float glint = step(0.992, tileHash(cell + floor(uTime * 1.6)));
        diffuseColor.rgb += glint * vec3(0.9, 0.95, 1.0);
        vec2 tl = fract(vTileWorld.xz + 0.5);
        float edge = min(min(tl.x, 1.0 - tl.x), min(tl.y, 1.0 - tl.y));
        diffuseColor.rgb = mix(diffuseColor.rgb * 0.8, diffuseColor.rgb, smoothstep(0.0, 0.05, edge));`
      );
    } else {
      frag = frag.replace(
        '#include <map_fragment>',
        `vec2 swirl = vTileWorld.xz * 0.5 + vec2(sin(uTime * 0.25 + vTileWorld.z) * 0.04, cos(uTime * 0.2 + vTileWorld.x) * 0.04);
        vec4 swampTexel = texture2D(map, swirl);
        diffuseColor *= swampTexel;
        vec2 cell = floor(vTileWorld.xz * 9.0);
        float phase = fract(uTime * 0.35 + tileHash(cell) * 7.0);
        float bubble = step(0.988, tileHash(cell)) * smoothstep(0.0, 0.2, phase) * (1.0 - smoothstep(0.6, 1.0, phase));
        diffuseColor.rgb += bubble * vec3(0.25, 0.45, 0.18);`
      );
    }
    shader.fragmentShader = frag;
  };
  mat.customProgramCacheKey = () => `tile-${kind}`;
}

function lambert(map: THREE.Texture, kind: Kind, extra: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ map, ...extra });
  inject(m, kind);
  return m;
}

export interface TerrainTextures {
  grass: THREE.Texture;
  dirt: THREE.Texture;
  stone: THREE.Texture;
  parapet: THREE.Texture;
  water: THREE.Texture;
  swamp: THREE.Texture;
}

/** Builds one top + one side material per terrain. */
export function createTileMaterials(t: TerrainTextures): Record<TerrainType, { top: THREE.Material; side: THREE.Material }> {
  for (const tex of Object.values(t)) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
  }

  const waterTop = new THREE.MeshPhongMaterial({ map: t.water, transparent: true, opacity: 0.88, shininess: 90, specular: 0x9fd8ff });
  inject(waterTop, 'water');
  const swampTop = new THREE.MeshPhongMaterial({ map: t.swamp, transparent: true, opacity: 0.94, shininess: 30, specular: 0x4a6a3a });
  inject(swampTop, 'swamp');

  const dirtSide = lambert(t.dirt, 'side');
  return {
    grass: { top: lambert(t.grass, 'top'), side: dirtSide },
    dirt: { top: lambert(t.dirt, 'top'), side: dirtSide },
    wood: { top: lambert(t.dirt, 'top', { color: 0xc8a070 }), side: lambert(t.dirt, 'side', { color: 0xa07850 }) },
    stone: { top: lambert(t.stone, 'top'), side: lambert(t.stone, 'side') },
    parapet: { top: lambert(t.parapet, 'top'), side: lambert(t.parapet, 'side') },
    water: { top: waterTop, side: lambert(t.water, 'side', { color: 0x9ab8d8 }) },
    swamp: { top: swampTop, side: lambert(t.swamp, 'side') }
  };
}

/**
 * Box geometry for a tile column whose side UVs repeat once per world unit of height
 * (anchored at the top edge), so tall cliffs show stacked rock instead of a stretched texture.
 */
export function createTileGeometry(height: number): THREE.BoxGeometry {
  const geom = new THREE.BoxGeometry(1, height, 1);
  const uv = geom.attributes.uv as THREE.BufferAttribute;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 vertices each)
  const sideFaces = [0, 1, 4, 5];
  for (const f of sideFaces) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setY(i, 1 - (1 - uv.getY(i)) * height);
    }
  }
  uv.needsUpdate = true;
  return geom;
}

/** Copies the triangles of the given BoxGeometry groups into a new non-indexed geometry. */
function extractGroups(src: THREE.BufferGeometry, groupIdx: number[]): THREE.BufferGeometry {
  const index = src.index!;
  const attrs = ['position', 'normal', 'uv'] as const;
  const out: Record<string, number[]> = { position: [], normal: [], uv: [] };
  for (const g of groupIdx) {
    const grp = src.groups[g];
    for (let i = grp.start; i < grp.start + grp.count; i++) {
      const vi = index.getX(i);
      for (const a of attrs) {
        const attr = src.attributes[a] as THREE.BufferAttribute;
        for (let k = 0; k < attr.itemSize; k++) out[a].push(attr.array[vi * attr.itemSize + k] as number);
      }
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(out.normal, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  return geom;
}

/**
 * Builds the whole battlefield as one mesh per material (about a dozen draw calls instead of
 * six per tile). Bottom faces are dropped since the camera never sees them.
 */
export function buildMergedTerrain(
  tiles: { x: number; z: number; height: number; terrain: TerrainType }[],
  mats: Record<TerrainType, { top: THREE.Material; side: THREE.Material }>
): THREE.Mesh[] {
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const add = (m: THREE.Material, g: THREE.BufferGeometry) => {
    if (!buckets.has(m)) buckets.set(m, []);
    buckets.get(m)!.push(g);
  };
  for (const t of tiles) {
    const h = Math.max(0.2, t.height);
    const box = createTileGeometry(h);
    box.translate(t.x, h / 2, t.z);
    const m = mats[t.terrain] || mats.grass;
    add(m.top, extractGroups(box, [2]));
    add(m.side, extractGroups(box, [0, 1, 4, 5]));
    box.dispose();
  }
  const meshes: THREE.Mesh[] = [];
  for (const [mat, geoms] of buckets) {
    const merged = mergeGeometries(geoms)!;
    geoms.forEach((g) => g.dispose());
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }
  return meshes;
}
