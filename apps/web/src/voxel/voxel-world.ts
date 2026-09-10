// @ts-nocheck
// Voxel World — full-map diorama (Option A): the ENTIRE 2D Spot map rendered
// as 1 tile = 1 voxel column, driven by the REAL terrain generator + live
// citizen snapshot. No build mode (dropped for now); orbit + observe.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getCityTileType, getCityProp, getDistrict } from '../world/terrain-generator.js';
import { WORLD_BANNERS } from '../world/banner-manager.js';
import { getSecretAt } from '../world/secrets.js';
import { AVATAR_CATALOG, drawAvatarOnCanvas, drawCustomAvatarOnCanvas } from '../canvas/avatars.js';
import { formatSocialUrl } from '@spot/shared';
import { fetchWorldSnapshot, searchCitizens, fetchSpotComments, postSpotComment } from '../api/client.js';

// World scale factor: 1 tile = 1 world unit, matching the 2D map 1:1 so flat
// terrain tiles seamlessly with no gaps between voxel columns.
const WORLD_SCALE = 1;
// Box inset for standalone props only (ground tiles always use full 1.0 so the
// surface stays continuous). 0.9 gives a subtle voxel read without big gaps.
const BOX_SCALE = 0.9;

const IS_MOBILE = (typeof window !== 'undefined') && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768);
const wrap = document.getElementById('voxel-spike');
const renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !IS_MOBILE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const DAY_BG = new THREE.Color(0x87b5e0);
scene.background = DAY_BG.clone();
scene.fog = new THREE.Fog(DAY_BG.clone(), 220, 640);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 4000);
camera.position.set(50 * WORLD_SCALE + 115, 95, 56 * WORLD_SCALE + 150);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(50 * WORLD_SCALE, 1, 56 * WORLD_SCALE);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 12;
controls.maxDistance = 600;
// AoE-style locked presentation: fixed isometric wedge — tilt + zoom + pan only.
// (Azimuth locks to the initial angle below; polar stays in the RTS band.)
controls.minPolarAngle = 0.7;
controls.maxPolarAngle = 1.2;
{
  const az0 = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
  // subtle 180° orbit wedge around the home angle — never spins behind the world
  controls.minAzimuthAngle = az0 - Math.PI / 2;
  controls.maxAzimuthAngle = az0 + Math.PI / 2;
}
// RTS edge-pan (disabled in walk mode)
let edgeMX = -1, edgeMY = -1, edgeInCanvas = false;
renderer.domElement.addEventListener('pointermove', (e) => {
  edgeMX = e.clientX; edgeMY = e.clientY; edgeInCanvas = true;
});
renderer.domElement.addEventListener('pointerleave', () => { edgeInCanvas = false; });
const _fwd = new THREE.Vector3();
const _rgt = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
function edgePan(dt) {
  if (walkMode || fpsMode || !edgeInCanvas) return;
  const EDGE = 16;
  const dl = edgeMX < EDGE ? -1 : 0, dr = edgeMX > window.innerWidth - EDGE ? 1 : 0;
  const du = edgeMY < EDGE ? -1 : 0, dd = edgeMY > window.innerHeight - EDGE ? 1 : 0;
  if (!dl && !dr && !du && !dd) return;
  _fwd.subVectors(controls.target, camera.position);
  _fwd.y = 0;
  _fwd.normalize();
  _rgt.crossVectors(_fwd, _up);
  const spd = camera.position.distanceTo(controls.target) * 0.18 * dt;
  const mx = (dr + dl) * spd, mz = (dd + du) * spd;
  const ox = _fwd.x * mz + _rgt.x * mx;
  const oz = _fwd.z * mz + _rgt.z * mx;
  controls.target.x = Math.max(-30, Math.min(130, controls.target.x + ox));
  controls.target.z = Math.max(-20, Math.min(135, controls.target.z + oz));
  camera.position.x += ox;
  camera.position.z += oz;
}
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; }, { once: true });

const hemi = new THREE.HemisphereLight(0xcfe5ff, 0x4a4234, 0.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3e0, 1.5);
sun.position.set(140, 160, 60);
sun.castShadow = !IS_MOBILE;
sun.shadow.mapSize.set(IS_MOBILE ? 1024 : 2048, IS_MOBILE ? 1024 : 2048);
sun.shadow.camera.left = -130; sun.shadow.camera.right = 130;
sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130;
sun.shadow.camera.far = 600;
sun.shadow.bias = -0.0006;
scene.add(sun);

// warm torch point lights (no shadows — cheap mood lighting)
const torches = [];
function addTorch(wx, wy, wz, color, intensity, dist) {
  const L = new THREE.PointLight(color, intensity, dist, 2);
  L.position.set(wx, wy, wz);
  scene.add(L);
  torches.push({ light: L, base: intensity, ph: Math.random() * 10 });
}
addTorch(50, 5, 50, 0xffb066, 140, 34);
addTorch(30, 5, 95, 0xffb066, 100, 28);
addTorch(4, 6, 106, 0x67e8f9, 90, 26);
addTorch(60, 5, 38, 0xffc861, 80, 26);
addTorch(50, 5, 105, 0xff8a3e, 110, 30);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(6000, 6000),
  new THREE.MeshStandardMaterial({ color: 0x0e1626, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(50 * WORLD_SCALE, -0.06, 56 * WORLD_SCALE);
ground.receiveShadow = true;
scene.add(ground);

// ---------- procedural pixel textures (16x16, Minecraft-style, zero assets) ----------
// White/gray value patterns — instance colors provide the hue on top.
let _seed = 1234567;
function srnd() { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; }
function grayTex(fn) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  const g = cv.getContext('2d');
  const img = g.createImageData(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const v = Math.max(0, Math.min(255, Math.round(fn(x, y))));
      const i = (y * 16 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function speckle(base, spread, n) {
  const dots = [];
  for (let i = 0; i < n; i++) dots.push([Math.floor(srnd() * 16), Math.floor(srnd() * 16), (srnd() - 0.5) * 2 * spread]);
  return (x, y) => {
    let v = base;
    for (const [dx, dy, dv] of dots) if (dx === x && dy === y) v += dv;
    return v + (srnd() - 0.5) * 8;
  };
}
const TEX = {
  top: grayTex(speckle(228, 26, 60)),
  grassSide: grayTex((x, y) => {
    const edge = 4 + Math.floor(srnd() * 3);
    if (y < edge) return 232 + (srnd() - 0.5) * 10;
    return 200 + (srnd() - 0.5) * 44;
  }),
  dirt: grayTex(speckle(208, 30, 80)),
  stone: grayTex((x, y) => {
    let v = 200 + (srnd() - 0.5) * 24;
    if ((x + y * 2) % 7 === 0) v -= 34;
    if ((x * 3 - y) % 11 === 0) v -= 22;
    return v;
  }),
  sand: grayTex(speckle(238, 14, 40)),
  woodSide: grayTex((x, y) => 205 + ((x % 4 < 2) ? 10 : -12) + (srnd() - 0.5) * 12),
  logTop: grayTex((x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    return 228 - (Math.floor(d) % 3 === 0 ? 34 : 0) + (srnd() - 0.5) * 8;
  }),
  plank: grayTex((x, y) => (y % 4 === 3 ? 150 : 218 + (srnd() - 0.5) * 12) - (((x === 3 || x === 12) && y % 4 !== 3) ? 18 : 0)),
  leaf: grayTex((x, y) => {
    const r = srnd();
    if (r < 0.24) return 108;
    if (r < 0.32) return 238;
    return 196 + (srnd() - 0.5) * 24;
  }),
  snow: grayTex(speckle(250, 8, 24)),
  roof: grayTex((x, y) => (y % 4 === 3 ? 148 : 216 + (srnd() - 0.5) * 14) - ((x + (y >> 2) * 4) % 8 === 0 ? 16 : 0)),
  brick: grayTex((x, y) => {
    const course = Math.floor(y / 4);
    const joint = y % 4 === 3 || (x + course * 4) % 8 === 0;
    return (joint ? 150 : 218) + (srnd() - 0.5) * 10;
  }),
  water: grayTex((x, y) => 218 + Math.sin(y * 0.8 + x * 0.2) * 14 + (srnd() - 0.5) * 10),
};
const stdMap = (tex, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: 0xffffff, roughness: 0.95, map: tex }, extra || {}));
const MAT_GRASS_TOP = stdMap(TEX.top);
const MAT_GRASS_SIDE = stdMap(TEX.grassSide);
const MAT_DIRT = stdMap(TEX.dirt);
const MAT_STONE = stdMap(TEX.stone);
const MAT_SAND = stdMap(TEX.sand);
const MAT_WOOD_SIDE = stdMap(TEX.woodSide);
const MAT_LOG_TOP = stdMap(TEX.logTop);
const MAT_PLANK = stdMap(TEX.plank);
const MAT_LEAF = stdMap(TEX.leaf);
const MAT_SNOW = stdMap(TEX.snow);
const MAT_ROOF = stdMap(TEX.roof);
const MAT_BRICK = stdMap(TEX.brick);
const MAT_PLAIN = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });

// ---------- deterministic hash (mirrors terrain-generator spatialHash) ----------
function hash2(gx, gy, salt) {
  let h = (gx * 73856093) ^ (gy * 19349663) ^ (salt * 83492791);
  h ^= h << 13; h ^= h >> 17; h ^= h << 5;
  return (h >>> 0) / 0x100000000;
}

// ---------- terrain → voxel columns ----------
const MIN_GX = -24, MAX_GX = 124, MIN_GY = -16, MAX_GY = 142;
const boxes = [];
const boxColors = [];
const glowBoxes = [];
const topH = new Map();
const topKey = (gx, gy) => gx + ',' + gy;
// Collision layers for walk/FPS: water is impassable, tree trunks are solid.
const waterTiles = new Set();
const solidProps = new Set();
function isBlocked(gx, gy) {
  const k = topKey(gx, gy);
  return waterTiles.has(k) || solidProps.has(k);
}

const ROCKS = [0x5b6472, 0x525b6b, 0x646e7e];

// Day surface palette — mirrors renderer.ts DAY_PALETTES so the voxel world
// reads with the same sunlit tones as the 2D map.
const P = {
  sidewalk: 0x7e8796,
  plazaG1: 0xa8aeba, plazaG2: 0x9aa2b0,
  terr1: 0xb8603e, terr2: 0xc9704a,
  zen1: 0x8f98a6, zen2: 0x9ca4b0,
  park1: 0x4a8a43, park2: 0x54994b,
  jungle1: 0x2c6f37, jungle2: 0x357f41, jungleD: 0x205a29,
  forest1: 0x377f45, forest2: 0x418d4f, forestD: 0x276235,
  sand1: 0xdcc795, sand2: 0xd0b987,
  board1: 0x7a4f2c, board2: 0x8a5c36,
  asphalt: 0x4a515e,
  waterPond: 0x2f8fc4, oceanDeep: 0x0e3a5c, oceanSurf: 0x2f9fd0,
  jungleCreek: 0x1c6f58, forestCreek: 0x3778a8,
};

// Organic 3x3-block two/three-tone mottling (port of renderer.ts groundPatch).
// Quantising to 3-tile blocks forms natural patches instead of a 1-tile
// checkerboard, so wide expanses of grass/pavement read as one surface.
function patchHex(gx, gy, salt, a, b, c) {
  let h = (Math.floor(gx / 3) * 374761393) ^ (Math.floor(gy / 3) * 668265263) ^ (salt * 2246822519);
  h = (h ^ (h >> 13)) * 1274126177;
  const n = ((h ^ (h >> 16)) >>> 0) / 4294967295;
  if (c !== undefined && n < 0.13) return c;
  return n < 0.58 ? a : b;
}

function pushBox(gx, y, gy, color) {
  boxes.push([gx, y, gy]);
  boxColors.push(color);
  const k = topKey(gx, gy);
  if (y + 1 > (topH.get(k) || 0)) topH.set(k, y + 1);
}
function pushGlow(gx, y, gy, color) {
  glowBoxes.push([gx, y, gy, color]);
  const k = topKey(gx, gy);
  if (y + 1 > (topH.get(k) || 0)) topH.set(k, y + 1);
}

const waterBoxes = [];
function pushWater(gx, y, gy, color) {
  waterBoxes.push([gx, y, gy, color]);
  const k = topKey(gx, gy);
  waterTiles.add(k);
  if (y + 1 > (topH.get(k) || 0)) topH.set(k, y + 1);
}
const foamBoxes = [];

// sub-block micro detail (stripes, rails, foam, windows). entries:
// [wx, yCenter, wz, sx, sy, sz, color] — decorative, never raises topH.
const detailBoxes = [];
const detailGlows = [];
function pushDetail(gx, yC, gy, sx, sy, sz, color) {
  detailBoxes.push([gx, yC, gy, sx, sy, sz, color]);
}
function pushDetailGlow(gx, yC, gy, sx, sy, sz, color) {
  detailGlows.push([gx, yC, gy, sx, sy, sz, color]);
}
// lit windows on a tower's south face
function windowsAt(gx, gy, base, h) {
  for (let wy = base + 1; wy < base + h; wy += 2) {
    pushDetailGlow(gx, wy + 0.5, gy + 0.5, 0.22, 0.3, 0.06, 0xffd9a0);
  }
}

// ---------------------------------------------------------------------------
// Asset geometry: real rounded/sloped shapes instead of plain cubes.
// Each bucket becomes ONE InstancedMesh, so thousands of trunks/leaves/roofs
// still cost a single draw call.
//   cylinder: [gx, yC, gy, radius, height, color]
//   cone:     [gx, yC, gy, radius, height, color, sides]
//   sphere:   [gx, yC, gy, radius, color]
//   slab:     [gx, yC, gy, sx, sz, color]  (thin rounded tile/leaf pad)
// ---------------------------------------------------------------------------
const cylinderItems = [];
const coneItems = [];
const sphereItems = [];
function pushCyl(gx, yC, gy, r, h, color) { cylinderItems.push([gx, yC, gy, r, h, color]); }
function pushCone(gx, yC, gy, r, h, color, sides) { coneItems.push([gx, yC, gy, r, h, color, sides || 7]); }
function pushSphere(gx, yC, gy, r, color) { sphereItems.push([gx, yC, gy, r, color]); }
function shade(hex, mul) {
  const c = new THREE.Color(hex).multiplyScalar(mul);
  return c.getHex();
}

// rotating lighthouse beams (animated per-frame)
const beams = [];

function buildTerrain() {
  for (let gx = MIN_GX; gx <= MAX_GX; gx++) {
    for (let gy = MIN_GY; gy <= MAX_GY; gy++) {
      let t = getCityTileType(gx, gy);
      // Voxel-only: widen the southern beach by 2 tiles (and push the surf out)
      // so the shoreline is roomier to roam.
      if (gy === 108 || gy === 109) t = 'beach_sand';
      else if (gy === 110 || gy === 111) t = 'ocean_surf';
      if (t === 'void') continue;
      const r1 = hash2(gx, gy, 7);
      const r2 = hash2(gx, gy, 77);
      switch (t) {
        case 'mountain_rock': {
          const h = 6 + Math.floor(r1 * 3);
          for (let y = 0; y < h; y++) pushBox(gx, y, gy, y === h - 1 ? ROCKS[Math.floor(r2 * 3)] : 0x3a4356);
          break;
        }
        case 'mountain_snow': {
          const h = 7 + Math.floor(r1 * 3);
          for (let y = 0; y < h; y++) pushBox(gx, y, gy, y === h - 1 ? 0xeef3fa : 0x3a4356);
          break;
        }
        case 'railway_ballast': {
          pushBox(gx, 0, gy, 0x3f3f46, 1);
          for (const rz of [-0.25, 0.25]) pushDetail(gx, 1.04, gy + rz, 1.0, 0.07, 0.09, 0xd6dae0);
          for (const sx of [-0.375, -0.125, 0.125, 0.375]) pushDetail(gx + sx, 1.02, gy, 0.12, 0.05, 0.7, 0x6f4522);
          break;
        }
        case 'road_asphalt': pushBox(gx, 0, gy, P.asphalt, 1); break;
        case 'road_h_stripe':
          pushBox(gx, 0, gy, P.asphalt, 1);
          if (gx % 2 === 0) pushDetail(gx, 1.03, gy, 0.6, 0.05, 0.13, 0xf8fafc);
          break;
        case 'road_v_stripe':
          pushBox(gx, 0, gy, P.asphalt, 1);
          if (gy % 2 === 0) pushDetail(gx, 1.03, gy, 0.13, 0.05, 0.6, 0xf8fafc);
          break;
        case 'crosswalk':
          pushBox(gx, 0, gy, P.asphalt, 1);
          for (const cx of [-0.25, 0, 0.25]) pushDetail(gx + cx, 1.03, gy, 0.14, 0.05, 0.8, 0xffffff);
          break;
        case 'sidewalk': pushBox(gx, 0, gy, patchHex(gx, gy, 910, P.sidewalk, P.sidewalk, 0x8a93a2), 1); break;
        case 'plaza_grand': pushBox(gx, 0, gy, patchHex(gx, gy, 904, P.plazaG1, P.plazaG2), 1); break;
        case 'plaza_terracotta': pushBox(gx, 0, gy, patchHex(gx, gy, 905, P.terr1, P.terr2), 1); break;
        case 'plaza_zen': pushBox(gx, 0, gy, patchHex(gx, gy, 906, P.zen1, P.zen2), 1); break;
        case 'park_grass':
          pushBox(gx, 0, gy, patchHex(gx, gy, 907, P.park1, P.park2, 0x5aa050), 1);
          break;
        case 'water_pond': pushWater(gx, 0, gy, P.waterPond); break;
        case 'jungle_grass':
        case 'forest_grass':
          pushBox(gx, 0, gy, patchHex(gx, gy, t === 'jungle_grass' ? 902 : 903,
            t === 'jungle_grass' ? P.jungle1 : P.forest1,
            t === 'jungle_grass' ? P.jungle2 : P.forest2), 1);
          break;
        case 'jungle_dense':
        case 'forest_dense': {
          pushBox(gx, 0, gy, t === 'jungle_dense' ? P.jungleD : P.forestD, 1);
          // Dense tiles are forest floor; the canopy is rendered as props on top.
          if (hash2(gx, gy, 66) > 0.65) {
            const leafColor = t === 'jungle_dense' ? 0x2c6f37 : 0x357f41;
            jungleTreeAt(gx, gy, 1, leafColor, 'dense');
          }
          break;
        }
        case 'jungle_creek': pushWater(gx, 0, gy, P.jungleCreek); break;
        case 'forest_creek': pushWater(gx, 0, gy, P.forestCreek); break;
        case 'boardwalk':
          pushBox(gx, 0, gy, patchHex(gx, gy, 909, P.board1, P.board2), 1);
          pushDetail(gx, 1.02, gy - 0.3, 1.0, 0.03, 0.05, 0x2a1a0e);
          pushDetail(gx, 1.02, gy + 0.3, 1.0, 0.03, 0.05, 0x2a1a0e);
          break;
        case 'beach_sand':
          pushBox(gx, 0, gy, gy >= 107
            ? patchHex(gx, gy, 901, 0x9c8560, 0x8f7a55)
            : patchHex(gx, gy, 901, P.sand1, P.sand2), 1);
          break;
        case 'ocean_surf': {
          pushWater(gx, 0, gy, P.oceanSurf);
          const isSand = (ax, ay) => {
            try { return getCityTileType(ax, ay) === 'beach_sand'; } catch { return false; }
          };
          if (isSand(gx + 1, gy) || isSand(gx - 1, gy) || isSand(gx, gy + 1) || isSand(gx, gy - 1)) {
            foamBoxes.push([gx, 1.04, gy]);
          }
          break;
        }
        case 'ocean_deep': pushWater(gx, 0, gy, P.oceanDeep); break;
        default: pushBox(gx, 0, gy, P.sidewalk, 1);
      }
    }
  }
}

// Procedural city buildings (built from the live citizen snapshot) contribute
// to player collision, while citizens keep standing on the flat terrain.
const buildingTopH = new Map();
function colTop(gx, gy) {
  const b = buildingTopH.get(topKey(gx, gy)) || 0;
  const t = topH.get(topKey(gx, gy)) || 0;
  return b > t ? b : t;
}
function terrTopAt(gx, gy) {
  return terrTop.get(topKey(gx, gy)) || 0;
}

// ---------- props → structures ----------
// Minor street furniture that only adds noise; the voxel world keeps the
// meaningful landmarks, trees and nature instead.
const CLUTTER_PROPS = new Set([
  'bench', 'cafe_table', 'flower_bed', 'trash_can', 'fire_hydrant',
  'tree_planter', 'toadstool_cluster', 'mossy_boulder', 'stone_lantern', 'bus_stop',
]);
const LEAF_TINT = {
  jungle_tree: 0x2c6f37, ancient_redwood: 0x1f5d2a, willow_tree: 0x5a8a4a,
  birch_tree: 0x7aa24a, pine_tree: 0x1d5528, park_tree: 0x357f41,
  cherry_tree: 0xf9a8d4, fruit_tree: 0x4a8a43, giant_banyan: 0x276235,
  tall_kapok: 0x2f6b3a, palm_tree: 0x3aa24a, mountain_pine: 0x245a34,
};
function treeAt(gx, gy, base, trunkH, leafA, leafB) {
  solidProps.add(topKey(gx, gy));
  // 35% of ordinary trees grow as low bushes instead — lets light and air in
  const bushy = !leafB && trunkH < 3 && hash2(gx, gy, 31) < 0.35;
  const th = bushy ? Math.max(0.7, trunkH * 0.55) : trunkH;
  const dark = shade(leafA, 0.74);
  const mid = leafB ?? shade(leafA, 0.88);
  pushCyl(gx, base + th / 2, gy, bushy ? 0.15 : 0.12 + trunkH * 0.012, th, 0x6b4a2f);
  const ly = base + th;
  const r = bushy ? 0.8 : 0.58 + trunkH * 0.1;
  // rounded crown from overlapping spheres (reads organic, not blocky)
  pushSphere(gx, ly + r * 0.8, gy, r * 1.1, leafA);
  pushSphere(gx - r * 0.75, ly + r * 0.5, gy, r * 0.82, mid);
  pushSphere(gx + r * 0.75, ly + r * 0.5, gy, r * 0.82, dark);
  pushSphere(gx, ly + r * 0.5, gy - r * 0.75, r * 0.82, mid);
  pushSphere(gx, ly + r * 0.5, gy + r * 0.75, r * 0.82, dark);
}

// Conifer: slim trunk + stacked cones (pines, redwoods, mountain pines)
function pineAt(gx, gy, base, leafColor) {
  solidProps.add(topKey(gx, gy));
  const th = 0.5 + hash2(gx, gy, 17) * 0.5;
  pushCyl(gx, base + th / 2, gy, 0.14, th, 0x5e4028);
  const dark = shade(leafColor, 0.78);
  let y = base + th;
  for (let i = 0; i < 3; i++) {
    const rr = 1.0 - i * 0.24;
    const hh = 1.0 - i * 0.14;
    pushCone(gx, y + hh / 2, gy, rr, hh, i % 2 ? dark : leafColor, 8);
    y += hh * 0.6;
  }
}

// Dense jungle tree: tall trunk + big rounded canopy that reads distinct from
// ordinary trees.
function jungleTreeAt(gx, gy, base, leafColor, variant) {
  const trunkH = 2.4 + hash2(gx, gy, 55) * 1.6;
  pushCyl(gx, base + trunkH / 2, gy, 0.2, trunkH, 0x5e4028);
  const dark = shade(leafColor, 0.72);
  const mid = shade(leafColor, 0.88);
  const by = base + trunkH;
  pushSphere(gx, by + 0.95, gy, 1.05, leafColor);
  pushSphere(gx - 1.0, by + 0.5, gy, 0.78, mid);
  pushSphere(gx + 1.0, by + 0.5, gy, 0.78, dark);
  pushSphere(gx, by + 0.5, gy - 1.0, 0.78, mid);
  pushSphere(gx, by + 0.5, gy + 1.0, 0.78, dark);
  pushSphere(gx, by + 1.75, gy, 0.75, leafColor);
  if (variant === 'dense') {
    pushSphere(gx + 0.6, by + 1.1, gy - 0.6, 0.17, 0xa855f7);
    pushSphere(gx - 0.7, by + 0.9, gy + 0.7, 0.17, 0xa855f7);
  }
}

// Palm: gently leaning trunk + a drooping starburst of frond spheres.
function palmTreeAt(gx, gy, base, leafColor) {
  const trunkH = 4.5 + hash2(gx, gy, 42) * 1.5;
  const lean = (hash2(gx, gy, 9) - 0.5) * 0.6;
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    pushCyl(gx + lean * t, base + trunkH * (0.14 + t * 0.24), gy + lean * 0.35 * t, 0.13 - t * 0.02, trunkH / 3.6, 0x7a5a34);
  }
  const crownY = base + trunkH;
  const cx = gx + lean, cz = gy + lean * 0.35;
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    for (let s = 1; s <= 3; s++) {
      const d = s * 0.42;
      const drop = s * s * 0.11;
      pushSphere(cx + Math.cos(a) * d, crownY - drop, cz + Math.sin(a) * d, 0.3 - s * 0.04, s % 2 ? leafColor : shade(leafColor, 0.85));
    }
  }
  pushSphere(cx, crownY + 0.15, cz, 0.4, leafColor);
}
function towerAt(gx, gy, base, h, color, capColor) {
  for (let y = base; y < base + h; y++) pushBox(gx, y, gy, color);
  if (capColor !== undefined) pushCone(gx, base + h + 0.35, gy, 0.9, 0.85, capColor, 4);
}
function lampAt(gx, gy, base, headColor) {
  pushCyl(gx, base + 1.05, gy, 0.08, 2.1, 0x3a4356);
  pushSphere(gx, base + 2.2, gy, 0.2, headColor || 0xffc861);
  pushGlow(gx, base + 2.2, gy, headColor || 0xffc861);
}

function buildProps() {
  for (let gx = MIN_GX; gx <= MAX_GX; gx++) {
    for (let gy = MIN_GY; gy <= MAX_GY; gy++) {
      let p = null;
      try { p = getCityProp(gx, gy); } catch { continue; }
      if (!p || !p.type) continue;
      const base = colTop(gx, gy);
      const t = p.type;
      // Keep only meaningful assets. Drop the minor street furniture that just
      // clutters the city and reads as noise next to the citizens.
      if (CLUTTER_PROPS.has(t)) continue;
      // Beach: thin the palms and keep a clear corridor down to the boat so
      // first-person roaming isn't blocked by props.
      const inBoatCorridor = gx >= 45 && gx <= 55;
      if (gy >= 100 && gy <= 110) {
        if (t === 'palm_tree' && (inBoatCorridor || hash2(gx, gy, 71) < 0.45)) continue;
        if ((t === 'beach_umbrella' || t === 'beach_lounger') && inBoatCorridor) continue;
      }
      // Thin ordinary city trees (keep nature in the park / jungle / beach).
      const inCity = gx >= 0 && gx < 100 && gy >= 0 && gy < 88;
      if (inCity && LEAF_TINT[t] && hash2(gx, gy, 61) < 0.4) continue;
      if (LEAF_TINT[t]) {
        if (t === 'palm_tree') {
          palmTreeAt(gx, gy, base, LEAF_TINT[t]);
        } else if (t === 'jungle_tree') {
          jungleTreeAt(gx, gy, base, LEAF_TINT[t], 'normal');
        } else if (t === 'pine_tree' || t === 'mountain_pine' || t === 'ancient_redwood') {
          pineAt(gx, gy, base, LEAF_TINT[t]);
        } else {
          const tall = t === 'giant_banyan' || t === 'tall_kapok';
          const trunkH = tall ? 3 : 1 + Math.floor(hash2(gx, gy, 21) * 2);
          const secondTone = t === 'cherry_tree' ? 0x3f7a3a : undefined;
          treeAt(gx, gy, base, trunkH, LEAF_TINT[t], secondTone);
        }
      } else if (t === 'street_lamp') {
        lampAt(gx, gy, base, 0xffc861);
      } else if (t === 'boardwalk_lamp') {
        lampAt(gx, gy, base, 0xffb066);
      } else if (t === 'stone_lantern') {
        lampAt(gx, gy, base, 0xfbbf24);
      } else if (t === 'railway_signal') {
        lampAt(gx, gy, base, 0x38bdf8);
      } else if (t === 'city_hall') {
        pushDetail(gx, base + 0.05, gy, 1.6, 0.1, 1.6, 0xe8e4da);
        for (let y = base; y < base + 5; y++) pushBox(gx, y, gy, y % 2 === 0 ? 0xe8e4da : 0xd8d4c8);
        pushDetail(gx, base + 2.5, gy, 1.08, 0.14, 1.08, 0xc9a227);
        for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) {
          pushCyl(gx + dx, base + 2.5, gy + dz, 0.1, 5.0, 0xf1f5f9);
        }
        pushSphere(gx, base + 5.6, gy, 0.95, 0xc9a227);
        pushCone(gx, base + 6.6, gy, 0.38, 0.9, 0xc9a227, 6);
        pushGlow(gx, base + 7.2, gy, 0x22d3ee);
        windowsAt(gx, gy, base, 5);
      }
      else if (t === 'grand_station') {
        for (let y = base; y < base + 3; y++) pushBox(gx, y, gy, 0x8fa3b8);
        pushBox(gx, base + 3, gy, 0x9aa2b0);
        for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) {
          pushCyl(gx + dx, base + 2.0, gy + dz, 0.1, 4.0, 0xb8c2d0);
        }
        pushCone(gx, base + 4.7, gy, 1.3, 1.2, 0x6b7484, 6);
        pushCyl(gx, base + 3.2, gy + 0.55, 0.2, 0.14, 0xf8fafc);
        pushDetailGlow(gx, base + 3.2, gy + 0.53, 0.5, 0.5, 0.04, 0xffd9a0);
        windowsAt(gx, gy, base, 3);
      }
      else if (t === 'museum_door') {
        pushDetail(gx, base + 0.08, gy, 1.6, 0.16, 1.6, 0xd8d4c8);
        pushDetail(gx, base + 0.3, gy, 1.35, 0.16, 1.35, 0xe8e4da);
        pushBox(gx, base, gy, 0xe8e4da);
        pushBox(gx, base + 1, gy, 0xe8e4da);
        pushBox(gx, base + 2, gy, 0xe8e4da);
        for (const [dx, dz] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) {
          pushCyl(gx + dx, base + 1.6, gy + dz, 0.1, 3.2, 0xf1f5f9);
        }
        pushCone(gx, base + 3.7, gy, 1.05, 1.1, 0xd8d4c8, 4);
        pushDetailGlow(gx, base + 1.5, gy + 0.51, 0.5, 1.0, 0.06, 0xffd9a0);
        pushGlow(gx, base + 4.4, gy, 0xfbbf24);
        windowsAt(gx, gy, base, 3);
      }
      else if (t === 'beach_hotel') {
        for (let y = base; y < base + 6; y++) pushBox(gx, y, gy, y % 2 === 0 ? 0xf1f5f9 : 0xe2e8f0);
        for (let wy = base + 1; wy < base + 6; wy += 2) {
          pushDetailGlow(gx, wy + 0.5, gy + 0.51, 1.02, 0.2, 0.06, 0x22d3ee);
          pushDetail(gx + 0.6, wy + 0.5, gy + 0.55, 0.7, 0.12, 0.5, 0xcbd5e1);
        }
        pushCone(gx, base + 6.6, gy, 1.2, 1.1, 0x22d3ee, 4);
        pushGlow(gx, base + 7.3, gy, 0x22d3ee);
        windowsAt(gx, gy, base, 6);
      }
      else if (t === 'cyber_lighthouse') {
        for (let y = base; y < base + 5; y++) pushBox(gx, y, gy, y % 2 === 0 ? 0xf1f5f9 : 0xb23a3a);
        pushCone(gx, base + 5.5, gy, 0.65, 1.0, 0xb23a3a, 6);
        pushGlow(gx, base + 6.1, gy, 0x67e8f9);
        const beamGeo = new THREE.BoxGeometry(7, 0.35, 0.35);
        beamGeo.translate(3.5, 0, 0);
        const beam = new THREE.Mesh(
          beamGeo,
          new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.28, depthWrite: false })
        );
        beam.position.set(gx * WORLD_SCALE, base + 6.1, gy * WORLD_SCALE);
        scene.add(beam);
        beams.push(beam);
      }
      else if (t === 'genesis_monolith') { towerAt(gx, gy, base, 4, 0x141821, 0xc9a227); }
      else if (t === 'kandahar_giant') { towerAt(gx, gy, base, 6, 0x3a4356); }
      else if (t === 'wishing_fountain' || t === 'fountain') {
        pushCyl(gx, base + 0.25, gy, 0.95, 0.5, 0x9aa2b0);
        pushCyl(gx, base + 0.45, gy, 0.72, 0.22, 0x2a7fb0);
        pushCyl(gx, base + 0.95, gy, 0.16, 1.1, 0xc4ccd8);
        pushSphere(gx, base + 1.6, gy, 0.3, 0xc4ccd8);
        pushGlow(gx, base + 1.6, gy, 0x7dd3fc);
      }
      else if (t === 'hermit_cabin') {
        pushBox(gx, base, gy, 0x7a5230);
        pushBox(gx, base + 1, gy, 0x6b4a2f);
        pushCone(gx, base + 2.5, gy, 1.15, 1.0, 0x4a3620, 4);
        pushDetail(gx, base + 1.5, gy + 0.51, 0.5, 0.55, 0.06, 0x3a2a1a);
        pushDetailGlow(gx - 0.5, base + 1.6, gy + 0.51, 0.3, 0.3, 0.05, 0xffd9a0);
        pushCyl(gx + 0.5, base + 2.9, gy - 0.4, 0.08, 0.8, 0x5b6472);
      }
      else if (t === 'jungle_hut') {
        for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) {
          pushCyl(gx + dx, base + 0.35, gy + dz, 0.07, 0.7, 0x5e4028);
        }
        pushBox(gx, base + 1, gy, 0x7a5230);
        pushCone(gx, base + 2.6, gy, 1.3, 1.4, 0xb89b5e, 4);
        pushDetail(gx, base + 1.5, gy + 0.51, 0.4, 0.55, 0.06, 0x2a2018);
      }
      else if (t === 'mountain_tent') {
        pushCone(gx, base + 0.9, gy, 1.0, 1.8, 0xe07830, 4);
        pushDetail(gx, base + 0.55, gy + 0.5, 0.35, 0.9, 0.06, 0x3a2a1a);
        pushCyl(gx, base + 1.95, gy, 0.03, 0.6, 0x8a8f98);
        pushDetail(gx + 0.15, base + 2.15, gy, 0.3, 0.2, 0.02, 0xf8fafc);
      }
      else if (t === 'yeti') { pushSphere(gx, base + 0.5, gy, 0.5, 0xf1f5f9); pushSphere(gx, base + 1.1, gy, 0.36, 0xf1f5f9); }
      else if (t === 'ice_crystal') {
        pushCone(gx, base + 0.9, gy, 0.4, 1.8, 0x7dd3fc, 6);
        pushCone(gx + 0.35, base + 0.5, gy + 0.2, 0.25, 1.0, 0xa5e8ff, 5);
      }
      else if (t === 'snow_boulder') { pushSphere(gx, base + 0.4, gy, 0.5, 0xdfe8f2); }
      else if (t === 'beach_umbrella') {
        pushCyl(gx, base + 0.9, gy, 0.06, 1.8, 0x8a8f98);
        pushCone(gx, base + 1.95, gy, 1.0, 0.55, 0xe4572e, 8);
      }
      else if (t === 'beach_bonfire') {
        pushCyl(gx, base + 0.25, gy, 0.4, 0.5, 0x3a2a1a);
        pushCone(gx, base + 0.95, gy, 0.35, 0.9, 0xf97316, 5);
        pushGlow(gx, base + 1.0, gy, 0xf97316);
      }
      else if (t === 'bench') {
        pushDetail(gx, base + 0.45, gy, 0.95, 0.1, 0.42, 0x8a6238);
        pushCyl(gx - 0.35, base + 0.22, gy, 0.05, 0.45, 0x4a3620);
        pushCyl(gx + 0.35, base + 0.22, gy, 0.05, 0.45, 0x4a3620);
        pushDetail(gx, base + 0.72, gy - 0.22, 0.95, 0.4, 0.08, 0x6b4a2f);
      }
      else if (t === 'cafe_table') {
        pushCyl(gx, base + 0.55, gy, 0.42, 0.08, 0xe8e4da);
        pushCyl(gx, base + 0.28, gy, 0.06, 0.55, 0x5b6472);
      }
      else if (t === 'beach_lounger') {
        pushDetail(gx, base + 0.3, gy, 0.9, 0.12, 0.5, 0x3aa24a);
        pushDetail(gx, base + 0.52, gy - 0.28, 0.9, 0.35, 0.12, 0x2f6b3a);
      }
      else if (t === 'ramen_foodtruck') {
        pushBox(gx, base, gy, 0xb23a3a);
        pushBox(gx, base + 1, gy, 0xf1f5f9);
        pushCyl(gx - 0.35, base + 0.15, gy + 0.5, 0.18, 0.3, 0x1e293b);
        pushCyl(gx + 0.35, base + 0.15, gy + 0.5, 0.18, 0.3, 0x1e293b);
      }
      else if (t === 'parked_delorean') { pushBox(gx, base, gy, 0x9fb2c8); }
      else if (t === 'cyber_konbini') { pushBox(gx, base, gy, 0x22d3ee); pushBox(gx, base + 1, gy, 0xf1f5f9); pushCone(gx, base + 2.5, gy, 0.9, 0.7, 0x0ea5e9, 4); }
      else if (t === 'cafe_storefront') { pushBox(gx, base, gy, 0x7a5230); pushBox(gx, base + 1, gy, 0xb89b5e); pushCone(gx, base + 2.6, gy, 0.9, 0.8, 0x8a6238, 4); }
      else if (t === 'retro_arcade') { pushBox(gx, base, gy, 0xb23a3a); pushBox(gx, base + 1, gy, 0xc9a227); pushCone(gx, base + 2.6, gy, 0.9, 0.7, 0xb23a3a, 4); }
      else if (t === 'dev_library') {
        pushBox(gx, base, gy, 0xd8d4c8);
        pushBox(gx, base + 1, gy, 0xe8e4da);
        pushBox(gx, base + 2, gy, 0xe8e4da);
        for (const [dx, dz] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) {
          pushCyl(gx + dx, base + 2.2, gy + dz, 0.09, 2.2, 0xb9b3a6);
        }
        pushCone(gx, base + 4.4, gy, 0.98, 1.2, 0x22d3ee, 4);
        pushGlow(gx, base + 5.1, gy, 0x22d3ee);
        windowsAt(gx, gy, base, 3);
      }
      else if (t === 'subway_entrance' || t === 'bus_stop') { pushBox(gx, base, gy, 0x8fa3b8); }
      else if (t === 'vending_machine') { pushBox(gx, base, gy, 0xf1f5f9); }
      else if (t === 'sunset_arch') {
        pushBox(gx, base, gy, 0xe07830);
        pushBox(gx, base + 1, gy, 0xe07830);
        pushBox(gx, base + 2, gy, 0xe07830);
        pushDetail(gx, base + 2.6, gy, 3.0, 0.5, 0.8, 0xe07830);
      }
      else if (t === 'dive_sign') { pushBox(gx, base, gy, 0x22d3ee); }
      else if (t === 'pond_fisher') { pushBox(gx, base, gy, 0x4a7fb8); }
      // ---- small scatter & remaining catalog ----
      else if (t === 'great_oak') { treeAt(gx, gy, base, 3, 0x2f6b3a, 0x4a8a43); }
      else if (t === 'master_bonsai') {
        pushCyl(gx, base + 0.25, gy, 0.45, 0.5, 0x8a8f98);
        pushSphere(gx, base + 0.85, gy, 0.6, 0x2f6b3a);
      }
      else if (t === 'tree_planter') {
        pushCyl(gx, base + 0.3, gy, 0.42, 0.6, 0x5b6472);
        pushSphere(gx, base + 1.05, gy, 0.6, 0x357f41);
      }
      else if (t === 'flower_bed') {
        pushCyl(gx, base + 0.15, gy, 0.45, 0.3, 0x5b6472);
        pushSphere(gx - 0.15, base + 0.45, gy, 0.18, 0xf472b6);
        pushSphere(gx + 0.18, base + 0.4, gy + 0.12, 0.16, 0xfbbf24);
        pushSphere(gx, base + 0.45, gy - 0.18, 0.15, 0xf87171);
      }
      else if (t === 'fire_hydrant') { pushCyl(gx, base + 0.4, gy, 0.16, 0.8, 0xb23a3a); }
      else if (t === 'trash_can') { pushCyl(gx, base + 0.35, gy, 0.22, 0.7, 0x3a4356); }
      else if (t === 'cafe_cat') {
        pushSphere(gx, base + 0.35, gy, 0.32, 0xf97316);
        pushSphere(gx, base + 0.7, gy + 0.2, 0.22, 0xfb923c);
      }
      else if (t === 'mystic_duck') {
        pushSphere(gx, base + 0.3, gy, 0.3, 0xfbbf24);
        pushSphere(gx, base + 0.62, gy + 0.22, 0.18, 0xf59e0b);
      }
      else if (t === 'glitch_void' || t === 'cyber_glitch_byte' || t === 'cyber_glitch_mantis' || t === 'cyber_glitch_null') {
        pushBox(gx, base, gy, 0x1e1b4b);
        pushGlow(gx, base + 1, gy, 0xa855f7);
      }
      else if (t === 'sunken_sub') { pushBox(gx, base, gy, 0x4a5568); pushDetail(gx, base + 1.05, gy, 0.8, 0.3, 0.5, 0x38bdf8); }
      else if (t === 'starfish') { pushDetail(gx, base + 0.06, gy, 0.4, 0.12, 0.4, 0xf97316); }
      else if (t === 'fallen_coconut') { pushSphere(gx, base + 0.16, gy, 0.16, 0x6b4a2f); }
      else if (t === 'toadstool_cluster') {
        pushCyl(gx - 0.15, base + 0.25, gy, 0.06, 0.5, 0xd8cfb8);
        pushSphere(gx - 0.15, base + 0.55, gy, 0.2, 0xe23a3a);
        pushCyl(gx + 0.2, base + 0.18, gy + 0.1, 0.05, 0.36, 0xd8cfb8);
        pushSphere(gx + 0.2, base + 0.4, gy + 0.1, 0.15, 0xe23a3a);
      }
      else if (t === 'mossy_boulder') { pushSphere(gx, base + 0.35, gy, 0.5, 0x5b6472); pushSphere(gx + 0.3, base + 0.5, gy - 0.2, 0.18, 0x3f7a3a); }
      else if (t === 'hollow_log') { pushCyl(gx, base + 0.2, gy, 0.28, 0.5, 0x5e4028); }
      else if (t === 'jungle_fern') {
        pushCone(gx, base + 0.35, gy, 0.5, 0.7, 0x2c6f37, 6);
        pushCone(gx + 0.3, base + 0.25, gy + 0.2, 0.35, 0.5, 0x357f41, 6);
      }
      else if (t === 'city_parking_bay' || t === 'beach_parking_bay') { pushDetail(gx, base + 0.03, gy, 0.8, 0.05, 0.8, 0x38bdf8); }
      else if (t === 'jungle_bridge') { pushBox(gx, base, gy, 0x7a5230); pushDetail(gx, base + 1.05, gy, 0.9, 0.12, 0.9, 0x8a6238); }
    }
  }
}

buildTerrain();
const terrTop = new Map(topH);
buildProps();

// cyber billboard jumbotrons from live WORLD_BANNERS data
const billboardSpots = [];
const billboardPanels = [];
function makeBannerTexture(b) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#0a0f1e';
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 0; y < 256; y += 6) g.fillRect(0, y, 512, 2);
  g.strokeStyle = b.accentColor || '#00f0ff';
  g.lineWidth = 10;
  g.strokeRect(8, 8, 496, 240);
  g.textAlign = 'center';
  g.fillStyle = b.accentColor || '#00f0ff';
  g.font = 'bold 28px monospace';
  g.fillText(String(b.tag || b.district || 'SPOT').slice(0, 26), 256, 50);
  const words = String(b.headline || b.name || 'SPOT').split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 20 && cur) { lines.push(cur.trim()); cur = w; }
    else cur += ' ' + w;
    if (lines.length === 2) break;
  }
  if (cur.trim() && lines.length < 2) lines.push(cur.trim());
  g.fillStyle = '#f8fafc';
  g.font = 'bold 42px monospace';
  lines.forEach((ln, i) => g.fillText(ln.slice(0, 22), 256, 112 + i * 48));
  g.fillStyle = '#94a3b8';
  g.font = '24px monospace';
  g.fillText(String(b.subtext || b.statusText || '').slice(0, 34), 256, 208);
  g.fillStyle = '#67e8f9';
  g.font = 'bold 22px monospace';
  g.fillText('claimyourspot.lol', 256, 238);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
for (const b of WORLD_BANNERS) {
  if (b.gx === undefined || b.gy === undefined) continue;
  const base = colTop(b.gx, b.gy);
  pushDetail(b.gx - 2.2, base + 1.5, b.gy, 0.25, 3, 0.25, 0x1e293b);
  pushDetail(b.gx + 2.2, base + 1.5, b.gy, 0.25, 3, 0.25, 0x1e293b);
  pushDetail(b.gx, base + 4.5, b.gy, 6.4, 3.4, 0.3, 0x111827);
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 3),
    new THREE.MeshBasicMaterial({ map: makeBannerTexture(b), side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 })
  );
  panel.renderOrder = 10;
  panel.position.set(b.gx * WORLD_SCALE, base + 4.5, b.gy * WORLD_SCALE + 0.17);
  scene.add(panel);
  billboardSpots.push({ gx: b.gx, gy: b.gy, top: base + 6, data: b });
  billboardPanels.push(panel);
  panel.userData.billboard = b;
}

// Note: non-secret landmark props have no modal in the 2D world either —
// clicks there fall through to secrets (below) or walking, exactly like 2D.
// (Museum interior, arcade games, NPC dialogs and art embeds stay 2D-only.)

// ---------- monument title labels (always-facing name tags) ----------
const labelGroup = new THREE.Group();
scene.add(labelGroup);
function makeLabelSprite(text, color) {
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  const font = 'bold 44px ui-monospace, SFMono-Regular, Menlo, monospace';
  g.font = font;
  const tw = Math.ceil(g.measureText(text).width);
  cv.width = tw + 64; cv.height = 96;
  const c = cv.getContext('2d');
  c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
  const r = 20, w = cv.width, h = cv.height;
  c.beginPath();
  c.moveTo(r, 6); c.lineTo(w - r, 6); c.quadraticCurveTo(w - 6, 6, w - 6, r);
  c.lineTo(w - 6, h - r); c.quadraticCurveTo(w - 6, h - 6, w - r, h - 6);
  c.lineTo(r, h - 6); c.quadraticCurveTo(6, h - 6, 6, h - r);
  c.lineTo(6, r); c.quadraticCurveTo(6, 6, r, 6); c.closePath();
  c.fillStyle = 'rgba(9, 13, 24, 0.84)'; c.fill();
  c.strokeStyle = color; c.lineWidth = 4; c.stroke();
  c.fillStyle = '#f8fafc'; c.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const s = 0.016;
  sprite.scale.set(cv.width * s, cv.height * s, 1);
  return sprite;
}
// [gx, gy, title, label height, colour]
const MONUMENT_LABELS = [
  [50, 46, 'City Hall', 8.4, '#fbbf24'],
  [48, 0, 'Grand Station', 6.6, '#38bdf8'],
  [60, 38, 'Museum', 5.6, '#fbbf24'],
  [44, 52, 'Library', 6.4, '#22d3ee'],
  [64, 16, 'Genesis Monolith', 7.2, '#fbbf24'],
  [40, -10, 'Kandahar Giant', 9.0, '#e2e8f0'],
  [50, 50, 'Wishing Fountain', 4.6, '#7dd3fc'],
  [30, 95, 'Beach Hotel', 9.0, '#fbbf24'],
  [4, 106, 'Cyber Lighthouse', 9.0, '#67e8f9'],
  [48, 4, 'Hermit Cabin', 4.6, '#d9a441'],
  [-7, 51, 'Jungle Hut', 4.8, '#a3e635'],
  [52, -13, 'Base Camp', 4.2, '#fb923c'],
  [86, 22, 'Retro Arcade', 4.6, '#f472b6'],
  [19, 68, 'Cafe', 3.6, '#fbbf24'],
  [34, 22, 'Konbini', 3.8, '#22d3ee'],
  [48, 48, 'Ramen Truck', 3.8, '#fb923c'],
  [70, 74, 'Master Bonsai', 3.8, '#34d399'],
  [66, 12, 'Great Oak', 6.6, '#4ade80'],
  [14, 78, 'Sunken Sub', 3.2, '#38bdf8'],
  [98, 98, 'Glitch Void', 4.6, '#a855f7'],
  [72, 22, 'Mystic Duck', 3.0, '#fbbf24'],
  [22, 68, 'Cafe Cat', 3.0, '#f472b6'],
  [19, 19, 'Metro', 4.4, '#38bdf8'],
  [79, 79, 'Metro', 4.4, '#38bdf8'],
  [18, -12, 'Yeti', 5.0, '#e2e8f0'],
  [78, -11, 'Yeti', 5.0, '#e2e8f0'],
];
for (const [gx, gy, text, h, color] of MONUMENT_LABELS) {
  const sprite = makeLabelSprite(text, color);
  sprite.position.set(gx * WORLD_SCALE, h, gy * WORLD_SCALE);
  sprite.renderOrder = 20;
  labelGroup.add(sprite);
}
let labelsOn = true;
function setLabels(on) {
  labelsOn = on;
  labelGroup.visible = on;
}

// ---------- world expansion: ocean islands + distant northern peaks ----------
function islandAt(cx, cz) {
  const cells = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
  for (const [dx, dz] of cells) {
    const gx = cx + dx, gy = cz + dz;
    pushBox(gx, 0, gy, 0xc9ae7c);
    pushBox(gx, 1, gy, 0xdcc795);
    pushBox(gx, 2, gy, 0xe2cf9a);
  }
  pushBox(cx, 3, cz, 0x6b4a2f);
  pushBox(cx, 4, cz, 0x6b4a2f);
  const lc = 0x3aa24a;
  pushBox(cx - 1, 5, cz, lc);
  pushBox(cx + 1, 5, cz, lc);
  pushBox(cx, 5, cz - 1, lc);
  pushBox(cx, 5, cz + 1, lc);
  pushBox(cx, 5, cz, lc);
  pushBox(cx, 6, cz, lc);
}
islandAt(30, 118);
islandAt(76, 121);
islandAt(112, 116);

for (let i = 0; i < 14; i++) {
  const px = -14 + i * 10 + Math.floor(hash2(i, 1, 301) * 5);
  const pz = -19 - Math.floor(hash2(i, 2, 302) * 6);
  const h = 10 + Math.floor(hash2(i, 3, 303) * 7);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const ch = h - (Math.abs(dx) + Math.abs(dz)) * 3;
      for (let y = 0; y < ch; y++) {
        pushBox(px + dx, y, pz + dz, y >= ch - 2 ? 0xe8eef6 : (y >= ch - 5 ? 0x5b6472 : 0x2b3444));
      }
    }
  }
}

// ---------- sanctuary dressing: gold trees, stone archways, pond ripples ----------
const ripples = [];
function buildSanctuary() {
  // golden foliage clusters (park + plaza planters only)
  const goldSpots = [[60, 12], [78, 14], [62, 30], [80, 32], [40, 40], [60, 40], [38, 60], [62, 60]];
  for (const [gx, gy] of goldSpots) {
    let tt = null;
    try { tt = getCityTileType(gx, gy); } catch { continue; }
    if (tt !== 'park_grass' && tt !== 'jungle_grass' && tt !== 'forest_grass' && tt !== 'plaza_grand') continue;
    treeAt(gx, gy, colTop(gx, gy), 2, 0xd9a441, 0xb57e2e);
  }
  // stone archways over the four plaza approaches
  const arches = [
    { gx: 50, gy: 34, alongX: true }, { gx: 50, gy: 66, alongX: true },
    { gx: 34, gy: 50, alongX: false }, { gx: 66, gy: 50, alongX: false },
  ];
  for (const a of arches) {
    const base = colTop(a.gx, a.gy);
    const dx = a.alongX ? 1 : 0, dz = a.alongX ? 0 : 1;
    for (const sgn of [-1, 1]) {
      for (let y = base; y < base + 4; y++) pushBox(a.gx + dx * sgn, y, a.gy + dz * sgn, 0x6b7484);
    }
    pushDetail(a.gx, base + 4.3, a.gy, a.alongX ? 3.4 : 0.9, 0.6, a.alongX ? 0.9 : 3.4, 0x7d8798);
    pushDetailGlow(a.gx, base + 4.3, a.gy, a.alongX ? 3.0 : 0.2, 0.14, a.alongX ? 0.2 : 3.0, 0xffc861);
  }
  // expanding ripple rings on the central park lake
  let found = 0;
  for (let gx = 64; gx <= 80 && found < 3; gx += 3) {
    for (let gy = 18; gy <= 32 && found < 3; gy += 3) {
      let tt = null;
      try { tt = getCityTileType(gx, gy); } catch { continue; }
      if (tt !== 'water_pond') continue;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.35, 0.5, 24),
        new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
       ring.position.set(gx * WORLD_SCALE, 1.06, gy * WORLD_SCALE);
      scene.add(ring);
      ripples.push({ mesh: ring, off: found * 0.33 });
      found++;
    }
  }
}
buildSanctuary();

function stepAmbient(t, dt) {
  for (const tc of torches) {
    tc.light.intensity = tc.base * (0.9 + 0.1 * Math.sin(t * 13 + tc.ph));
  }
  for (const r of ripples) {
    const f = (t * 0.35 + r.off) % 1;
    const s = 1 + f * 2.4;
    r.mesh.scale.set(s, s, s);
    r.mesh.material.opacity = 0.42 * (1 - f);
  }
}
// depth AO: darken boxes buried below their column's terrain top
for (let i = 0; i < boxes.length; i++) {
  const t = terrTop.get(topKey(boxes[i][0], boxes[i][2])) || 1;
  const depth = t - (boxes[i][1] + 1);
  if (depth > 0) {
    boxColors[i] = new THREE.Color(boxColors[i]).multiplyScalar(Math.max(0.55, Math.pow(0.85, depth))).getHex();
  }
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const dummy = new THREE.Object3D();
const solidMesh = new THREE.InstancedMesh(
  unitBox, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), boxes.length
);
for (let i = 0; i < boxes.length; i++) {
  dummy.position.set(boxes[i][0] * WORLD_SCALE, boxes[i][1] + 0.5, boxes[i][2] * WORLD_SCALE);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  solidMesh.setMatrixAt(i, dummy.matrix);
  solidMesh.setColorAt(i, new THREE.Color(boxColors[i]));
}
solidMesh.instanceColor.needsUpdate = true;
solidMesh.castShadow = true;
solidMesh.receiveShadow = true;
solidMesh.frustumCulled = false;
scene.add(solidMesh);

// Ocean water: adapted from the Poseidon fBm-ocean technique — a multi-octave
// height field drives both vertex displacement and finite-difference normals,
// then Fresnel sky reflection + subsurface scattering + sun glitter + crest foam.
const waterUniforms = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.4, 0.85, 0.3).normalize() },
  uSkyTop: { value: new THREE.Color(0x87b5e0) },
  uSkyHorizon: { value: new THREE.Color(0xcfe0f0) },
  uDeep: { value: new THREE.Color(0x08243f) },
  uFoam: { value: new THREE.Color(0xeaf6ff) },
  uFogColor: { value: new THREE.Color(0x87b5e0) },
  uFogNear: { value: 180 },
  uFogFar: { value: 640 },
};
const waterMat = new THREE.ShaderMaterial({
  uniforms: waterUniforms,
  transparent: false,
  side: THREE.FrontSide,
  vertexShader: `
    uniform float uTime;
    varying vec3 vWorld;
    varying vec3 vNrm;
    varying vec3 vTint;
    varying float vH;
    float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return -1.0 + 2.0 * mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
                              mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    // "sea_octave" from the Shadertoy Seascape shader: domain-warped noise fed
    // through a choppy wave shaper.
    float seaOctave(vec2 uv, float choppy) {
      uv += vnoise(uv);
      vec2 wv = 1.0 - abs(sin(uv));
      vec2 swv = abs(cos(uv));
      wv = mix(wv, swv, wv);
      return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);
    }
    float waveH(vec2 p, float t) {
      float freq = 0.16;
      float amp = 0.35;
      float choppy = 2.6;
      vec2 uv = p; uv.x *= 0.75;
      float h = 0.0;
      mat2 oct = mat2(1.7, 1.2, -1.2, 1.4);
      for (int i = 0; i < 4; i++) {
        h += seaOctave((uv + t * 1.9) * freq, choppy) * amp;
        uv *= oct;
        freq *= 1.9;
        amp *= 0.22;
        choppy = mix(choppy, 1.0, 0.2);
      }
      return h - 0.12;
    }
    vec3 waveN(vec2 p, float t) {
      float e = 0.25;
      float hL = waveH(p - vec2(e, 0.0), t);
      float hR = waveH(p + vec2(e, 0.0), t);
      float hD = waveH(p - vec2(0.0, e), t);
      float hU = waveH(p + vec2(0.0, e), t);
      return normalize(vec3(hL - hR, 2.0 * e, hD - hU));
    }
    void main() {
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
      float h = waveH(wp.xz, uTime);
      wp.y += h;
      vWorld = wp.xyz;
      vH = h;
      vNrm = waveN(wp.xz, uTime);
      vTint = instanceColor;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uSunDir;
    uniform vec3 uSkyTop;
    uniform vec3 uSkyHorizon;
    uniform vec3 uDeep;
    uniform vec3 uFoam;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;
    varying vec3 vWorld;
    varying vec3 vNrm;
    varying vec3 vTint;
    varying float vH;
    void main() {
      vec3 N = normalize(vNrm);
      vec3 V = normalize(cameraPosition - vWorld);
      vec3 L = normalize(uSunDir);
      // Seascape-style colour: refracted water body + fresnel sky reflection.
      float diff = pow(max(dot(N, L), 0.0) * 0.4 + 0.6, 60.0);
      vec3 refracted = uDeep + diff * vTint * 0.4;
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.55;
      vec3 R = reflect(-V, N);
      vec3 reflected = mix(uSkyHorizon, uSkyTop, clamp(R.y, 0.0, 1.0));
      vec3 col = mix(refracted, reflected, fres);
      // peak brightening (waves catch light)
      col += vTint * clamp(vH, 0.0, 1.0) * 0.35;
      // sun glitter
      vec3 H = normalize(V + L);
      float ndh = max(dot(N, H), 0.0);
      col += vec3(1.0, 0.95, 0.85) * (pow(ndh, 200.0) * 2.2 + pow(ndh, 30.0) * 0.28);
      // foam on sharp crests
      float foam = smoothstep(0.25, 0.5, vH) * smoothstep(0.6, 0.9, 1.0 - N.y);
      col = mix(col, uFoam, clamp(foam, 0.0, 0.85));
      // distance fog
      float dist = length(cameraPosition - vWorld);
      float fog = smoothstep(uFogNear, uFogFar, dist);
      col = mix(col, uFogColor, fog);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});
let waterMesh = null;
if (waterBoxes.length > 0) {
  const waterGeom = new THREE.PlaneGeometry(1.0, 1.0, 2, 2);
  waterMesh = new THREE.InstancedMesh(waterGeom, waterMat, waterBoxes.length);
  for (let i = 0; i < waterBoxes.length; i++) {
    dummy.position.set(waterBoxes[i][0] * WORLD_SCALE, 0.99, waterBoxes[i][2] * WORLD_SCALE);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    waterMesh.setMatrixAt(i, dummy.matrix);
    waterMesh.setColorAt(i, new THREE.Color(waterBoxes[i][3]));
  }
  waterMesh.instanceColor.needsUpdate = true;
  waterMesh.frustumCulled = false;
  waterMesh.renderOrder = 2;
  scene.add(waterMesh);
}

const foamMat = new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.75 });
let foamMesh = null;
if (foamBoxes.length > 0) {
  foamMesh = new THREE.InstancedMesh(unitBox, foamMat, foamBoxes.length);
  for (let i = 0; i < foamBoxes.length; i++) {
    dummy.position.set(foamBoxes[i][0] * WORLD_SCALE, foamBoxes[i][1], foamBoxes[i][2] * WORLD_SCALE);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0.92 * BOX_SCALE, 0.07, 0.92 * BOX_SCALE);
    dummy.updateMatrix();
    foamMesh.setMatrixAt(i, dummy.matrix);
  }
  foamMesh.frustumCulled = false;
  foamMesh.renderOrder = 3;
  scene.add(foamMesh);
}

if (glowBoxes.length > 0) {
  var lampGlowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.6 });
  const glowMesh = new THREE.InstancedMesh(
    unitBox,
    lampGlowMat,
    glowBoxes.length
  );
  for (let i = 0; i < glowBoxes.length; i++) {
    dummy.position.set(glowBoxes[i][0] * WORLD_SCALE, glowBoxes[i][1] + 0.5, glowBoxes[i][2] * WORLD_SCALE);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0.7 * BOX_SCALE, 0.7 * BOX_SCALE, 0.7 * BOX_SCALE);
    dummy.updateMatrix();
    glowMesh.setMatrixAt(i, dummy.matrix);
    glowMesh.setColorAt(i, new THREE.Color(glowBoxes[i][3]));
  }
  glowMesh.instanceColor.needsUpdate = true;
  glowMesh.frustumCulled = false;
  scene.add(glowMesh);
}

if (detailBoxes.length > 0) {
  const detailMesh = new THREE.InstancedMesh(
    unitBox,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    detailBoxes.length
  );
  for (let i = 0; i < detailBoxes.length; i++) {
    const e = detailBoxes[i];
    dummy.position.set(e[0] * WORLD_SCALE, e[1], e[2] * WORLD_SCALE);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(e[3], e[4], e[5]);
    dummy.updateMatrix();
    detailMesh.setMatrixAt(i, dummy.matrix);
    detailMesh.setColorAt(i, new THREE.Color(e[6]));
  }
  detailMesh.instanceColor.needsUpdate = true;
  detailMesh.castShadow = true;
  detailMesh.frustumCulled = false;
  scene.add(detailMesh);
}

// ---- rounded asset geometry (trunks, foliage, roofs, props) ----
const assetMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, flatShading: true });
function buildAssetMesh(items, geometry, place, colorIndex, castShadow) {
  if (!items.length) return;
  const mesh = new THREE.InstancedMesh(geometry, assetMat, items.length);
  for (let i = 0; i < items.length; i++) {
    place(items[i]);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, new THREE.Color(items[i][colorIndex]));
  }
  mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = castShadow !== false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
}
buildAssetMesh(cylinderItems, new THREE.CylinderGeometry(1, 1, 1, 6),
  (e) => { dummy.position.set(e[0] * WORLD_SCALE, e[1], e[2] * WORLD_SCALE); dummy.rotation.set(0, 0, 0); dummy.scale.set(e[3], e[4], e[3]); }, 5, false);
buildAssetMesh(coneItems, new THREE.ConeGeometry(1, 1, 6),
  (e) => { dummy.position.set(e[0] * WORLD_SCALE, e[1], e[2] * WORLD_SCALE); dummy.rotation.set(0, 0, 0); dummy.scale.set(e[3], e[4], e[3]); }, 5, false);
buildAssetMesh(sphereItems, new THREE.SphereGeometry(1, 6, 5),
  (e) => { dummy.position.set(e[0] * WORLD_SCALE, e[1], e[2] * WORLD_SCALE); dummy.rotation.set(0, 0, 0); dummy.scale.set(e[3], e[3], e[3]); }, 4, false);

const winMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0, roughness: 0.5 });
if (detailGlows.length > 0) {
  const winMesh = new THREE.InstancedMesh(unitBox, winMat, detailGlows.length);
  for (let i = 0; i < detailGlows.length; i++) {
    const e = detailGlows[i];
    dummy.position.set(e[0] * WORLD_SCALE, e[1], e[2] * WORLD_SCALE);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(e[3], e[4], e[5]);
    dummy.updateMatrix();
    winMesh.setMatrixAt(i, dummy.matrix);
    winMesh.setColorAt(i, new THREE.Color(e[6]));
  }
  winMesh.instanceColor.needsUpdate = true;
  winMesh.frustumCulled = false;
  scene.add(winMesh);
}

// ---------------------------------------------------------------------------
// Procedural per-plot city buildings, generated from the live citizen snapshot.
// Every claimed plot on an urban tile grows a unique, owner-tinted building.
// ---------------------------------------------------------------------------
const cityGroup = new THREE.Group();
scene.add(cityGroup);
let cityCount = 0;
const bldConeGeo = new THREE.ConeGeometry(1, 1, 4);
const bldDomeGeo = new THREE.SphereGeometry(1, 10, 7);
const bldCylGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
const cityWinMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
function addCityMesh(arr, geo, mat, place, colorIdx) {
  if (!arr.length) return;
  const m = new THREE.InstancedMesh(geo, mat, arr.length);
  for (let i = 0; i < arr.length; i++) {
    place(arr[i]);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    m.setColorAt(i, new THREE.Color(arr[i][colorIdx]));
  }
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  cityGroup.add(m);
}
const WALL_TONES = [0xd8d4c8, 0xc9b8a0, 0xb8c2d0, 0x9aa2b0, 0xd9c7b0, 0xbfae9a, 0xa8b0a0];
const ROOF_TONES = [0xb5533a, 0x8a4a3a, 0x4a5568, 0x2f6b6b, 0x7a5230, 0x5b6472, 0x9a6b3a, 0x3f5a7a];
function makePlotBuilding(o, out) {
  const gx = o.x, gy = o.y;
  const base = 1;
  const r = (n) => hash2(gx, gy, n);
  const col = avatarColors(o.avatarId);
  const accent = col.accent.getHex();
  const trim = col.secondary.getHex();
  const wall = WALL_TONES[Math.floor(r(11) * WALL_TONES.length)];
  const roof = r(20) > 0.65 ? accent : ROOF_TONES[Math.floor(r(21) * ROOF_TONES.length)];
  const fr = r(12);
  let family;
  if (fr > 0.87) family = 'tower';
  else if (fr > 0.74) family = 'civic';
  else if (fr > 0.61) family = 'neon';
  else if (fr > 0.46) family = 'shop';
  else if (fr > 0.32) family = 'pagoda';
  else if (fr > 0.18) family = 'warehouse';
  else family = 'house';
  if (family === 'house') {
    const h = 1 + Math.floor(r(13) * 2);
    for (let y = 0; y < h; y++) out.bx.push([gx, base + y + 0.5, gy, 0.92, 1, 0.92, wall]);
    out.rf.push([gx, base + h + 0.42, gy, 0.72, 0.9, roof]);
    out.dt.push([gx, base + 0.55, gy + 0.47, 0.42, 0.5, 0.06, 0x3a2a1a]);
    out.gw.push([gx - 0.28, base + 1.2, gy + 0.47, 0.28, 0.3, 0.05, 0xffd9a0]);
  } else if (family === 'shop') {
    const h = 1 + Math.floor(r(14) * 2);
    for (let y = 0; y < h; y++) out.bx.push([gx, base + y + 0.5, gy, 0.94, 1, 0.94, wall]);
    out.dt.push([gx, base + h + 0.06, gy, 1.0, 0.12, 1.0, trim]);
    out.dt.push([gx, base + 0.78, gy + 0.5, 0.95, 0.12, 0.5, accent]);
    out.gw.push([gx, base + 1.2, gy + 0.51, 0.5, 0.3, 0.05, 0x22d3ee]);
  } else if (family === 'tower') {
    const h = 3 + Math.floor(r(15) * 4);
    for (let y = 0; y < h; y++) out.bx.push([gx, base + y + 0.5, gy, 0.9, 1, 0.9, wall]);
    for (let y = 1; y < h; y += 2) out.gw.push([gx, base + y + 0.5, gy + 0.46, 0.5, 0.3, 0.05, 0xffd9a0]);
    out.bx.push([gx, base + h + 0.3, gy, 0.6, 0.6, 0.6, wall]);
    out.ps.push([gx, base + h + 0.95, gy, 0.05, 1.3, trim]);
    out.gw.push([gx, base + h + 1.65, gy, 0.14, 0.14, 0.14, 0xff5252]);
  } else if (family === 'civic') {
    const h = 2 + Math.floor(r(16) * 3);
    for (let y = 0; y < h; y++) out.bx.push([gx, base + y + 0.5, gy, 0.86, 1, 0.86, wall]);
    for (const [dx, dz] of [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]]) out.ps.push([gx + dx, base + h / 2, gy + dz, 0.07, h, 0xf1f5f9]);
    out.dm.push([gx, base + h + 0.32, gy, 0.55, accent]);
    out.gw.push([gx, base + h + 0.95, gy, 0.12, 0.12, 0.12, 0xffd9a0]);
  } else if (family === 'neon') {
    const h = 2 + Math.floor(r(17) * 4);
    for (let y = 0; y < h; y++) out.bx.push([gx, base + y + 0.5, gy, 0.9, 1, 0.9, 0x1e1b4b]);
    out.gw.push([gx - 0.4, base + h / 2, gy + 0.46, 0.1, Math.max(0.4, h - 0.3), 0.05, accent]);
    out.gw.push([gx + 0.4, base + h / 2, gy + 0.46, 0.1, Math.max(0.4, h - 0.3), 0.05, accent]);
    out.dt.push([gx, base + h + 0.06, gy, 1.0, 0.12, 1.0, 0x111827]);
    out.gw.push([gx, base + 1.0, gy + 0.51, 0.6, 0.4, 0.05, 0x22d3ee]);
  } else if (family === 'pagoda') {
    const h = 2 + Math.floor(r(18) * 3);
    for (let y = 0; y < h; y++) {
      out.bx.push([gx, base + y + 0.5, gy, 0.8, 1, 0.8, wall]);
      out.dt.push([gx, base + y + 0.95, gy, 1.05, 0.12, 1.05, roof]);
    }
    out.rf.push([gx, base + h + 0.5, gy, 0.5, 0.9, roof]);
  } else {
    const h = 1 + Math.floor(r(19) * 2);
    for (let y = 0; y < h; y++) out.bx.push([gx, base + y + 0.5, gy, 0.96, 1, 0.96, wall]);
    out.rf.push([gx, base + h + 0.35, gy, 0.78, 0.8, trim]);
    out.dt.push([gx, base + 0.55, gy + 0.48, 0.7, 0.7, 0.06, 0x3a3f4a]);
  }
}
function buildCity(occupied) {
  for (const c of [...cityGroup.children]) cityGroup.remove(c);
  buildingTopH.clear();
  cityCount = 0;
  const bx = [], rf = [], dm = [], dt = [], gw = [], ps = [];
  const seen = new Set();
  for (const o of occupied) {
    if (!o || o.x === undefined) continue;
    const key = o.x + ',' + o.y;
    if (seen.has(key)) continue;
    seen.add(key);
    let tt;
    try { tt = getCityTileType(o.x, o.y); } catch { continue; }
    // Only build on downtown sidewalks and the cafe promenade — leave the zen
    // garden, central park, plaza and beach as open public space.
    if (tt !== 'sidewalk' && tt !== 'plaza_terracotta') continue;
    // Thin the density so blocks breathe instead of walling each other in.
    if (hash2(o.x, o.y, 31) < 0.4) continue;
    let prop; try { prop = getCityProp(o.x, o.y); } catch { prop = null; }
    if (prop) continue;
    if (billboardSpots.some((b) => b.gx === o.x && b.gy === o.y)) continue;
    makePlotBuilding(o, { bx, rf, dm, dt, gw, ps });
    cityCount++;
  }
  const placeBox = (e) => { dummy.position.set(e[0] * WORLD_SCALE, e[1], e[2] * WORLD_SCALE); dummy.rotation.set(0, 0, 0); dummy.scale.set(e[3], e[4], e[5]); };
  const placeCone = (e) => { dummy.position.set(e[0] * WORLD_SCALE, e[1], e[2] * WORLD_SCALE); dummy.rotation.set(0, 0, 0); dummy.scale.set(e[3], e[4], e[3]); };
  const placeDome = (e) => { dummy.position.set(e[0] * WORLD_SCALE, e[1], e[2] * WORLD_SCALE); dummy.rotation.set(0, 0, 0); dummy.scale.set(e[3], e[3], e[3]); };
  addCityMesh(bx, unitBox, assetMat, placeBox, 6);
  addCityMesh(dt, unitBox, assetMat, placeBox, 6);
  addCityMesh(gw, unitBox, cityWinMat, placeBox, 6);
  addCityMesh(rf, bldConeGeo, assetMat, placeCone, 5);
  addCityMesh(dm, bldDomeGeo, assetMat, placeDome, 4);
  addCityMesh(ps, bldCylGeo, assetMat, placeCone, 5);
  for (const e of bx) {
    const k = topKey(e[0], e[2]);
    const top = e[1] + e[4] / 2;
    if (top > (buildingTopH.get(k) || 0)) buildingTopH.set(k, top);
  }
}



// No drifting voxel clouds: from an isometric diorama angle they drift in front
// of the city and mask it. The 2D map keeps clouds in the sky backdrop only.
const clouds = [];

// day / night cycle (4 min loop, N pauses)
let dayT = 0.18, dayAuto = true;
const NIGHT_BG = new THREE.Color(0x131c33);
const DAY_SUN = new THREE.Color(0xfff3e0);
const NIGHT_SUN = new THREE.Color(0x8fb4ff);
const tmpSky = new THREE.Color();
const tmpSun = new THREE.Color();
const _skyWhite = new THREE.Color(0xffffff);
function applyDayNight(dt, t) {
  if (dayAuto) dayT = (dayT + dt / 240) % 1;
  const elev = Math.sin(dayT * Math.PI * 2);
  const k = THREE.MathUtils.smoothstep(elev, -0.12, 0.3);
  tmpSky.copy(NIGHT_BG).lerp(DAY_BG, k);
  scene.background.copy(tmpSky);
  scene.fog.color.copy(tmpSky);
  sun.intensity = 0.6 + (1.5 - 0.6) * k;
  tmpSun.copy(NIGHT_SUN).lerp(DAY_SUN, k);
  sun.color.copy(tmpSun);
  sun.position.set(140 * Math.cos(dayT * Math.PI * 2) * WORLD_SCALE, 40 + Math.max(0.05, elev) * 130, 60 * WORLD_SCALE);
  hemi.intensity = 0.3 + (0.5 - 0.3) * k;
   winMat.emissiveIntensity = 2.4 - 1.4 * k;
   if (typeof lampGlowMat !== 'undefined' && lampGlowMat) lampGlowMat.emissiveIntensity = 2.0 - 1.1 * k;
   // Animate the ocean: time, sun direction, sky + fog colours.
   waterUniforms.uTime.value = t;
   waterUniforms.uSunDir.value.copy(sun.position).normalize();
   waterUniforms.uSkyTop.value.copy(scene.background);
   waterUniforms.uSkyHorizon.value.copy(scene.background).lerp(_skyWhite, 0.28);
   waterUniforms.uFogColor.value.copy(scene.fog.color);
   foamMat.opacity = 0.55 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.5));
   if (foamMesh) foamMesh.position.y = Math.sin(t * 1.4) * 0.05;
  for (const c of clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 90 * WORLD_SCALE) c.position.x = -90 * WORLD_SCALE;
  }
  for (const b of beams) b.rotation.y += dt * 0.8;
}

// ---------- voxel robot citizens (instanced parts, live snapshot) ----------
// parts: [key, w,h,d, ox,oy,oz, colorSlot] — offsets relative to feet origin
const PARTS = [
  ['legL', 0.26, 0.5, 0.3, -0.17, 0.25, 0, 'secondary'],
  ['legR', 0.26, 0.5, 0.3, 0.17, 0.25, 0, 'secondary'],
  ['shoeL', 0.3, 0.14, 0.36, -0.17, 0.07, 0.02, 'shoe'],
  ['shoeR', 0.3, 0.14, 0.36, 0.17, 0.07, 0.02, 'shoe'],
  ['torso', 0.8, 0.66, 0.5, 0, 0.83, 0, 'primary'],
  ['core', 0.16, 0.16, 0.1, 0, 0.86, 0.24, 'accent'],
  ['belt', 0.82, 0.12, 0.52, 0, 0.56, 0, 'secondary'],
  ['head', 0.92, 0.66, 0.8, 0, 1.49, 0, 'primary'],
  ['visor', 0.6, 0.2, 0.08, 0, 1.54, 0.38, 'visor'],
  ['eyeL', 0.12, 0.12, 0.05, -0.15, 1.54, 0.42, 'accent'],
  ['eyeR', 0.12, 0.12, 0.05, 0.15, 1.54, 0.42, 'accent'],
  ['nose', 0.1, 0.12, 0.2, 0, 1.38, 0.4, 'skin'],
  ['helmet', 0.98, 0.3, 0.86, 0, 1.88, 0, 'secondary'],
  ['brim', 1.24, 0.07, 0.95, 0, 1.745, 0.02, 'secondary'],
  ['antenna', 0.05, 0.22, 0.05, 0, 2.16, 0, 'secondary'],
  ['tip', 0.12, 0.12, 0.12, 0, 2.32, 0, 'accent'],
  ['armL', 0.2, 0.5, 0.24, -0.52, 0.85, 0, 'primary'],
  ['armR', 0.2, 0.5, 0.24, 0.52, 0.85, 0, 'primary'],
  ['handL', 0.22, 0.18, 0.26, -0.58, 0.48, 0, 'skin'],
  ['handR', 0.22, 0.18, 0.26, 0.58, 0.48, 0, 'skin'],
];
const SHOE = new THREE.Color(0x1e293b);
// robot body scale: 0.8 keeps citizens readable without merging into a carpet
const RS = 0.8;
const partMeshes = {};
// far-zoom citizen dots: 1 instanced box per citizen when zoomed out
let dotMesh = null;
function buildDotMesh(n) {
  if (dotMesh) {
    scene.remove(dotMesh);
    dotMesh.dispose();
  }
  dotMesh = new THREE.InstancedMesh(unitBox, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), Math.max(n, 1));
  dotMesh.count = 0;
  dotMesh.visible = false;
  dotMesh.frustumCulled = false;
  dotMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(dotMesh);
}
for (const [key] of PARTS) {
  const m = new THREE.InstancedMesh(unitBox, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), 0);
  m.count = 0;
  m.castShadow = true;
  m.frustumCulled = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(m);
  partMeshes[key] = m;
}
buildDotMesh(0);

function avatarColors(avatarId) {
  const def = AVATAR_CATALOG[avatarId] ?? AVATAR_CATALOG.astronaut;
  const c = def.colors || {};
  const primary = new THREE.Color(c.primary || '#38bdf8');
  const secondary = new THREE.Color(c.secondary || '#0f172a');
  const accent = new THREE.Color(c.accent || '#f59e0b');
  const skin = new THREE.Color(c.skin || '#fde047');
  return {
    primary, secondary, accent, skin,
    shoe: SHOE,
    visor: secondary.clone().multiplyScalar(0.55),
  };
}

const citizens = new Map();
let ownSpot = null;
// far-zoom LOD: dots beyond ~95 units, full robots inside ~80 (hysteresis)
let dotsOn = false;
function syncCitizens(occupied) {
  const seen = new Set();
  for (const o of occupied) {
    if (!o || o.x === undefined) continue;
    seen.add(o.citizenId);
    let c = citizens.get(o.citizenId);
    if (!c) {
      c = {
        id: o.citizenId, hx: o.x, hy: o.y,
        x: o.x, z: o.y, yaw: Math.random() * Math.PI * 2,
        phase: Math.random() * 10, colors: avatarColors(o.avatarId),
        wanderer: Math.random() < 0.04, tx: o.x, tz: o.y, idle: Math.random() * 3,
        speed: 0.9 + Math.random() * 0.8,
        displayName: o.displayName || 'Anonymous', tagline: o.tagline || '',
        bio: o.bio || '', avatarId: o.avatarId || 'astronaut',
        websiteUrl: o.websiteUrl || '', githubUrl: o.githubUrl || '',
        twitterUrl: o.twitterUrl || '', facebookUrl: o.facebookUrl || '',
        instagramUrl: o.instagramUrl || '', linkedinUrl: o.linkedinUrl || '',
        youtubeUrl: o.youtubeUrl || '', claimedAt: o.claimedAt || null,
        isOnline: !!o.isOnline, isVerified: !!o.isVerified,
        customAvatarData: o.customAvatarData || '',
      };
      citizens.set(o.citizenId, c);
    } else {
      c.hx = o.x; c.hy = o.y;
      c.colors = avatarColors(o.avatarId);
      c.displayName = o.displayName || c.displayName;
      c.tagline = o.tagline || '';
      c.bio = o.bio || '';
      c.avatarId = o.avatarId || c.avatarId;
      c.websiteUrl = o.websiteUrl || '';
      c.githubUrl = o.githubUrl || '';
      c.twitterUrl = o.twitterUrl || '';
      c.facebookUrl = o.facebookUrl || '';
      c.instagramUrl = o.instagramUrl || '';
      c.linkedinUrl = o.linkedinUrl || '';
      c.youtubeUrl = o.youtubeUrl || '';
      c.isOnline = !!o.isOnline;
      c.isVerified = !!o.isVerified;
      c.customAvatarData = o.customAvatarData || '';
    }
  }
  for (const id of [...citizens.keys()]) {
    if (!seen.has(id)) citizens.delete(id);
  }
  // realloc part buffers to citizen count
  const n = citizens.size;
  for (const [key] of PARTS) {
    const old = partMeshes[key];
    scene.remove(old);
    old.dispose();
    const m = new THREE.InstancedMesh(unitBox, old.material, Math.max(n, 1));
    m.count = 0;
    m.castShadow = true;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m);
    partMeshes[key] = m;
  }
  buildDotMesh(n);
  // grow a unique building on every claimed urban plot
  try { buildCity(occupied); } catch (err) { console.warn('[voxel] buildCity failed:', err); }
  // paint static colors
  repartition();
}

let detailList = [];
let dotList = [];
function repartition() {
  const tx = controls.target.x, tz = controls.target.z;
  const camDist = camera.position.distanceTo(controls.target);
  const R = Math.max(25, Math.min(60, camDist * 0.3));
  const R2 = R * R;
  const scored = [];
  for (const c of citizens.values()) {
    const dx = c.x - tx, dz = c.z - tz;
    scored.push([dx * dx + dz * dz, c]);
  }
  scored.sort((a, b) => a[0] - b[0]);
  detailList = [];
  dotList = [];
  // When you're controlling the player avatar, hide your own citizen robot so
  // you don't render twice at your claimed spot.
  const hideOwn = (walkMode || fpsMode) && ownSpot;
  for (const [d2, c] of scored) {
    if (hideOwn && c.hx === ownSpot.x && c.hy === ownSpot.y) continue;
    if (d2 <= R2 && detailList.length < (IS_MOBILE ? 70 : 140)) { detailList.push(c); }
    else { dotList.push(c); }
  }
  for (const [pi, [key, , , , , , , slot]] of PARTS.entries()) {
    const mesh = partMeshes[key];
    for (let i = 0; i < detailList.length; i++) mesh.setColorAt(i, detailList[i].colors[slot]);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = detailList.length;
  }
  for (let i = 0; i < dotList.length; i++) dotMesh.setColorAt(i, dotList[i].colors.primary);
  if (dotMesh.instanceColor) dotMesh.instanceColor.needsUpdate = true;
  dotMesh.count = dotList.length;
  dotMesh.visible = dotList.length > 0;
  const botsEl = document.getElementById('hud-bots');
  if (botsEl) botsEl.textContent = detailList.length + ' robots · ' + dotList.length + ' dots';
}

function updateDots() {
  for (let i = 0; i < dotList.length; i++) {
    const c = dotList[i];
    dummy.position.set(c.x * WORLD_SCALE, (c.groundY || 0) + 0.3, c.z * WORLD_SCALE);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0.34 * BOX_SCALE, 0.55 * BOX_SCALE, 0.34 * BOX_SCALE);
    dummy.updateMatrix();
    dotMesh.setMatrixAt(i, dummy.matrix);
  }
  dotMesh.count = dotList.length;
  dotMesh.instanceMatrix.needsUpdate = true;
}

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
function updateCitizens(t, dt, frame) {
  const arr = detailList;
  for (const [pi, [key, w, h, d, ox, oy, oz]] of PARTS.entries()) {
    const mesh = partMeshes[key];
    for (let i = 0; i < arr.length; i++) {
      const c = arr[i];
      const walking = c.wanderer && c.moving;
      const bob = walking ? Math.abs(Math.cos(c.phase)) * 0.06 : Math.sin(t * 2 + c.phase) * 0.025;
      let px = c.x, py = c.groundY + bob, pz = c.z, ry = c.yaw, rx = 0, sy = 1;
      let ox2 = ox, oy2 = oy, oz2 = oz;
      if (key === 'armL' || key === 'armR') {
        rx = walking ? Math.sin(c.phase) * 0.55 * (key === 'armL' ? 1 : -1) : Math.sin(t * 2 + c.phase) * 0.05;
      }
      if (key === 'handL' || key === 'handR') {
        const sgn = key === 'handL' ? -1 : 1;
        const sw = walking ? Math.sin(c.phase) * 0.55 * (key === 'handL' ? 1 : -1) : 0;
        ox2 = sgn * 0.52 - Math.sin(sw) * 0.0;
        oy2 = 0.55 + (-0.37) * Math.cos(sw);
        oz2 = 0.37 * Math.sin(sw) * 0 + (-0.37) * 0;
        oy2 = 0.55 - 0.37 * Math.cos(sw);
        oz2 = -0.37 * Math.sin(sw) * -1;
        rx = sw;
      }
      if (key === 'head' || key === 'visor' || key === 'eyeL' || key === 'eyeR' || key === 'nose' ||
          key === 'helmet' || key === 'brim' || key === 'antenna' || key === 'tip') {
        oy2 = oy + (walking ? Math.abs(Math.cos(c.phase)) * 0.03 : Math.sin(t * 2 + c.phase) * 0.02);
      }
      if (key === 'torso' || key === 'core' || key === 'belt') {
        if (walking && c.squash > 0) sy = 1 + c.squash;
      }
      ox2 *= RS; oy2 *= RS; oz2 *= RS;
      _e.set(rx, ry, 0);
      _q.setFromEuler(_e);
      _p.set(px * WORLD_SCALE + ox2 * Math.cos(ry) + oz2 * Math.sin(ry), py + oy2, pz * WORLD_SCALE - ox2 * Math.sin(ry) + oz2 * Math.cos(ry));
      _s.set(w * RS, h * RS * sy, d * RS);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    mesh.count = arr.length;
    mesh.instanceMatrix.needsUpdate = true;
  }
}

  // ---------- ambient animals: circling birds + darting surf fish ----------
  const birds = [];
  const birdBodyMat = new THREE.MeshStandardMaterial({ color: 0xe8eef6, roughness: 0.9 });
  const birdWingMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
  // gull-like: pale bodies read against dark jungle; routes favor open sky
  // over city, beach and ocean rather than the canopy
  const birdRoutes = [
    { cx: 50 * WORLD_SCALE, cz: 45 * WORLD_SCALE }, { cx: 40 * WORLD_SCALE, cz: 100 * WORLD_SCALE }, { cx: 70 * WORLD_SCALE, cz: 112 * WORLD_SCALE },
    { cx: 70 * WORLD_SCALE, cz: 25 * WORLD_SCALE }, { cx: 50 * WORLD_SCALE, cz: 58 * WORLD_SCALE }, { cx: 100 * WORLD_SCALE, cz: 106 * WORLD_SCALE },
  ];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(unitBox, birdBodyMat);
    body.scale.set(0.5, 0.18, 0.7);
    g.add(body);
    const wings = [];
    for (const sgn of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sgn * 0.2, 0.08, 0);
      g.add(pivot);
      const w = new THREE.Mesh(unitBox, birdWingMat);
      w.scale.set(0.85, 0.06, 0.42);
      w.position.set(sgn * 0.45, 0, 0);
      pivot.add(w);
      wings.push(pivot);
    }
    scene.add(g);
    birds.push({
      g, wings,
      cx: birdRoutes[i].cx, cz: birdRoutes[i].cz, cy: 17 + (i % 3) * 2.5,
      r: 12 + (i % 4) * 3, sp: (0.16 + (i % 3) * 0.05) * (i % 2 === 0 ? 1 : -1),
      ph: Math.random() * 10,
    });
  }
  const fishes = [];
  const fishCols = [0x67e8f9, 0xe2e8f0, 0xfbbf24, 0x38bdf8, 0xfb7185];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(
      unitBox,
      new THREE.MeshStandardMaterial({ color: fishCols[i % fishCols.length], roughness: 0.5 })
    );
    m.scale.set(0.36, 0.14, 0.16);
    scene.add(m);
    fishes.push({
      m,
      x: 8 + Math.random() * 84, z: 112 + Math.random() * 14,
      dir: Math.random() * Math.PI * 2, sp: 1.5 + Math.random() * 2.2,
      turn: 0, jump: Math.random() * 6,
    });
  }
  // ---------- marine life (matches 2D MarineManager): freighters, sailboats,
  // speedboats, sharks, surfers, dolphins ----------
  const _marineMats = new Map();
  const mmat = (hex) => { if (!_marineMats.has(hex)) _marineMats.set(hex, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8, flatShading: true })); return _marineMats.get(hex); };
  const mbox = (parent, hex, w, h, d, x, y, z) => { const m = new THREE.Mesh(unitBox, mmat(hex)); m.scale.set(w, h, d); m.position.set(x, y, z); parent.add(m); return m; };
  const msphere = (parent, hex, r, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), mmat(hex)); m.position.set(x, y, z); parent.add(m); return m; };
  const mcone = (parent, hex, r, h, x, y, z, sides) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, sides || 4), mmat(hex)); m.position.set(x, y, z); parent.add(m); return m; };
  const marine = [];
  function addMarine(kind, gx, gy, dir, speed, build) {
    const g = new THREE.Group();
    const extra = build(g) || {};
    scene.add(g);
    marine.push({ kind, g, gx, gy, dir, speed, ph: Math.random() * 10, baseY: extra.baseY ?? 0.5, wake: extra.wake || null });
  }
  for (let i = 0; i < 2; i++) {
    addMarine('ship', 20 + i * 70, 122 + i * 2, 1, 0.14, (g) => {
      mbox(g, 0x1e293b, 6.2, 1.1, 2.2, 0, 0.55, 0);
      const cols = [0xb23a3a, 0xc9a227, 0x22d3ee, 0x4a8a43];
      for (let k = 0; k < 4; k++) mbox(g, cols[k % 4], 1.0, 0.7, 1.5, -2.0 + k * 1.15, 1.45, 0);
      mbox(g, 0x475569, 1.2, 1.6, 1.8, 2.3, 1.85, 0);
      mbox(g, 0x7dd3fc, 0.5, 0.3, 0.1, 2.3, 2.1, 1.0);
      return { baseY: 0.5 };
    });
  }
  for (let i = 0; i < 3; i++) {
    addMarine('sailboat', 15 + i * 40, 114 + i, i % 2 ? -1 : 1, 0.4, (g) => {
      mbox(g, 0x8a5c36, 1.8, 0.5, 0.85, 0, 0.25, 0);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 6), mmat(0x8a5c36));
      mast.position.y = 1.3; g.add(mast);
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.4), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9, side: THREE.DoubleSide }));
      sail.position.set(0.35, 1.35, 0); g.add(sail);
      return { baseY: 0.4 };
    });
  }
  for (let i = 0; i < 2; i++) {
    addMarine('speedboat', 30 + i * 55, 111, i % 2 ? -1 : 1, 1.7, (g) => {
      mbox(g, 0xf8fafc, 2.2, 0.5, 1.0, 0, 0.28, 0);
      mbox(g, 0x0f172a, 0.85, 0.45, 0.7, 0.1, 0.68, 0);
      const wake = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.5), new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.35, depthWrite: false }));
      wake.rotation.x = -Math.PI / 2; wake.position.set(-2.2, 0.05, 0); g.add(wake);
      return { baseY: 0.45, wake };
    });
  }
  for (let i = 0; i < 3; i++) {
    addMarine('shark', -5 + i * 55, 113 + i, i % 2 ? -1 : 1, 0.8, (g) => {
      const body = msphere(g, 0x475569, 0.6, 0, 0.1, 0); body.scale.set(2.4, 0.55, 0.9);
      mcone(g, 0xe2e8f0, 0.42, 1.3, 0, 0.7, 0, 4);
      const wake = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.2, 18), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
      wake.rotation.x = -Math.PI / 2; wake.position.y = 0.02; g.add(wake);
      return { baseY: 0.35, wake };
    });
  }
  for (let i = 0; i < 3; i++) {
    addMarine('surfer', 20 + i * 35, 110.6, i % 2 ? -1 : 1, 0.3, (g) => {
      mbox(g, 0xfacc15, 1.9, 0.14, 0.7, 0, 0.12, 0);
      mbox(g, 0x0f172a, 0.4, 0.8, 0.4, 0, 0.6, 0);
      msphere(g, 0xfde68a, 0.24, 0, 1.15, 0);
      return { baseY: 0.5 };
    });
  }
  for (let i = 0; i < 3; i++) {
    addMarine('dolphin', 10 + i * 50, 112 + i, i % 2 ? -1 : 1, 1.2, (g) => {
      const body = msphere(g, 0x64748b, 0.45, 0, 0.2, 0); body.scale.set(2.4, 0.6, 0.7);
      mcone(g, 0x475569, 0.2, 0.6, 0, 0.5, 0, 4);
      return { baseY: 0.4 };
    });
  }
  function stepMarine(t, dt) {
    for (const m of marine) {
      m.gx += m.dir * m.speed * dt;
      if (m.gx < -22) m.gx = 123;
      if (m.gx > 123) m.gx = -22;
      let y = m.baseY + Math.sin(t * 1.2 + m.ph) * 0.12;
      if (m.kind === 'dolphin') {
        const jp = Math.sin(t * 0.9 + m.ph);
        if (jp > 0.5) { const k = (jp - 0.5) * 2; y += Math.sin(k * Math.PI) * 1.6; m.g.rotation.z = -Math.sin(k * Math.PI) * 0.8; }
        else m.g.rotation.z = 0;
      }
      if (m.kind === 'shark') y += Math.sin(t * 0.8 + m.ph) * 0.06;
      m.g.position.set(m.gx * WORLD_SCALE, y, m.gy * WORLD_SCALE);
      m.g.rotation.y = m.dir > 0 ? 0 : Math.PI;
      if (m.wake) m.wake.material.opacity = 0.2 + 0.18 * Math.abs(Math.sin(t * 2.5 + m.ph));
    }
  }
  function stepAnimals(t, dt) {
    for (const b of birds) {
      b.ph += b.sp * dt;
      const px = b.cx + Math.cos(b.ph) * b.r;
      const pz = b.cz + Math.sin(b.ph) * b.r;
      b.g.position.set(px, b.cy + Math.sin(t * 1.3 + b.ph) * 0.8, pz);
      b.g.rotation.y = Math.atan2(-Math.sin(b.ph) * Math.sign(b.sp), Math.cos(b.ph) * Math.sign(b.sp)) + (b.sp > 0 ? -Math.PI / 2 : Math.PI / 2);
      const flap = Math.sin(t * 9 + b.ph * 3) * 0.55;
      b.wings[0].rotation.z = flap;
      b.wings[1].rotation.z = -flap;
    }
    for (const f of fishes) {
      f.turn -= dt;
      f.jump -= dt;
      if (f.turn <= 0) {
        f.dir += (Math.random() - 0.5) * 2.2;
        f.turn = 0.8 + Math.random() * 2;
      }
      f.x += Math.cos(f.dir) * f.sp * dt;
      f.z += Math.sin(f.dir) * f.sp * dt;
      if (f.x < 6 || f.x > 96) { f.dir = Math.PI - f.dir; f.x = Math.max(6, Math.min(96, f.x)); }
      if (f.z < 111 || f.z > 126) { f.dir = -f.dir; f.z = Math.max(111, Math.min(126, f.z)); }
      let y = 0.5 + Math.sin(t * 3 + f.x) * 0.08;
      let tilt = 0;
      if (f.jump < 0.4) {
        const k = (0.4 - f.jump) / 0.4;
        y = 0.5 + Math.sin(k * Math.PI) * 1.5;
        tilt = -Math.sin(k * Math.PI) * 0.7;
      }
      if (f.jump < -0.1) f.jump = 3 + Math.random() * 7;
      f.m.position.set(f.x * WORLD_SCALE, y, f.z * WORLD_SCALE);
      f.m.rotation.y = -f.dir;
      f.m.rotation.z = Math.sin(t * 12 + f.x) * 0.25 + tilt;
    }
    stepMarine(t, dt);
  }

  // ---------- city traffic: cyber cabs, cruisers, vans, scooters ----------
  const CAR_ROADS_X = [8, 20, 35, 65, 80, 92];
  const CAR_ROADS_Y = [8, 20, 35, 65, 80, 86];
  const cars = [];
  function carMesh(type) {
    const g = new THREE.Group();
    let body = 0xfacc15, L = 1.7, W = 0.9, H = 0.5;
    if (type === 'synth') { body = Math.random() < 0.5 ? 0xec4899 : 0x8b5cf6; L = 1.9; W = 0.95; H = 0.45; }
    else if (type === 'van') { body = 0x38bdf8; L = 2.0; W = 1.0; H = 0.7; }
    else if (type === 'scooter') { body = 0x10b981; L = 0.9; W = 0.4; H = 0.4; }
    mbox(g, body, L, H, W, 0, H / 2 + 0.15, 0);
    mbox(g, 0x0f172a, L * 0.5, H * 0.7, W * 0.85, 0, H + 0.15, 0);
    const hl = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ color: 0xfef08a })); hl.scale.set(0.08, 0.12, W * 0.7); hl.position.set(L / 2, H / 2 + 0.15, 0); g.add(hl);
    const tl = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ color: 0xef4444 })); tl.scale.set(0.08, 0.12, W * 0.7); tl.position.set(-L / 2, H / 2 + 0.15, 0); g.add(tl);
    scene.add(g);
    return g;
  }
  function spawnCar() {
    const axisX = Math.random() < 0.5;
    const corridor = axisX ? CAR_ROADS_Y[Math.floor(Math.random() * CAR_ROADS_Y.length)] : CAR_ROADS_X[Math.floor(Math.random() * CAR_ROADS_X.length)];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const type = ['taxi', 'synth', 'van', 'scooter', 'taxi'][Math.floor(Math.random() * 5)];
    cars.push({ g: carMesh(type), axisX, corridor, dir, lane: dir > 0 ? 0.24 : -0.24, pos: dir > 0 ? 4 + Math.random() * 24 : 84 - Math.random() * 24, speed: 4 + Math.random() * 3 });
  }
  for (let i = 0; i < 14; i++) spawnCar();
  function stepCars(t, dt) {
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      c.pos += c.dir * c.speed * dt;
      if (c.pos < 4 || c.pos > 86) { scene.remove(c.g); cars.splice(i, 1); continue; }
      let gx, gy;
      if (c.axisX) { gx = c.pos; gy = c.corridor + c.lane; c.g.rotation.y = c.dir > 0 ? 0 : Math.PI; }
      else { gx = c.corridor + c.lane; gy = c.pos; c.g.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      c.g.position.set(gx * WORLD_SCALE, 1, gy * WORLD_SCALE);
    }
    if (cars.length < 14 && Math.random() < 0.03) spawnCar();
  }

  // ---------- northern cyber train + tunnel portals ----------
  const TRAIN_TRACK_Z = -2.5;
  const trainGroup = new THREE.Group();
  scene.add(trainGroup);
  const TRAIN_CARS = 7, TRAIN_GAP = 4.2;
  const trainCars = [];
  for (let i = 0; i < TRAIN_CARS; i++) {
    const car = new THREE.Group();
    mbox(car, 0xe2e8f0, 3.6, 1.3, 1.6, 0, 1.0, 0);
    mbox(car, 0x0284c7, 3.6, 0.16, 1.62, 0, 1.06, 0);
    for (let w = 0; w < 5; w++) {
      const win = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      win.scale.set(0.5, 0.4, 1.64); win.position.set(-1.2 + w * 0.6, 1.35, 0); car.add(win);
    }
    mbox(car, 0x0284c7, 0.8, 1.1, 1.5, 1.9, 0.9, 0);
    car.position.x = -i * TRAIN_GAP;
    trainGroup.add(car);
    trainCars.push(car);
  }
  // Tunnel portals at the map edges, with a dark bore extending outward so the
  // train visibly enters the mountain instead of floating in the void.
  const PORTAL_W = -24, PORTAL_E = 124;
  for (const tx of [PORTAL_W, PORTAL_E]) {
    const outward = tx < 0 ? -1 : 1;
    const portal = new THREE.Group();
    mbox(portal, 0x3a4356, 3.0, 4.2, 5.6, 0, 2.1, 0);
    const bore = mbox(portal, 0x05070d, 4.5, 2.6, 3.0, outward * 3.2, 1.3, 0);
    bore.castShadow = false;
    const hole = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ color: 0x05070d }));
    hole.scale.set(0.6, 2.6, 3.0); hole.position.set(outward * -1.4, 1.3, 0); portal.add(hole);
    portal.position.set(tx * WORLD_SCALE, 0, TRAIN_TRACK_Z * WORLD_SCALE);
    scene.add(portal);
  }
  const train = { active: false, x: -60, dir: 1, speed: 11, cooldown: 30, tunnel: 0, wraps: 0 };
  let trainRide = false, trainRideSaved = null;
  function boardTrain() {
    if (!train.active || trainRide) return;
    trainRide = true; train.wraps = 0;
    trainRideSaved = { x: player.position.x, y: player.position.y, z: player.position.z };
    if (fpsMode) setFps(false);
    if (walkMode) setWalk(false);
    controls.enabled = false;
    const hint = document.querySelector('.hint');
    if (hint) hint.textContent = '🚆 Riding the Cyber Metro — E or Esc to get off';
  }
  function endTrainRide() {
    trainRide = false;
    if (trainRideSaved) player.position.set(trainRideSaved.x, trainRideSaved.y, trainRideSaved.z);
    controls.enabled = true;
    const hint = document.querySelector('.hint');
    if (hint) hint.textContent = 'edge / right-drag to pan · scroll to zoom · fixed isometric view';
  }
  function stepTrain(t, dt) {
    if (!train.active) {
      train.cooldown -= dt * 60;
      if (train.cooldown <= 0) { train.active = true; train.dir = Math.random() < 0.5 ? 1 : -1; train.x = train.dir === 1 ? PORTAL_W - 50 : PORTAL_E + 50; }
    } else if (train.tunnel > 0) {
      // Inside the tunnel: hold, then reverse and come back out the same portal.
      train.tunnel -= dt;
      if (train.tunnel <= 0) train.dir *= -1;
    } else {
      train.x += train.dir * train.speed * dt;
      if (train.dir === 1 && train.x >= PORTAL_E) { train.x = PORTAL_E; train.tunnel = 1.6; train.wraps++; }
      if (train.dir === -1 && train.x <= PORTAL_W) { train.x = PORTAL_W; train.tunnel = 1.6; train.wraps++; }
      if (trainRide && train.wraps >= 1) {
        if (train.dir === 1 && train.x > PORTAL_W + 16) endTrainRide();
        if (train.dir === -1 && train.x < PORTAL_E - 16) endTrainRide();
      }
    }
    trainGroup.position.set(train.x * WORLD_SCALE, 0, TRAIN_TRACK_Z * WORLD_SCALE);
    trainGroup.rotation.y = train.dir === 1 ? 0 : Math.PI;
    // Hide each car once it passes into the tunnel so nothing floats in the void.
    const inTunnel = train.tunnel > 0;
    for (let i = 0; i < trainCars.length; i++) {
      const worldX = train.dir === 1 ? train.x - i * TRAIN_GAP : train.x + i * TRAIN_GAP;
      trainCars[i].visible = !inTunnel && worldX >= PORTAL_W - 0.5 && worldX <= PORTAL_E + 0.5;
    }
    if (trainRide) {
      // Side-follow camera kept SOUTH of the track so it never sits inside the
      // northern mountains (which made the whole screen go dark).
      const camX = Math.max(PORTAL_W + 4, Math.min(PORTAL_E - 4, train.x)) * WORLD_SCALE;
      camera.position.set(camX, 8.5, (TRAIN_TRACK_Z + 15) * WORLD_SCALE);
      camera.lookAt(camX + train.dir * 4, 2.2, TRAIN_TRACK_Z * WORLD_SCALE);
    }
  }

  // ---------- beach boat mini-game (desktop only) ----------
  const BOAT_DOCK = { x: 50, z: 110 };
  // wooden pier from the boardwalk out over the surf
  {
    const pier = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const plank = new THREE.Mesh(unitBox, mmat(0x8a5c36));
      plank.scale.set(1.7, 0.14, 0.95); plank.position.set(0, 0, i * 0.98);
      pier.add(plank);
    }
    for (const sx of [-0.75, 0.75]) {
      for (let i = 0; i < 6; i += 2) {
        const post = new THREE.Mesh(unitBox, mmat(0x5e4028));
        post.scale.set(0.14, 1.6, 0.14); post.position.set(sx, -0.75, i * 0.98);
        pier.add(post);
      }
    }
    pier.position.set(BOAT_DOCK.x * WORLD_SCALE, 1.15, 105 * WORLD_SCALE);
    scene.add(pier);
  }
  const boatGroup = new THREE.Group();
  {
    mbox(boatGroup, 0x8a5c36, 3.0, 0.7, 1.5, 0, 0.35, 0);        // hull
    mbox(boatGroup, 0xb23a3a, 3.3, 0.22, 1.6, 0, 0.74, 0);       // gunwale stripe
    mbox(boatGroup, 0x8a5c36, 0.9, 0.55, 1.1, 1.75, 0.4, 0);     // bow
    mbox(boatGroup, 0xf1f5f9, 1.3, 0.85, 1.05, -0.5, 1.15, 0);   // cabin
    mbox(boatGroup, 0x22d3ee, 0.5, 0.35, 0.06, -0.5, 1.2, 0.54); // cabin window
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), mmat(0x5e4028));
    mast.position.set(0.5, 1.95, 0); boatGroup.add(mast);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.7), new THREE.MeshStandardMaterial({ color: 0xf8fafc, side: THREE.DoubleSide, roughness: 0.9 }));
    sail.position.set(1.05, 2.0, 0); boatGroup.add(sail);
    mbox(boatGroup, 0xef4444, 0.45, 0.28, 0.03, 0.5, 3.35, 0);   // pennant
    boatGroup.scale.setScalar(0.68);
    scene.add(boatGroup);
  }
  const boat = { x: BOAT_DOCK.x, z: BOAT_DOCK.z, heading: 0, speed: 0 };
  let boatRide = false, boatSaved = null;
  boatGroup.position.set(boat.x * WORLD_SCALE, 1, boat.z * WORLD_SCALE);
  boatGroup.rotation.y = boat.heading;
  function nearBoat() {
    if (IS_MOBILE) return false;
    const dx = player.position.x - boat.x * WORLD_SCALE;
    const dz = player.position.z - boat.z * WORLD_SCALE;
    return Math.hypot(dx, dz) < 6.5;
  }
  function boardBoat() {
    if (boatRide || IS_MOBILE) return;
    boatRide = true; boat.speed = 0;
    boatSaved = { x: player.position.x, y: player.position.y, z: player.position.z };
    if (fpsMode) setFps(false);
    if (walkMode) setWalk(false);
    controls.enabled = false;
    const hint = document.querySelector('.hint');
    if (hint) hint.textContent = '🚤 Sailing · ARROWS / WASD to steer · B to dock';
  }
  function endBoatRide() {
    boatRide = false; boat.speed = 0;
    if (boatSaved) player.position.set(boatSaved.x, boatSaved.y, boatSaved.z);
    controls.enabled = true;
    const hint = document.querySelector('.hint');
    if (hint) hint.textContent = 'edge / right-drag to pan · scroll to zoom · fixed isometric view';
  }
  function stepBoat(t, dt) {
    if (!boatRide) {
      boatGroup.position.set(boat.x * WORLD_SCALE, 1 + Math.sin(t * 1.4) * 0.08, boat.z * WORLD_SCALE);
      boatGroup.rotation.z = Math.sin(t * 1.1) * 0.05;
      return;
    }
    const acc = 7, turn = 1.7, maxSpeed = 9;
    if (keysDown.has('ArrowUp') || keysDown.has('KeyW')) boat.speed = Math.min(maxSpeed, boat.speed + acc * dt);
    else if (keysDown.has('ArrowDown') || keysDown.has('KeyS')) boat.speed = Math.max(-maxSpeed * 0.5, boat.speed - acc * dt);
    else boat.speed *= (1 - Math.min(1, dt * 1.6));
    if (keysDown.has('ArrowLeft') || keysDown.has('KeyA')) boat.heading += turn * dt;
    if (keysDown.has('ArrowRight') || keysDown.has('KeyD')) boat.heading -= turn * dt;
    // The hull's bow points along local +X, so world forward = (cos, 0, -sin).
    const nx = boat.x + Math.cos(boat.heading) * boat.speed * dt;
    const nz = boat.z - Math.sin(boat.heading) * boat.speed * dt;
    // Stay in the (slightly widened) southern ocean.
    const onWater = nz >= 110 && nz < 138 && nx > -20 && nx < 120;
    if (onWater) { boat.x = nx; boat.z = nz; } else { boat.speed = 0; }
    boatGroup.position.set(boat.x * WORLD_SCALE, 1 + Math.sin(t * 2 + boat.x) * 0.06, boat.z * WORLD_SCALE);
    boatGroup.rotation.y = boat.heading;
    boatGroup.rotation.z = Math.sin(t * 1.6) * 0.04;
    const bx = boat.x * WORLD_SCALE, bz = boat.z * WORLD_SCALE;
    camera.position.set(bx - Math.cos(boat.heading) * 6.5, 5.2, bz + Math.sin(boat.heading) * 6.5);
    camera.lookAt(bx, 1.1, bz);
  }
  const boatPrompt = document.createElement('div');
  boatPrompt.style.cssText = 'position:fixed;left:50%;bottom:78px;transform:translateX(-50%);z-index:120;pointer-events:none;display:none;font:12px ui-monospace,Menlo,monospace;color:#f8fafc;background:rgba(9,13,24,.82);border:1px solid #263247;border-radius:999px;padding:6px 14px;';
  boatPrompt.textContent = '🚤 Press B to ride the boat';
  document.body.appendChild(boatPrompt);

  // ---------- jungle wildlife ----------
  const wildlife = [];
  function addWild(kind, gx, gy, zone) {
    const g = new THREE.Group();
    if (kind === 'monkey') {
      const b = msphere(g, 0x6b4a2f, 0.28, 0, 0.55, 0); b.scale.set(1, 1.1, 0.8);
      msphere(g, 0x8a6238, 0.2, 0, 0.88, 0);
      mbox(g, 0x6b4a2f, 0.1, 0.5, 0.1, -0.22, 0.25, 0); mbox(g, 0x6b4a2f, 0.1, 0.5, 0.1, 0.22, 0.25, 0);
      mbox(g, 0x6b4a2f, 0.66, 0.08, 0.08, 0, 0.8, 0);
    } else if (kind === 'deer') {
      mbox(g, 0x9a6b3a, 0.5, 0.5, 0.9, 0, 0.7, 0);
      msphere(g, 0x9a6b3a, 0.22, 0, 1.05, 0.45);
      for (const [dx, dz] of [[-0.18, -0.3], [0.18, -0.3], [-0.18, 0.3], [0.18, 0.3]]) mbox(g, 0x6b4a2f, 0.1, 0.7, 0.1, dx, 0.35, dz);
      mcone(g, 0x6b4a2f, 0.04, 0.4, -0.1, 1.32, 0.5, 4); mcone(g, 0x6b4a2f, 0.04, 0.4, 0.1, 1.32, 0.5, 4);
    } else if (kind === 'frog') {
      const b = msphere(g, 0x4a8a43, 0.22, 0, 0.2, 0); b.scale.set(1.2, 0.8, 1);
      msphere(g, 0x2f6b3a, 0.08, -0.12, 0.34, 0.12); msphere(g, 0x2f6b3a, 0.08, 0.12, 0.34, 0.12);
    } else if (kind === 'snake') {
      for (let s = 0; s < 5; s++) msphere(g, 0x2f6b3a, 0.1, -0.3 + s * 0.15, 0.12, Math.sin(s) * 0.12);
    } else if (kind === 'butterfly') {
      mbox(g, 0x0f172a, 0.06, 0.06, 0.14, 0, 0.7, 0);
      const l = mbox(g, 0xf472b6, 0.3, 0.02, 0.24, -0.16, 0.72, 0); l.name = 'wingL';
      const r = mbox(g, 0xf472b6, 0.3, 0.02, 0.24, 0.16, 0.72, 0); r.name = 'wingR';
    } else {
      msphere(g, 0x38bdf8, 0.16, 0, 1.2, 0);
      mbox(g, 0x1e40af, 0.4, 0.06, 0.2, 0, 1.24, 0);
      mcone(g, 0xfbbf24, 0.05, 0.14, 0.16, 1.2, 0, 4);
    }
    scene.add(g);
    wildlife.push({ kind, g, gx, gy, zone, dir: Math.random() < 0.5 ? 1 : -1, speed: 0.3 + Math.random() * 0.6, ph: Math.random() * 10 });
  }
  const WILD_KINDS = ['monkey', 'deer', 'frog', 'snake', 'butterfly', 'bird'];
  for (let i = 0; i < 12; i++) addWild(WILD_KINDS[i % WILD_KINDS.length], -21 + Math.random() * 18, 4 + Math.random() * 88, 'west');
  for (let i = 0; i < 12; i++) addWild(WILD_KINDS[i % WILD_KINDS.length], 102 + Math.random() * 18, 4 + Math.random() * 88, 'east');
  function stepWildlife(t, dt) {
    for (const w of wildlife) {
      w.gx += w.dir * w.speed * dt;
      const lo = w.zone === 'west' ? -22 : 101, hi = w.zone === 'west' ? -2 : 122;
      if (w.gx < lo) w.gx = hi; else if (w.gx > hi) w.gx = lo;
      let y = 1;
      if (w.kind === 'butterfly') y = 1.4 + Math.sin(t * 2 + w.ph) * 0.3;
      else if (w.kind === 'bird') y = 1.9 + Math.sin(t * 1.5 + w.ph) * 0.4;
      else if (w.kind === 'frog') y = 1 + Math.abs(Math.sin(t * 4 + w.ph)) * 0.25;
      w.g.position.set(w.gx * WORLD_SCALE, y, w.gy * WORLD_SCALE);
      w.g.rotation.y = w.dir > 0 ? 0 : Math.PI;
      if (w.kind === 'butterfly') {
        const f = Math.sin(t * 12 + w.ph) * 0.7;
        const l = w.g.getObjectByName('wingL'), r = w.g.getObjectByName('wingR');
        if (l) l.rotation.z = f; if (r) r.rotation.z = -f;
      }
    }
  }

function stepCitizens(t, dt) {
  const clampX = (v) => Math.max(MIN_GX + 0.5, Math.min(MAX_GX - 0.5, v));
  const clampZ = (v) => Math.max(MIN_GY + 0.5, Math.min(MAX_GY - 0.5, v));
  for (const c of citizens.values()) {
    if (!c.wanderer) { c.moving = false; c.groundY = colTop(Math.round(c.x), Math.round(c.z)); continue; }
    if (c.tx === undefined || (Math.hypot(c.tx - c.x, c.tz - c.z) < 0.3)) {
      if (c.idle === undefined || c.idle <= 0) {
        if (Math.hypot(c.tx - c.x, c.tz - c.z) < 0.3 && c.tx !== undefined) { c.tx = undefined; c.idle = 1 + Math.random() * 3; }
        else { c.tx = clampX(c.hx + (Math.random() * 2 - 1) * 1.6); c.tz = clampZ(c.hy + (Math.random() * 2 - 1) * 1.6); }
      } else { c.idle -= dt; }
      c.moving = false;
      c.groundY = colTop(Math.round(c.x), Math.round(c.z));
      continue;
    }
    const dx = c.tx - c.x, dz = c.tz - c.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let dd = want - c.yaw;
    while (dd > Math.PI) dd -= Math.PI * 2;
    while (dd < -Math.PI) dd += Math.PI * 2;
    c.yaw += dd * Math.min(1, dt * 8);
    const step = Math.min(dist, c.speed * dt);
    // Keep citizens inside the world canvas.
    c.x = clampX(c.x + (dx / dist) * step);
    c.z = clampZ(c.z + (dz / dist) * step);
    c.phase += dt * c.speed * 5;
    c.squash = Math.max(0, -Math.cos(c.phase)) * 0.1;
    c.moving = true;
    const gy = colTop(Math.round(c.x), Math.round(c.z));
    c.groundY = (c.groundY === undefined ? gy : c.groundY + (gy - c.groundY) * Math.min(1, dt * 10));
  }
}

// ---------- HUD / loop ----------
let frames = 0;
const elFps = document.getElementById('hud-fps');
const elMs = document.getElementById('hud-ms');
document.getElementById('hud-blocks').textContent = (boxes.length + waterBoxes.length + foamBoxes.length + detailBoxes.length).toLocaleString();
setInterval(() => {
  const fps = frames * 2;
  frames = 0;
  elFps.textContent = String(fps);
  elMs.textContent = fps > 0 ? (1000 / fps).toFixed(1) : '–';
}, 500);

async function refreshSnapshot() {
  try {
    const snap = await fetchWorldSnapshot();
    if (snap && Array.isArray(snap.occupied)) {
      syncCitizens(snap.occupied);
      document.getElementById('hud-bots').textContent = citizens.size + ' live';
      // become your own citizen: paint + teleport to your tile once
      const own = resolveOwnSpot();
      if (own) {
        const me = snap.occupied.find((o) => o.x === own.x && o.y === own.y);
        if (me) {
          ownSpot = { x: own.x, y: own.y };
          paintPlayer(paletteHexes(me.avatarId));
          if (!ownTeleported) {
            ownTeleported = true;
            player.position.set(own.x, colTop(own.x, own.y), own.y);
            pState.groundY = colTop(own.x, own.y);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[voxel] snapshot failed:', err);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let frame = 0;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  frame++;
  stepCitizens(t, dt);
  updateCitizens(t, dt, frame);
  stepPlayer(dt, t);
  stepFps(dt);
  stepAnimals(t, dt);
  stepCars(t, dt);
  stepTrain(t, dt);
  stepBoat(t, dt);
  stepWildlife(t, dt);
  applyDayNight(dt, t);
  stepAmbient(t, dt);
  ambUpdate();
  edgePan(dt);
  if (!walkMode && !fpsMode && !trainRide && !boatRide) controls.update();
  // citizen LOD by camera distance
  const camDist = camera.position.distanceTo(controls.target);
  if (camDist > 95) dotsOn = true;
  else if (camDist < 80) dotsOn = false;
  // Hide monument labels when zoomed far out to avoid clutter.
  labelGroup.visible = labelsOn && camDist < 240;
  dotMesh.visible = dotsOn;
  for (const k of Object.keys(partMeshes)) partMeshes[k].visible = !dotsOn;
  if (dotsOn) updateDots();
  const botsEl = document.getElementById('hud-bots');
  if (botsEl) botsEl.textContent = citizens.size + (dotsOn ? ' dots' : ' live');
  const bldEl = document.getElementById('hud-buildings');
  if (bldEl) bldEl.textContent = String(cityCount);
  const trEl = document.getElementById('hud-traffic');
  if (trEl) trEl.textContent = String(cars.length);
  const biomeEl = document.getElementById('hud-biome');
  if (biomeEl) biomeEl.textContent = amb.biome;
  const timeEl = document.getElementById('hud-time');
  if (timeEl) timeEl.textContent = sun.intensity > 1.0 ? 'day' : (sun.intensity > 0.75 ? 'dusk' : 'night');
  const distEl = document.getElementById('hud-district');
  if (distEl) {
    const fx = (walkMode || fpsMode) ? player.position.x / WORLD_SCALE : controls.target.x / WORLD_SCALE;
    const fz = (walkMode || fpsMode) ? player.position.z / WORLD_SCALE : controls.target.z / WORLD_SCALE;
    try { distEl.textContent = getDistrict(Math.round(fx), Math.round(fz)); } catch { distEl.textContent = '–'; }
  }
  boatPrompt.style.display = (!IS_MOBILE && walkMode && !boatRide && nearBoat()) ? 'block' : 'none';
  drawMinimap(dt);
  // The player avatar is only the controlled body in walk mode; in the orbit
  // view the citizen snapshot already represents every claimed spot.
  player.visible = walkMode;
  renderer.render(scene, camera);
  frames++;
}

      // ---------- walk mode: player roams, camera stays on the default POV ----------
      // WASD/arrows (or click) move the robot camera-relative; orbit/zoom/pan untouched.
      let walkMode = false;
      let walkZoom = 1;
      const WALK_H = 26;
      const WALK_D = 14;
      let pTarget = null;
      const keysDown = new Set();
      // Jump state
      let jumpVel = 0;
      let jumpHeight = 0;
      const JUMP_VEL = 5.0;
      const GRAVITY = 16.0;
      const JUMP_THRESHOLD = 0.35; // blocks up to 0.35 height delta can be stepped over
      window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyV') { setWalk(!walkMode); return; }
        if (e.code === 'KeyF') { setFps(!fpsMode); return; }
        if (e.code === 'KeyN') { dayAuto = !dayAuto; return; }
        if (e.code === 'KeyE') {
          if (trainRide) { endTrainRide(); return; }
          boardTrain(); return;
        }
        if (e.code === 'KeyB') {
          if (boatRide) { endBoatRide(); }
          else if (nearBoat()) { boardBoat(); }
          return;
        }
        if (e.code === 'KeyM') { ambToggle(); return; }
        if (e.code === 'Space' && walkMode && jumpHeight <= 0.001) {
          jumpVel = JUMP_VEL;
          jumpHeight = 0.0001;
        }
        if (e.code === 'Space' && fpsMode && fpsJumpVel === 0 && player.position.y <= pState.groundY + 0.05) {
          fpsJumpVel = FPS_JUMP;
        }
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') e.preventDefault();
        keysDown.add(e.code);
      });
      window.addEventListener('keyup', (e) => { if (e.code === 'Space') keysDown.delete('Space'); else keysDown.delete(e.code); });

      function pbox(parent, w, h, d, x, y, z, color, emissive, ei) {
        const m = new THREE.Mesh(
          unitBox,
          new THREE.MeshStandardMaterial({ color, roughness: 0.85, emissive: emissive || 0x000000, emissiveIntensity: ei || 0 })
        );
        m.scale.set(w, h, d);
        m.position.set(x, y, z);
        m.castShadow = true;
        parent.add(m);
        return m;
      }
      const player = new THREE.Group();
      const PP = { primary: 0xe2e8f0, secondary: 0x0284c7, accent: 0xf59e0b, skin: 0x38bdf8 };
      pbox(player, 0.26, 0.5, 0.3, -0.17, 0.25, 0, PP.secondary);
      pbox(player, 0.26, 0.5, 0.3, 0.17, 0.25, 0, PP.secondary);
      pbox(player, 0.3, 0.14, 0.36, -0.17, 0.07, 0.02, 0x1e293b);
      pbox(player, 0.3, 0.14, 0.36, 0.17, 0.07, 0.02, 0x1e293b);
      pbox(player, 0.8, 0.66, 0.5, 0, 0.83, 0, PP.primary);
      pbox(player, 0.16, 0.16, 0.1, 0, 0.86, 0.26, PP.accent, PP.accent, 1.4);
      pbox(player, 0.82, 0.12, 0.52, 0, 0.56, 0, PP.secondary);
      const pArmL = new THREE.Group();
      pArmL.position.set(-0.52, 1.1, 0);
      player.add(pArmL);
      pbox(pArmL, 0.2, 0.5, 0.24, 0, -0.25, 0, PP.primary);
      pbox(pArmL, 0.22, 0.18, 0.26, 0, -0.55, 0, PP.skin);
      const pArmR = new THREE.Group();
      pArmR.position.set(0.52, 1.1, 0);
      player.add(pArmR);
      pbox(pArmR, 0.2, 0.5, 0.24, 0, -0.25, 0, PP.primary);
      pbox(pArmR, 0.22, 0.18, 0.26, 0, -0.55, 0, PP.skin);
      const pHead = new THREE.Group();
      pHead.position.y = 1.16;
      player.add(pHead);
      pbox(pHead, 0.92, 0.66, 0.8, 0, 0.33, 0, PP.primary);
      pbox(pHead, 0.6, 0.2, 0.08, 0, 0.38, 0.4, PP.secondary);
      pbox(pHead, 0.12, 0.12, 0.06, -0.15, 0.38, 0.43, PP.accent, PP.accent, 1.2);
      pbox(pHead, 0.12, 0.12, 0.06, 0.15, 0.38, 0.43, PP.accent, PP.accent, 1.2);
      pbox(pHead, 0.1, 0.12, 0.22, 0, 0.22, 0.42, PP.skin);
      pbox(pHead, 0.98, 0.3, 0.86, 0, 0.72, 0, PP.secondary);
      pbox(pHead, 1.24, 0.07, 0.95, 0, 0.585, 0.02, PP.secondary);
      pbox(pHead, 0.05, 0.22, 0.05, 0, 1.0, 0, PP.secondary);
      pbox(pHead, 0.12, 0.12, 0.12, 0, 1.14, 0, PP.accent, PP.accent, 1.4);
      player.position.set(50 * WORLD_SCALE, colTop(50, 50), 50 * WORLD_SCALE);
      scene.add(player);
      const pState = { yaw: Math.PI, phase: 0, groundY: colTop(50, 50), moving: false };

      // repaint the walker in any palette by matching current part colors
      let playerPalette = { ...PP };
      const normHex = (v) => new THREE.Color(v).getHex();
      function paintPlayer(pal) {
        const target = {};
        for (const slot of ['primary', 'secondary', 'accent', 'skin']) target[slot] = normHex(pal[slot]);
        player.traverse((o) => {
          if (!o.isMesh) return;
          const hex = o.material.color.getHex();
          for (const slot of ['primary', 'secondary', 'accent', 'skin']) {
            if (normHex(playerPalette[slot]) === hex) {
              o.material.color.set(target[slot]);
              if (o.material.emissiveIntensity > 0) o.material.emissive.set(target[slot]);
              break;
            }
          }
        });
        playerPalette = { ...pal };
      }
      function paletteHexes(avatarId) {
        const def = AVATAR_CATALOG[avatarId] ?? AVATAR_CATALOG.astronaut;
        const c = def.colors || {};
        return {
          primary: c.primary || '#38bdf8',
          secondary: c.secondary || '#0f172a',
          accent: c.accent || '#f59e0b',
          skin: c.skin || '#fde047',
        };
      }
      // your claimed tile (same localStorage the 2D world uses)
      function resolveOwnSpot() {
        try {
          const saved = JSON.parse(localStorage.getItem('spot_my_owned') || 'null');
          if (saved && saved.x !== undefined && saved.y !== undefined) return saved;
        } catch { /* ignore */ }
        return null;
      }
      let ownTeleported = false;

      renderer.domElement.addEventListener('wheel', (e) => {
        if (!walkMode) return;
        walkZoom = Math.max(0.55, Math.min(1.9, walkZoom + (e.deltaY > 0 ? 0.08 : -0.08)));
      }, { passive: true });
      // ---------- 2D-faithful detail modals (real components, same fields) ----------
      // Viewing parity with the 2D world. Mutations that need engine session
      // or payment (profile edit, ad booking) live in the 2D world.
      function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, (ch) => (
          { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
        ));
      }
      const $id = (id) => document.getElementById(id);
      function openBackdrop(id) {
        const b = $id(id);
        if (!b) return;
        b.classList.add('open');
        b.setAttribute('aria-hidden', 'false');
      }
      function closeBackdrop(id) {
        const b = $id(id);
        if (!b) return;
        b.classList.remove('open');
        b.setAttribute('aria-hidden', 'true');
        // If a preview interrupted first-person mode, drop back into it.
        setTimeout(resumeFpsFromModal, 0);
      }
      function wireModal(id, closeId, extraCloseId) {
        const back = $id(id);
        if (back) back.addEventListener('click', (e) => { if (e.target === back) closeBackdrop(id); });
        const c = closeId && $id(closeId);
        if (c) c.addEventListener('click', () => closeBackdrop(id));
        if (extraCloseId) {
          const x2 = $id(extraCloseId);
          if (x2) x2.addEventListener('click', () => closeBackdrop(id));
        }
      }
      wireModal('profile-modal-backdrop', 'profile-modal-close');
      wireModal('banner-modal-backdrop', 'banner-modal-close', 'btn-banner-dismiss');
      wireModal('secret-modal-backdrop', 'secret-modal-close', 'secret-dismiss-btn');
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
          closeBackdrop('profile-modal-backdrop');
          closeBackdrop('banner-modal-backdrop');
          closeBackdrop('secret-modal-backdrop');
        }
      });
      function setLinkEl(el, url, platform) {
        if (!el) return;
        const href = formatSocialUrl(url, platform);
        if (href) { el.href = href; el.style.display = ''; }
        else el.style.display = 'none';
      }
      function citizenModal(c) {
        const spot = { x: c.hx, y: c.hy, citizenId: c.id, spotId: `${c.hx},${c.hy}` };
        const def = AVATAR_CATALOG[c.avatarId] ?? AVATAR_CATALOG.astronaut;
        const avCanvas = $id('profile-avatar-canvas');
        const actx = avCanvas?.getContext('2d');
        if (actx && avCanvas) {
          actx.clearRect(0, 0, 64, 64);
          if (c.customAvatarData) drawCustomAvatarOnCanvas(actx, c.customAvatarData, 0, 0, 64);
          else drawAvatarOnCanvas(actx, def, 0, 0, 64);
        }
        const arch = $id('profile-holo-archetype');
        if (arch) arch.textContent = (def.name || 'CITIZEN').toUpperCase();
        const isGuest = !c.id || String(c.id).startsWith('guest_') || c.displayName === 'Visitor';
        const setT = (id, txt) => { const el = $id(id); if (el && txt !== undefined) el.textContent = txt; };
        if (isGuest) {
          setT('profile-spot-id', 'Temporary Visitor');
          setT('profile-name', c.displayName || 'Visitor');
          setT('profile-tagline', 'A roaming guest exploring the Spot World island ✨');
          setT('profile-presence-text', 'Roaming Explorer');
          const pres = $id('profile-presence');
          if (pres) {
            pres.style.background = 'rgba(56, 189, 248, 0.12)';
            pres.style.borderColor = 'rgba(56, 189, 248, 0.3)';
            pres.style.color = '#38bdf8';
          }
          const vb = $id('profile-verified-badge');
          if (vb) vb.style.display = 'none';
          setLinkEl($id('link-website'), null);
          setLinkEl($id('link-twitter'), null);
          setLinkEl($id('link-facebook'), null);
          setLinkEl($id('link-instagram'), null);
          setLinkEl($id('link-linkedin'), null);
          setLinkEl($id('link-youtube'), null);
          setLinkEl($id('link-github'), null);
          const ws = $id('spot-wall-section');
          if (ws) ws.style.display = 'none';
          const br = $id('profile-badges-row');
          if (br) br.style.display = 'none';
        } else {
          setT('profile-spot-id', `Spot (${spot.x}, ${spot.y})`);
          setT('profile-name', c.displayName);
          setT('profile-tagline', c.tagline || '');
          setT('profile-presence-text', 'Permanent Citizen');
          const pres = $id('profile-presence');
          if (pres) { pres.style.background = ''; pres.style.borderColor = ''; pres.style.color = ''; }
          const vb = $id('profile-verified-badge');
          if (vb) vb.style.display = c.isVerified ? '' : 'none';
          setLinkEl($id('link-website'), c.websiteUrl, 'website');
          const wt = $id('link-website-text');
          if (wt && c.websiteUrl) {
            const href = formatSocialUrl(c.websiteUrl, 'website');
            if (href) {
              try { wt.textContent = new URL(href).hostname; }
              catch { wt.textContent = 'Website'; }
            }
          }
          setLinkEl($id('link-twitter'), c.twitterUrl, 'twitter');
          setLinkEl($id('link-facebook'), c.facebookUrl, 'facebook');
          setLinkEl($id('link-instagram'), c.instagramUrl, 'instagram');
          setLinkEl($id('link-linkedin'), c.linkedinUrl, 'linkedin');
          setLinkEl($id('link-youtube'), c.youtubeUrl, 'youtube');
          setLinkEl($id('link-github'), c.githubUrl, 'github');
          const ws = $id('spot-wall-section');
          if (ws) ws.style.display = '';
          const bb = $id('profile-bio-block');
          const bbt = $id('profile-bio');
          if (c.bio && bb && bbt) { bb.hidden = false; bbt.textContent = c.bio; }
          else if (bb) bb.hidden = true;
          const badgesRow = $id('profile-badges-row');
          const badgesList = $id('profile-badges-list');
          if (badgesRow && badgesList) {
            const badges = [];
            if (spot.x >= 48 && spot.x <= 52 && spot.y >= 48 && spot.y <= 52) {
              badges.push({ icon: '👑', name: 'Genesis Founder', color: '#f59e0b' });
            }
            if (c.isVerified || c.githubUrl) {
              badges.push({ icon: '✦', name: 'GitHub Verified', color: '#38bdf8' });
            }
            if (c.id) {
              badges.push({ icon: '🏛️', name: 'Permanent Citizen', color: '#10b981' });
            }
            if (!badges.length) badgesRow.style.display = 'none';
            else {
              badgesRow.style.display = '';
              badgesList.innerHTML = badges.map((b) =>
                '<span class="profile-badge-chip"><span style="color:' + b.color + ';">' + b.icon + '</span>' + escapeHtml(b.name) + '</span>'
              ).join('');
            }
          }
          // spot wall: read list + guest composer (same guest flow as 2D)
          const wallComments = $id('spot-wall-comments');
          const wallForm = $id('spot-wall-form');
          const wallAuthor = $id('spot-wall-author');
          const wallBody = $id('spot-wall-body');
          const wallSelfNote = $id('spot-wall-self-note');
          const renderWallList = (list) => {
            if (!wallComments) return;
            if (!list.length) {
              wallComments.innerHTML = '<p class="spot-wall-empty">Be the first to leave a note.</p>';
              return;
            }
            wallComments.innerHTML = list.map((m) =>
              '<div class="spot-wall-comment"><div class="spot-wall-comment-meta"><span class="spot-wall-comment-author">@' +
              escapeHtml(m.authorName || 'anon') + '</span><time>• ' +
              escapeHtml(new Date(m.createdAt).toLocaleDateString()) + '</time></div>' +
              '<p class="spot-wall-comment-body">' + escapeHtml(m.body) + '</p></div>'
            ).join('');
          };
          if (wallComments) wallComments.innerHTML = '<p class="spot-wall-empty">Loading wall…</p>';
          fetchSpotComments(spot.spotId).then((wall) => {
            renderWallList(wall.comments || []);
            const canPost = !!wall.canPost;
            if (wallForm) { wallForm.hidden = !canPost; wallForm.style.display = canPost ? 'grid' : 'none'; }
            if (wallAuthor) { wallAuthor.hidden = false; wallAuthor.value = ''; }
            if (wallSelfNote) {
              wallSelfNote.hidden = canPost;
              wallSelfNote.style.display = canPost ? 'none' : 'block';
              wallSelfNote.textContent = 'This wall is read-only until the owner opens it.';
            }
            if (wallForm) {
              wallForm.onsubmit = (ev) => {
                ev.preventDefault();
                const author = (wallAuthor?.value || '').trim() || 'Anonymous';
                const body = (wallBody?.value || '').trim();
                if (!body) return;
                postSpotComment(spot.spotId, body, author).then(() => {
                  if (wallBody) wallBody.value = '';
                  return fetchSpotComments(spot.spotId);
                }).then((w2) => renderWallList(w2.comments || [])).catch(() => {});
              };
            }
          }).catch(() => {
            if (wallComments) wallComments.textContent = 'The wall is unavailable right now.';
          });
        }
        const shareChip = $id('profile-share-chip');
        if (shareChip) {
          shareChip.onclick = () => {
            const url = location.origin + '/?spot=' + spot.x + ',' + spot.y;
            if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
          };
        }
        const ownerActions = $id('profile-owner-actions');
        if (ownerActions) ownerActions.style.display = 'none';
        openBackdrop('profile-modal-backdrop');
      }
      function billboardModal(b) {
        const banner = b && b.data ? b.data : b;
        const setT = (id, txt) => { const el = $id(id); if (el && txt !== undefined) el.textContent = txt; };
        setT('banner-modal-district', banner.district);
        setT('banner-modal-title', banner.name);
        setT('banner-modal-coords', `Grid: (${banner.gx}, ${banner.gy})`);
        const accent = banner.accentColor || '#00f0ff';
        const screen = $id('banner-modal-preview');
        if (screen) screen.style.borderColor = accent;
        const led = $id('banner-preview-led');
        if (led) led.style.background = accent;
        const tag = $id('banner-modal-tag');
        if (tag) { tag.textContent = banner.tag; tag.style.color = accent; }
        const hl = $id('banner-modal-headline');
        if (hl) { hl.textContent = banner.headline; hl.style.textShadow = `0 0 12px ${accent}`; }
        setT('banner-modal-subtext', banner.subtext);
        setT('banner-modal-status', banner.statusText);
        setT('banner-modal-desc', banner.description);
        const wrap = $id('banner-preview-logo-wrap');
        const img = $id('banner-preview-logo-img');
        if (banner.isSponsored && banner.bannerImageUrl && img && wrap) {
          img.src = banner.bannerImageUrl;
          wrap.style.display = 'flex';
        } else if (wrap) wrap.style.display = 'none';
        const expWrap = $id('banner-modal-expiry');
        const expText = $id('banner-modal-expiry-text');
        if (banner.expiresAt && expWrap && expText) {
          const diff = new Date(banner.expiresAt).getTime() - Date.now();
          if (diff > 0) {
            const days = Math.floor(diff / 86400000);
            expText.textContent = days > 0 ? `${days}d left` : 'Ending soon';
            expWrap.style.display = '';
          } else expWrap.style.display = 'none';
        } else if (expWrap) expWrap.style.display = 'none';
        const cc = $id('banner-citizen-card');
        const gc = $id('banner-guest-card');
        if (banner.citizen) {
          if (cc) cc.style.display = 'flex';
          if (gc) gc.style.display = 'none';
          setT('banner-citizen-name', banner.citizen.displayName);
          const cv = $id('banner-citizen-verified');
          if (cv) cv.style.display = banner.citizen.isVerified ? 'inline-flex' : 'none';
          const pc = $id('banner-citizen-plot-coords');
          const pb = $id('banner-citizen-plot-btn');
          if (banner.citizen.spot && pc) {
            pc.textContent = `(${banner.citizen.spot.x}, ${banner.citizen.spot.y})`;
            if (pb) pb.style.display = 'inline-flex';
          } else if (pb) pb.style.display = 'none';
          const cvs = $id('banner-citizen-avatar-canvas');
          const cctx = cvs?.getContext('2d');
          if (cctx && cvs && banner.citizen.avatarId) {
            cctx.clearRect(0, 0, 36, 36);
            drawAvatarOnCanvas(cctx, AVATAR_CATALOG[banner.citizen.avatarId] || AVATAR_CATALOG.astronaut, 0, 0, 36);
          }
        } else {
          if (cc) cc.style.display = 'none';
          if (gc) gc.style.display = 'none';
        }
        const visit = $id('btn-banner-visit');
        if (visit) {
          if (banner.targetUrl) { visit.href = banner.targetUrl; visit.style.display = 'inline-flex'; }
          else visit.style.display = 'none';
        }
        // ad booking lives in the 2D world; voxel shows the live ad
        const cust = $id('banner-customizer-card');
        if (cust) cust.style.display = 'none';
        const notify = $id('btn-banner-notify');
        if (notify) notify.style.display = 'none';
        openBackdrop('banner-modal-backdrop');
      }
      function secretModal(s) {
        const setT = (id, txt) => { const el = $id(id); if (el && txt !== undefined) el.textContent = txt; };
        setT('secret-icon', s.icon);
        setT('secret-district', s.district);
        setT('secret-title', s.title);
        setT('secret-subtitle', s.subtitle);
        setT('secret-desc', s.description);
        const qbox = $id('secret-quote-box'), q = $id('secret-quote');
        if (s.quote && qbox && q) { qbox.style.display = 'block'; q.textContent = s.quote; }
        else if (qbox) qbox.style.display = 'none';
        const rw = $id('secret-reward-badge'), rwt = $id('secret-reward-text');
        if (s.reward && rw && rwt) { rw.style.display = 'inline-flex'; rwt.textContent = s.reward; }
        else if (rw) rw.style.display = 'none';
        const ab = $id('secret-action-btn');
        if (ab) {
          ab.onclick = null;
          if (s.actionUrl && s.actionLabel) {
            ab.style.display = 'inline-flex';
            ab.href = s.actionUrl;
            const sp = ab.firstElementChild;
            if (sp) sp.textContent = s.actionLabel;
          } else if (s.actionLabel) {
            ab.style.display = 'inline-flex';
            ab.href = '#';
            const sp = ab.firstElementChild;
            if (sp) sp.textContent = s.actionLabel;
            ab.onclick = (e) => {
              e.preventDefault();
              let line = null;
              if (s.id === 'wishing_fountain') {
                const wishes = [
                  '“May all our code build without warnings and our servers stay up.” 🪙✨',
                  '“Wishing for quiet evenings, good friends, and creative breakthroughs.” 🪙✨',
                  '“Left a coin in the waters for the next traveler crossing the grid.” 🪙✨',
                  '“May your side project find its first hundred true fans.” 🪙✨',
                ];
                line = wishes[Math.floor(Math.random() * wishes.length)];
              } else if (s.id === 'grand_station') {
                line = '“🚄 Next Cyber Express arriving at track #1 from the Northern Pass.”';
              } else if (s.id === 'city_hall') {
                line = `“Metropolis Census: 10,000 plots surveyed. ${citizens.size} citizens registered. Digital heritage preserved.”`;
              } else {
                const fortunes = [
                  '“Midnight Tonic: The city breathes in rhythm with its wanderers.”',
                  '“Electric Rain: Neon reflections on quiet asphalt at 2 AM.”',
                  '“Starlight Espresso: Calm focus under a canopy of digital stars.”',
                  '“Amber Mist: A moment of pause before the next journey.”',
                ];
                line = fortunes[Math.floor(Math.random() * fortunes.length)];
              }
              if (line && qbox && q) { qbox.style.display = 'block'; q.textContent = line; }
            };
          } else ab.style.display = 'none';
        }
        // shared discovery journal (same localStorage key as the 2D world)
        try {
          const raw = localStorage.getItem('spot_world_secrets');
          const set = new Set(raw ? JSON.parse(raw) : []);
          if (!set.has(s.id)) {
            set.add(s.id);
            localStorage.setItem('spot_world_secrets', JSON.stringify([...set]));
          }
        } catch { /* ignore */ }
        openBackdrop('secret-modal-backdrop');
      }
      // click-to-move: click terrain in walk mode to walk there (WASD cancels)
      const clickRay = new THREE.Raycaster();
      const clickNDC = new THREE.Vector2();
      const _v = new THREE.Vector3();
      const _pickV = new THREE.Vector3();
      let downXY = null;
      // screen-space nearest citizen within radius px (robust in robot + dots LOD)
  function pickCitizen(cx, cy, radius) {
    const rect = renderer.domElement.getBoundingClientRect();
    let best = null, bestD = radius === undefined ? 30 : radius;
    for (const c of citizens.values()) {
      _v.set(c.x * WORLD_SCALE, (c.groundY || 0) + 1.2, c.z * WORLD_SCALE).project(camera);
          if (_v.z > 1) continue;
          const sx = (_v.x * 0.5 + 0.5) * rect.width;
          const sy = (-_v.y * 0.5 + 0.5) * rect.height;
          const d = Math.hypot(sx - (cx - rect.left), sy - (cy - rect.top));
          if (d < bestD) { bestD = d; best = c; }
        }
        return best;
      }
      renderer.domElement.addEventListener('pointerdown', (e) => {
        downXY = { x: e.clientX, y: e.clientY, b: e.button };
      });
      renderer.domElement.addEventListener('pointerup', (e) => {
        if (!downXY) return;
        const moved = Math.hypot(e.clientX - downXY.x, e.clientY - downXY.y);
        const btn = downXY.b;
        downXY = null;
        if (moved > 6 || btn !== 0) return;
        routeClick(e.clientX, e.clientY);
      });
      // shared click router (citizen → billboard → monument → secret → walk).
      // exposed for automated testing; the pointer handler above delegates to it.
      function routeClick(cx, cy) {
        const rect = renderer.domElement.getBoundingClientRect();
        clickNDC.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
        clickRay.setFromCamera(clickNDC, camera);
        // 1. billboard panel mesh — direct raycast hits get high priority
        let panelHit = false;
        let billboardClose = false;
        if (billboardPanels.length > 0) {
          const bh = clickRay.intersectObjects(billboardPanels, false);
          panelHit = bh.length > 0 && !!bh[0].object.userData.billboard;
          if (panelHit) {
            // Check if billboard is very close to cursor (within 5px) — prioritize over citizens
            const bv = bh[0].object.position.clone().project(camera);
            if (bv.z <= 1) {
              const bsx = (bv.x * 0.5 + 0.5) * rect.width;
              const bsy = (-bv.y * 0.5 + 0.5) * rect.height;
              const distToCursor = Math.hypot(bsx - cx, bsy - cy);
              if (distToCursor < 5) billboardClose = true;
            }
          }
        }
        // 2. geometry actually under the cursor (buildings, terrain, props)
        const hits = clickRay.intersectObjects([solidMesh, cityGroup], true);
        const hitDist = hits.length ? hits[0].distance : Infinity;
        // Landmark modals (Grand Codex library / arcade / museum) take priority
        // over a citizen standing in front of them.
        if (hits.length) {
          const lp = hits[0].point;
          const lx = lp.x / WORLD_SCALE, lz = lp.z / WORLD_SCALE;
          const near = (tx, tz, r) => Math.hypot(lx - tx, lz - tz) < r;
          if (near(44, 52, 1.8) && window.openLibraryModal) { window.openLibraryModal(); return 'library'; }
          if (near(86, 22, 1.8) && window.openArcadeModal) { window.openArcadeModal(); return 'arcade'; }
          if (near(60, 38, 1.8) && window.openMuseumModal) { window.openMuseumModal(); return 'museum'; }
        }
        // 3. citizen — only when the cursor is really on them AND they sit in
        //    front of the structure behind the cursor (fixes misclicks on
        //    monuments/buildings selecting a citizen standing nearby/behind).
        const c = pickCitizen(cx, cy, billboardClose ? 6 : 16);
        if (c) {
          _pickV.set(c.x * WORLD_SCALE, (c.groundY || 0) + 1.2, c.z * WORLD_SCALE);
          const camDist = camera.position.distanceTo(_pickV);
          if (camDist < hitDist + 1.5) { citizenModal(c); return 'citizen'; }
        }
        if (panelHit) {
          const bh = clickRay.intersectObjects(billboardPanels, false);
          billboardModal({ data: bh[0].object.userData.billboard });
          return 'billboard';
        }
        if (!hits.length) return 'none';
        const p = hits[0].point;
        // 3. billboard jumbotron (ground-proximity fallback)
        let bestB = null, bestBD = 3.6;
        for (const b of billboardSpots) {
          const d = Math.hypot(p.x - b.gx * WORLD_SCALE, p.z - b.gy * WORLD_SCALE);
          if (d < bestBD && p.y > b.top - 4 && p.y < b.top + 1.5) { bestBD = d; bestB = b; }
        }
        if (bestB) { billboardModal(bestB); return 'billboard-near'; }
        const cgx = Math.round(p.x / WORLD_SCALE), cgy = Math.round(p.z / WORLD_SCALE);
        // 4. hidden world secret
        let secret = null;
        try { secret = getSecretAt(cgx, cgy); } catch { /* ignore */ }
        if (secret) { secretModal(secret); return 'secret'; }
        // 5. walk here (walk mode only; plain props aren't clickable in 2D either)
        if (!walkMode) return 'none';
        pTarget = {
          x: Math.max((MIN_GX + 0.6) * WORLD_SCALE, Math.min((MAX_GX - 0.4) * WORLD_SCALE, p.x)),
          z: Math.max((MIN_GY + 0.6) * WORLD_SCALE, Math.min((MAX_GY - 0.4) * WORLD_SCALE, p.z)),
        };
        return 'walk';
      }

      function setWalk(on) {
        walkMode = on;
        if (!on) pTarget = null;
        controls.enabled = !on;
        controls.autoRotate = false;
        walkBtn.textContent = on ? '🚶 Walking (V)' : '🚶 Walk (V)';
        walkBtn.classList.toggle('sel', on);
        const hint = document.querySelector('.hint');
        if (hint) hint.textContent = on
          ? 'WASD / arrows to walk · SPACEBAR to jump · wheel to zoom · V to exit'
          : 'edge / right-drag to pan · scroll to zoom · fixed isometric view';
        if (on) keysDown.clear();
        repartition();
      }
      const voxelToolbar = document.getElementById('voxel-toolbar');
      const walkBtn = document.createElement('button');
      walkBtn.textContent = '🚶 Walk (V)';
      walkBtn.addEventListener('click', () => setWalk(!walkMode));
      if (!IS_MOBILE) (voxelToolbar || document.body).appendChild(walkBtn);

      function stepPlayer(dt, t) {
        if (!walkMode) return;
        // screen-aligned movement (fixed camera yaw): up-screen = north (-z)
        let mx = 0, mz = 0;
        if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) mz -= 1;
        if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) mz += 1;
        if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) mx -= 1;
        if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) mx += 1;
        const ml = Math.hypot(mx, mz);
        if (ml > 0) {
          pTarget = null;
          mx /= ml; mz /= ml;
        } else if (pTarget) {
          const dx = pTarget.x - player.position.x;
          const dz = pTarget.z - player.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.35) {
            pTarget = null;
          } else {
            mx = dx / d; mz = dz / d;
          }
        }
        pState.moving = ml > 0 || !!pTarget;
        if (pState.moving) {
          const SPD = (keysDown.has('ShiftLeft') || keysDown.has('ShiftRight')) ? 10 : 6;
          const nx = Math.max((MIN_GX + 0.6) * WORLD_SCALE, Math.min((MAX_GX - 0.4) * WORLD_SCALE, player.position.x + mx * SPD * dt));
          const nz = Math.max((MIN_GY + 0.6) * WORLD_SCALE, Math.min((MAX_GY - 0.4) * WORLD_SCALE, player.position.z + mz * SPD * dt));
          // wall check: allow x-only / z-only slide.
          // During jump, allow climbing over obstacles up to JUMP_THRESHOLD height.
          const feet = pState.groundY;
          const jumpFactor = jumpVel > 0 ? 1.0 : JUMP_THRESHOLD;
          const gxN = Math.round(nx / WORLD_SCALE), gz0 = Math.round(player.position.z / WORLD_SCALE);
          const gx0 = Math.round(player.position.x / WORLD_SCALE), gzN = Math.round(nz / WORLD_SCALE);
          const tryX = colTop(gxN, gz0);
          const tryZ = colTop(gx0, gzN);
          const climbX = Math.max(1.6, jumpFactor);
          const climbZ = Math.max(1.6, jumpFactor);
          if (tryX - feet <= climbX && !isBlocked(gxN, gz0)) player.position.x = nx;
          if (tryZ - feet <= climbZ && !isBlocked(gx0, gzN)) player.position.z = nz;
          const want = Math.atan2(mx, mz);
          let dd = want - pState.yaw;
          while (dd > Math.PI) dd -= Math.PI * 2;
          while (dd < -Math.PI) dd += Math.PI * 2;
          pState.yaw += dd * Math.min(1, dt * 10);
          pState.phase += dt * SPD * 1.6;
        }
        const gy = colTop(Math.round(player.position.x / WORLD_SCALE), Math.round(player.position.z / WORLD_SCALE));
        pState.groundY += (gy - pState.groundY) * Math.min(1, dt * 10);
        // Jump physics: gravity + landing
        if (jumpHeight > 0 || jumpVel !== 0) {
          jumpHeight += jumpVel * dt;
          jumpVel -= GRAVITY * dt;
          if (jumpHeight <= 0) { jumpHeight = 0; jumpVel = 0; }
        }
        const sw = pState.moving ? Math.sin(pState.phase) : 0;
        player.position.y = pState.groundY + jumpHeight + (pState.moving ? Math.abs(Math.cos(pState.phase)) * 0.07 : 0);
        player.rotation.y = pState.yaw;
        pArmL.rotation.x = sw * 0.6;
        pArmR.rotation.x = -sw * 0.6;
        pHead.position.y = 1.16 + (pState.moving ? Math.abs(Math.cos(pState.phase)) * 0.03 : Math.sin(t * 2) * 0.02) + jumpHeight;
        const sq = pState.moving ? 1 + Math.max(0, -Math.cos(pState.phase)) * 0.04 : 1;
        player.scale.set(1, sq, 1);
        // fixed isometric-style follow view, like the 2D world (south of player, looking north)
        camera.position.set(
          player.position.x,
          player.position.y + WALK_H * walkZoom,
          player.position.z + WALK_D * walkZoom
        );
        camera.lookAt(player.position.x, player.position.y + 1.5, player.position.z - 2 * walkZoom);
      }

      // ---------- FPS MODE: first-person roaming with running/jumping/crouching ----------
      let fpsMode = false;
      let fpsYaw = 0;      // horizontal rotation (radians)
      let fpsPitch = 0;    // vertical rotation (radians, clamped to ±π/3)
      let fpsVel = new THREE.Vector3();  // current movement velocity
      let fpsJumpVel = 0;
      let fpsCrouch = false;
      const FPS_SPEED = 14;
      const FPS_SPRINT = 26;
      const FPS_JUMP = 5.6;
      const FPS_GRAVITY = 17.0;
      const FPS_HEIGHT_STAND = 2.0;
      const FPS_HEIGHT_CROUCH = 1.25;
      const mouseLook = { enabled: false, startX: 0, startY: 0 };
      function setFps(on) {
        fpsMode = on;
        crosshair.style.display = on ? 'block' : 'none';
        fpsTarget.style.display = on ? 'block' : 'none';
        // First-person wants a wider FOV + closer near plane than the diorama.
        camera.fov = on ? 72 : 45;
        camera.near = on ? 0.1 : 0.5;
        camera.updateProjectionMatrix();
        if (on) {
          if (walkMode) setWalk(false);
          controls.enabled = false;
          renderer.domElement.style.cursor = 'crosshair';
          document.body.classList.add('fps-active');
          // Lock pointer for mouselook
          if (document.pointerLockElement !== renderer.domElement) {
            try { const r = renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* ignore */ }
          }
        } else {
          player.visible = true;
          fpsHadLock = false;
          fpsSuspended = false;
          document.body.style.cursor = '';
          renderer.domElement.style.cursor = '';
          document.body.classList.remove('fps-active');
          controls.enabled = !walkMode;
          if (document.pointerLockElement === renderer.domElement) {
            try { const r = document.exitPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* ignore */ }
          }
        }
        fpsBtn.textContent = on ? '🎮 FPS (F)' : '🎮 FPS (F)';
        fpsBtn.classList.toggle('sel', on);
        const hint = document.querySelector('.hint');
        if (hint) hint.textContent = on
          ? 'WASD to move · SHIFT to sprint · SPACE to jump · CTRL to crouch · MOUSE to look · CLICK to inspect · F to exit'
          : (walkMode
            ? 'WASD / arrows to walk · SPACEBAR to jump · wheel to zoom · V to exit'
            : 'edge / right-drag to pan · scroll to zoom · fixed isometric view');
        if (on) keysDown.clear();
        repartition();
      }
      const fpsBtn = document.createElement('button');
      fpsBtn.textContent = '🎮 FPS (F)';
      fpsBtn.addEventListener('click', () => setFps(!fpsMode));
      if (!IS_MOBILE) (voxelToolbar || document.body).appendChild(fpsBtn);

      // FPS crosshair + inspect prompt (click the centre to open details)
      const crosshair = document.createElement('div');
      crosshair.style.cssText = 'position:fixed;left:50%;top:50%;width:24px;height:24px;margin:-12px 0 0 -12px;z-index:120;pointer-events:none;display:none;';
      crosshair.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="none" stroke="#f8fafc" stroke-width="1.6" opacity="0.9"/><line x1="12" y1="1" x2="12" y2="6" stroke="#f8fafc" stroke-width="1.6"/><line x1="12" y1="18" x2="12" y2="23" stroke="#f8fafc" stroke-width="1.6"/><line x1="1" y1="12" x2="6" y2="12" stroke="#f8fafc" stroke-width="1.6"/><line x1="18" y1="12" x2="23" y2="12" stroke="#f8fafc" stroke-width="1.6"/><circle cx="12" cy="12" r="1.8" fill="#fbbf24"/></svg>';
      document.body.appendChild(crosshair);
      const fpsTarget = document.createElement('div');
      fpsTarget.style.cssText = 'position:fixed;left:50%;top:calc(50% + 22px);transform:translateX(-50%);z-index:120;pointer-events:none;display:none;font:11px ui-monospace,Menlo,monospace;color:#e2e8f0;background:rgba(9,13,24,.75);border:1px solid #263247;border-radius:8px;padding:3px 9px;white-space:nowrap;';
      fpsTarget.textContent = 'Click to inspect';
      document.body.appendChild(fpsTarget);

      const soundBtn = document.createElement('button');
      soundBtn.textContent = '🔇 Sound (M)';
      soundBtn.addEventListener('click', () => ambToggle());
      (voxelToolbar || document.body).appendChild(soundBtn);
      const trainBtn = document.createElement('button');
      trainBtn.textContent = '🚆 Ride Train (E)';
      trainBtn.addEventListener('click', () => { if (trainRide) endTrainRide(); else boardTrain(); });
      if (!IS_MOBILE) (voxelToolbar || document.body).appendChild(trainBtn);
      const boatBtn = document.createElement('button');
      boatBtn.textContent = '🚤 Boat (B)';
      boatBtn.addEventListener('click', () => {
        if (boatRide) { endBoatRide(); }
        else if (nearBoat()) { boardBoat(); }
        else { const h = document.querySelector('.hint'); if (h) h.textContent = 'Walk to the beach boat on the south shore, then press B to ride'; }
      });
      if (!IS_MOBILE) (voxelToolbar || document.body).appendChild(boatBtn);
      function zoomBy(f) {
        const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
        dir.multiplyScalar(f);
        camera.position.copy(controls.target).add(dir);
        controls.update();
      }
      const timeBtn = document.createElement('button');
      timeBtn.textContent = '☀️ Time (N)';
      timeBtn.addEventListener('click', () => { dayAuto = !dayAuto; if (!dayAuto) dayT = (dayT + 0.33) % 1; });
      (voxelToolbar || document.body).appendChild(timeBtn);
      const zoomInBtn = document.createElement('button');
      zoomInBtn.textContent = '＋';
      zoomInBtn.addEventListener('click', () => zoomBy(0.8));
      (voxelToolbar || document.body).appendChild(zoomInBtn);
      const zoomOutBtn = document.createElement('button');
      zoomOutBtn.textContent = '－';
      zoomOutBtn.addEventListener('click', () => zoomBy(1.25));
      (voxelToolbar || document.body).appendChild(zoomOutBtn);
      const resetBtn = document.createElement('button');
      resetBtn.textContent = '⟲ Reset';
      resetBtn.addEventListener('click', () => window.__voxel.view(50, 50, 130));
      (voxelToolbar || document.body).appendChild(resetBtn);
      const labelsBtn = document.createElement('button');
      labelsBtn.textContent = '🏷 Labels';
      labelsBtn.classList.add('sel');
      labelsBtn.addEventListener('click', () => { setLabels(!labelsOn); labelsBtn.classList.toggle('sel', labelsOn); });
      (voxelToolbar || document.body).appendChild(labelsBtn);

      // In FPS the mouse drives the view; clicking inspects what the crosshair aims at.
      renderer.domElement.addEventListener('mousedown', () => {
        if (!fpsMode || fpsSuspended) return;
        const rect = renderer.domElement.getBoundingClientRect();
        const what = routeClick(rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (what && what !== 'none' && what !== 'walk') {
          // A modal opened: release the pointer so it's clickable, but keep FPS
          // active. It resumes automatically once the modal is closed.
          fpsSuspended = true;
          try { const r = document.exitPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* ignore */ }
          document.body.style.cursor = 'default';
          renderer.domElement.style.cursor = 'default';
          crosshair.style.display = 'none';
          fpsTarget.style.display = 'none';
          const hint = document.querySelector('.hint');
          if (hint) hint.textContent = 'Preview open · click ✕ or press Esc to close · returns to FPS automatically';
        }
      });
      // Called by closeBackdrop(): if we suspended FPS for a modal, resume it.
      function resumeFpsFromModal() {
        if (!fpsMode || !fpsSuspended) return;
        // The modal components use `.modal-backdrop`; wait until every one is closed.
        if (document.querySelector('.modal-backdrop.open, .modal.open')) return;
        fpsSuspended = false;
        document.body.style.cursor = '';
        renderer.domElement.style.cursor = 'crosshair';
        crosshair.style.display = 'block';
        fpsTarget.style.display = 'block';
        const hint = document.querySelector('.hint');
        if (hint) hint.textContent = 'WASD to move · SHIFT to sprint · SPACE to jump · CTRL to crouch · MOUSE to look · CLICK to inspect · F to exit';
        try { const r = renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* ignore */ }
      }

      // Mouse movement for FPS look
      let fpsHadLock = false;
      let fpsSuspended = false;
      document.addEventListener('pointerlockchange', () => {
        if (!fpsMode) return;
        if (document.pointerLockElement === renderer.domElement) { fpsHadLock = true; return; }
        // Released on purpose so a modal could open — stay in FPS.
        if (fpsSuspended) return;
        // Only leave FPS if we actually had the lock and it was released (Esc).
        if (fpsHadLock) setFps(false);
      });
      renderer.domElement.addEventListener('mousemove', (e) => {
        if (!fpsMode) return;
        if (document.pointerLockElement !== renderer.domElement) return;
        const movementX = e.movementX || 0;
        const movementY = e.movementY || 0;
        fpsYaw -= movementX * 0.002;
        fpsPitch -= movementY * 0.002;
        fpsPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, fpsPitch));
      });
      // ESC exits FPS mode (and pointer lock) or the train ride
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
          if (fpsMode) setFps(false);
          if (trainRide) endTrainRide();
        }
      });
      // FPS movement step
      function stepFps(dt) {
        if (!fpsMode) return;
        // Build camera-relative movement vector
        const forward = new THREE.Vector3(Math.sin(fpsYaw), 0, Math.cos(fpsYaw));
        const right = new THREE.Vector3(Math.sin(fpsYaw + Math.PI / 2), 0, Math.cos(fpsYaw + Math.PI / 2));
        let mx = 0, mz = 0;
        if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) mz -= 1;
        if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) mz += 1;
        if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) mx -= 1;
        if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) mx += 1;
        const ml = Math.hypot(mx, mz);
        if (ml > 0) { mx /= ml; mz /= ml; }
        const dir = new THREE.Vector3();
        dir.addScaledVector(forward, -mz);
        dir.addScaledVector(right, -mx);
        dir.y = 0;
        dir.normalize();
        const isSprint = (keysDown.has('ShiftLeft') || keysDown.has('ShiftRight')) && mz < 0;
        const speed = isSprint ? FPS_SPRINT : FPS_SPEED;
        const targetVel = dir.multiplyScalar(speed);
        // Smooth acceleration/deceleration
        fpsVel.lerp(targetVel, 0.15);
        // Apply gravity
        fpsJumpVel -= FPS_GRAVITY * dt;
        // Move player
        const nx = player.position.x + fpsVel.x * dt;
        const nz = player.position.z + fpsVel.z * dt;
        const feet = pState.groundY;
        const gxN = Math.round(nx / WORLD_SCALE), gz0 = Math.round(player.position.z / WORLD_SCALE);
        const gx0 = Math.round(player.position.x / WORLD_SCALE), gzN = Math.round(nz / WORLD_SCALE);
        const tryX = colTop(gxN, gz0);
        const tryZ = colTop(gx0, gzN);
        const climbThreshold = 0.9; // can step up small obstacles
        if (tryX - feet <= climbThreshold && !isBlocked(gxN, gz0)) player.position.x = nx;
        if (tryZ - feet <= climbThreshold && !isBlocked(gx0, gzN)) player.position.z = nz;
        // Update camera to first-person (head height)
        const headH = fpsCrouch ? FPS_HEIGHT_CROUCH : FPS_HEIGHT_STAND;
        // Raycast up to check ceiling when standing
        if (!fpsCrouch) {
          const headTop = colTop(Math.round(player.position.x / WORLD_SCALE), Math.round(player.position.z / WORLD_SCALE));
          // Check if we can stand up
          const eyeY = player.position.y;
          const ceilDiff = headTop + 1.7 - eyeY; // ceiling at player head level
          // Simple check: if there's a ceiling block within 0.3 units above, stay crouched
        }
        player.position.y += fpsJumpVel * dt;
        // Ground collision
        const gy = colTop(Math.round(player.position.x / WORLD_SCALE), Math.round(player.position.z / WORLD_SCALE));
        if (player.position.y < gy) {
          player.position.y = gy;
          fpsJumpVel = 0;
        }
        pState.groundY = player.position.y;
        // Update camera position to player's eye level
        const eyeY = player.position.y + (fpsCrouch ? FPS_HEIGHT_CROUCH : FPS_HEIGHT_STAND);
        camera.position.set(player.position.x, eyeY, player.position.z);
        // Camera direction from yaw/pitch
        const cosPitch = Math.cos(fpsPitch);
        const lookDir = new THREE.Vector3(
          Math.sin(fpsYaw) * cosPitch,
          Math.sin(fpsPitch),
          Math.cos(fpsYaw) * cosPitch
        );
        camera.lookAt(camera.position.clone().add(lookDir));
        // Hide player model in FPS view
        player.visible = false;
      }

      // Handle Space for both walk mode jump and FPS jump
      window.removeEventListener('keydown', null); // cleanup not needed, re-add handlers

      // ---------- minimap / radar ----------
      const MINI_COLORS = {
        road_asphalt: '#2b3444', road_h_stripe: '#2b3444', road_v_stripe: '#2b3444', crosswalk: '#5a6473',
        sidewalk: '#7e8796', plaza_grand: '#a8aeba', plaza_terracotta: '#b8603e', plaza_zen: '#8f98a6',
        park_grass: '#4a8a43', jungle_grass: '#2c6f37', jungle_dense: '#205a29',
        forest_grass: '#377f45', forest_dense: '#276235',
        water_pond: '#2f8fc4', ocean_deep: '#0e3a5c', ocean_surf: '#2f9fd0',
        jungle_creek: '#1c6f58', forest_creek: '#3778a8',
        beach_sand: '#dcc795', boardwalk: '#7a4f2c',
        railway_ballast: '#3f3f46', mountain_rock: '#4b5563', mountain_snow: '#e8eef6',
      };
      const MINI_GX0 = -26, MINI_GY0 = -18, MINI_GW = 152, MINI_GH = 150;
      const miniBase = document.createElement('canvas');
      miniBase.width = MINI_GW; miniBase.height = MINI_GH;
      {
        const c = miniBase.getContext('2d');
        for (let gx = 0; gx < MINI_GW; gx++) {
          for (let gy = 0; gy < MINI_GH; gy++) {
            let tt; try { tt = getCityTileType(gx + MINI_GX0, gy + MINI_GY0); } catch { tt = 'void'; }
            const wy = gy + MINI_GY0;
            if (wy === 108 || wy === 109) tt = 'beach_sand';
            else if (wy === 110 || wy === 111) tt = 'ocean_surf';
            const col = MINI_COLORS[tt];
            if (!col) continue;
            c.fillStyle = col; c.fillRect(gx, gy, 1, 1);
          }
        }
      }
      const miniCanvas = document.getElementById('voxel-minimap');
      const miniCtx = miniCanvas ? miniCanvas.getContext('2d') : null;
      const MINI_W = miniCanvas ? miniCanvas.width : 0;
      const MINI_H = miniCanvas ? miniCanvas.height : 0;
      const miniSX = MINI_W / MINI_GW, miniSY = MINI_H / MINI_GH;
      const toMini = (gx, gy) => [(gx - MINI_GX0) * miniSX, (gy - MINI_GY0) * miniSY];
      let miniAccum = 0;
      function drawMinimap(dt) {
        if (!miniCtx) return;
        miniAccum += dt;
        if (miniAccum < 0.12) return;
        miniAccum = 0;
        miniCtx.clearRect(0, 0, MINI_W, MINI_H);
        miniCtx.drawImage(miniBase, 0, 0, MINI_W, MINI_H);
        for (const [gx, gy, , , color] of MONUMENT_LABELS) {
          const [x, y] = toMini(gx, gy);
          miniCtx.fillStyle = color; miniCtx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
        { const [x, y] = toMini(boat.x, boat.z); miniCtx.fillStyle = '#f8fafc'; miniCtx.fillRect(x - 2, y - 2, 4, 4); }
        if (train.active) { const [x, y] = toMini(train.x, TRAIN_TRACK_Z); miniCtx.fillStyle = '#38bdf8'; miniCtx.fillRect(x - 3, y - 1.5, 6, 3); }
        const fx = (walkMode || fpsMode) ? player.position.x / WORLD_SCALE : (boatRide ? boat.x : controls.target.x / WORLD_SCALE);
        const fz = (walkMode || fpsMode) ? player.position.z / WORLD_SCALE : (boatRide ? boat.z : controls.target.z / WORLD_SCALE);
        const [px, py] = toMini(fx, fz);
        if (!walkMode && !fpsMode && !boatRide) {
          const dist = camera.position.distanceTo(controls.target);
          const half = Math.max(6, dist * 0.32);
          const [vx, vy] = toMini(fx - half, fz - half);
          miniCtx.strokeStyle = 'rgba(251,191,36,0.5)'; miniCtx.lineWidth = 1;
          miniCtx.strokeRect(vx, vy, half * 2 * miniSX, half * 2 * miniSY);
        }
        miniCtx.fillStyle = '#fbbf24';
        miniCtx.beginPath(); miniCtx.arc(px, py, 3.2, 0, Math.PI * 2); miniCtx.fill();
        miniCtx.strokeStyle = '#0a0f1e'; miniCtx.lineWidth = 1; miniCtx.stroke();
      }
      if (miniCanvas) {
        miniCanvas.addEventListener('click', (e) => {
          const r = miniCanvas.getBoundingClientRect();
          const gx = ((e.clientX - r.left) / r.width) * MINI_GW + MINI_GX0;
          const gy = ((e.clientY - r.top) / r.height) * MINI_GH + MINI_GY0;
          const dist = camera.position.distanceTo(controls.target);
          window.__voxel.view(Math.round(gx), Math.round(gy), dist);
        });
      }
      const miniToggle = document.getElementById('voxel-minimap-toggle');
      if (miniToggle) miniToggle.addEventListener('click', () => {
        const panel = document.getElementById('voxel-minimap-panel');
        if (panel) panel.classList.toggle('collapsed');
        miniToggle.textContent = panel && panel.classList.contains('collapsed') ? '+' : '–';
      });

      // ---------- ambient environmental audio (procedural, no assets) ----------
      const amb = { ctx: null, master: null, wind: null, wave: null, jungle: null, city: null, buf: null, muted: true, biome: 'city' };
      function ambInit() {
        if (amb.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        amb.ctx = ctx;
        const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination); amb.master = master;
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 3), ctx.sampleRate);
        const d = buf.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < d.length; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          d[i] = (b0 + b1 + b2) * 0.7;
        }
        amb.buf = buf;
        const mk = (type, freq, q) => {
          const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
          const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
          const g = ctx.createGain(); g.gain.value = 0;
          s.connect(f); f.connect(g); g.connect(master); s.start();
          return g;
        };
        amb.wind = mk('lowpass', 420);
        amb.wave = mk('bandpass', 620, 1.1);
        amb.jungle = mk('highpass', 2400);
        amb.city = mk('lowpass', 190);
        amb.boat = mk('lowpass', 240);
        amb.splash = mk('bandpass', 1200, 0.7);
        // Schedule discrete biome events (chirps, gulls, drips, buzz, wind swells).
        amb.chirpTimer = window.setInterval(() => { if (amb.ctx && !amb.muted) ambChirp(); }, 2200);
      }
      // ---- one-shot synthesized ambience events (no audio assets) ----
      function ambTone(t, freq, dur, type, gain, sweepTo) {
        const ctx = amb.ctx;
        const o = ctx.createOscillator(); o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, t);
        if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(amb.master);
        o.start(t); o.stop(t + dur + 0.03);
      }
      function birdChirp(t) {
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const f = 1900 + Math.random() * 1500;
          ambTone(t + i * 0.11, f, 0.09, 'sine', 0.12, f * 1.45);
        }
      }
      function insectBuzz(t) {
        const ctx = amb.ctx;
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 4200 + Math.random() * 900;
        const g = ctx.createGain(); g.gain.value = 0;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 32 + Math.random() * 22;
        const lg = ctx.createGain(); lg.gain.value = 0.045;
        lfo.connect(lg); lg.connect(g.gain);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(0.05, t + 0.06);
        env.gain.linearRampToValueAtTime(0.0001, t + 0.6);
        o.connect(env); env.connect(amb.master);
        o.start(t); o.stop(t + 0.65); lfo.start(t); lfo.stop(t + 0.65);
      }
      function waterDrip(t) { ambTone(t, 900 + Math.random() * 400, 0.12, 'sine', 0.08, 320); }
      function gullCry(t) {
        for (let i = 0; i < 2; i++) ambTone(t + i * 0.18, 1200 - i * 200, 0.16, 'sawtooth', 0.06, 680 - i * 140);
      }
      function neonBuzz(t) { ambTone(t, 120 + Math.random() * 60, 0.15, 'square', 0.03); }
      function windSwell(t) {
        if (!amb.buf) return;
        const ctx = amb.ctx;
        const s = ctx.createBufferSource(); s.buffer = amb.buf; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300 + Math.random() * 320; f.Q.value = 0.8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.13, t + 0.9);
        g.gain.linearRampToValueAtTime(0.0001, t + 2.3);
        s.connect(f); f.connect(g); g.connect(amb.master);
        s.start(t); s.stop(t + 2.4);
      }
      function ambChirp() {
        const ctx = amb.ctx, t = ctx.currentTime, b = amb.biome, r = Math.random();
        if (b === 'jungle') {
          if (r < 0.6) birdChirp(t);
          else if (r < 0.85) insectBuzz(t);
          else waterDrip(t);
        } else if (b === 'ocean') {
          if (r < 0.6) gullCry(t);
        } else if (b === 'mountains') {
          if (r < 0.5) birdChirp(t); else windSwell(t);
        } else {
          if (r < 0.4) neonBuzz(t);
          else if (r < 0.62) birdChirp(t);
        }
      }
      function ambUpdate() {
        if (!amb.ctx) return;
        // Pick the ambience from where the view/player is.
        const px = trainRide ? train.x : ((walkMode || fpsMode) ? player.position.x / WORLD_SCALE : controls.target.x / WORLD_SCALE);
        const pz = trainRide ? TRAIN_TRACK_Z : ((walkMode || fpsMode) ? player.position.z / WORLD_SCALE : controls.target.z / WORLD_SCALE);
        if (px < 0 || px >= 100) amb.biome = 'jungle';
        else if (pz >= 100) amb.biome = 'ocean';
        else if (pz <= -4) amb.biome = 'mountains';
        else amb.biome = 'city';
        const biome = amb.biome;
        // Mute is instant; unmute fades in.
        if (amb.muted) { amb.master.gain.value = 0; return; }
        amb.master.gain.value += (0.9 - amb.master.gain.value) * 0.06;
        // Slow breathing variation so the beds never sound static.
        const now = performance.now();
        const swell = 0.72 + 0.28 * Math.sin(now * 0.00035);
        const gust = 0.7 + 0.3 * Math.sin(now * 0.00021 + 1.7);
        const tw = { wind: 0.06, wave: 0, jungle: 0, city: 0 };
        if (biome === 'jungle') { tw.jungle = 0.16; tw.wind = 0.05; }
        else if (biome === 'ocean') { tw.wave = 0.26; tw.wind = 0.08; }
        else if (biome === 'mountains') { tw.wind = 0.2; }
        else { tw.city = 0.12; tw.wind = 0.06; }
        const ramp = (g, v) => { if (g) g.gain.value += (v - g.gain.value) * 0.05; };
        ramp(amb.wind, tw.wind * gust);
        ramp(amb.wave, tw.wave * swell);
        ramp(amb.jungle, tw.jungle * (0.8 + 0.2 * Math.sin(now * 0.0005)));
        ramp(amb.city, tw.city);
        // Boat: engine rumble + water splash, scaled by speed; louder waves.
        if (boatRide) {
          const sp = Math.min(1, Math.abs(boat.speed) / 9);
          ramp(amb.wave, 0.34);
          ramp(amb.boat, 0.12 + sp * 0.18);
          ramp(amb.splash, 0.08 + sp * 0.14);
        } else {
          ramp(amb.boat, 0);
          ramp(amb.splash, 0);
        }
      }
      function ambToggle() {
        if (!amb.ctx) ambInit();
        if (amb.ctx && amb.ctx.state === 'suspended') amb.ctx.resume().catch(() => {});
        amb.muted = !amb.muted;
        if (soundBtn) soundBtn.textContent = amb.muted ? '🔇 Sound (M)' : '🔊 Sound (M)';
        if (soundBtn) soundBtn.classList.toggle('sel', !amb.muted);
        return !amb.muted;
      }
      // Resume audio on the first user gesture (browser autoplay policy).
      const _audioGesture = () => { if (!amb.ctx) ambInit(); if (amb.ctx && amb.ctx.state === 'suspended') amb.ctx.resume().catch(() => {}); window.removeEventListener('pointerdown', _audioGesture); window.removeEventListener('keydown', _audioGesture); };
      window.addEventListener('pointerdown', _audioGesture);
      window.addEventListener('keydown', _audioGesture);

      // Deep-link: /voxel?modal=library|arcade|museum opens that modal.
      {
        const m = new URLSearchParams(location.search).get('modal');
        if (m) setTimeout(() => {
          if (m === 'library') window.openLibraryModal?.();
          else if (m === 'arcade') window.openArcadeModal?.();
          else if (m === 'museum') window.openMuseumModal?.();
        }, 700);
      }

      window.__voxel = {
  counts() { return { boxes: boxes.length, citizens: citizens.size }; },
  tileAt(gx, gy) { let t = getCityTileType(gx, gy); if (gy === 108 || gy === 109) t = 'beach_sand'; else if (gy === 110 || gy === 111) t = 'ocean_surf'; return t; },
  debug() { return { cars: cars.length, wildlife: wildlife.length, marine: marine.length, trainActive: train.active, trainX: Math.round(train.x), trainRide, boatRide, boatX: Math.round(boat.x), boatZ: Math.round(boat.z), buildings: cityGroup.children.length, water: waterBoxes.length, solids: solidProps.size, audioCtx: !!amb.ctx, audioMuted: amb.muted, masterGain: amb.master ? +amb.master.gain.value.toFixed(3) : null }; },
  stopOrbit() { controls.autoRotate = false; },
  async reload() { await refreshSnapshot(); },
  setWalk, setFps, player,
  setDayT(v) { dayT = v; },
  routeClick,
  secretAt(gx, gy) {
    let s = null;
    try { s = getSecretAt(gx, gy); } catch { /* ignore */ }
    if (s) secretModal(s);
    return s ? s.id : null;
  },
  routeAt(gx, gy, h) {
    const rect = renderer.domElement.getBoundingClientRect();
    const vv = new THREE.Vector3(gx * WORLD_SCALE, h === undefined ? 3 : h, gy * WORLD_SCALE).project(camera);
    if (vv.z > 1) return 'offscreen';
    return routeClick(
      (vv.x * 0.5 + 0.5) * rect.width + rect.left,
      (-vv.y * 0.5 + 0.5) * rect.height + rect.top
    );
  },
  aimCitizen() {
    const rect = renderer.domElement.getBoundingClientRect();
    const vv = new THREE.Vector3();
    let best = null, bestD = 1e9;
    for (const c of citizens.values()) {
      vv.set(c.x * WORLD_SCALE, (c.groundY || 0) + 1.2, c.z * WORLD_SCALE).project(camera);
      if (vv.z > 1) continue;
      const sx = (vv.x * 0.5 + 0.5) * rect.width + rect.left;
      const sy = (-vv.y * 0.5 + 0.5) * rect.height + rect.top;
      const d = Math.hypot(sx - rect.left - rect.width / 2, sy - rect.top - rect.height / 2);
      if (d < bestD) { bestD = d; best = { x: sx, y: sy }; }
    }
    return best;
  },
  aimBillboard() {
    const all = this.billboardScreens();
    if (!all.length) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    let best = all[0];
    let bestD = 1e9;
    for (const p of all) {
      const d = Math.hypot(p.x - rect.left - rect.width / 2, p.y - rect.top - rect.height / 2);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  },
  aimBillboard() {
    const all = this.billboardScreens();
    if (!all.length) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    let best = all[0];
    let bestD = 1e9;
    for (const p of all) {
      const d = Math.hypot(p.x - rect.left - rect.width / 2, p.y - rect.top - rect.height / 2);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  },
  billboardScreens() {
    const rect = renderer.domElement.getBoundingClientRect();
    const vv = new THREE.Vector3();
    const out = [];
    for (const b of billboardSpots) {
      vv.set(b.gx * WORLD_SCALE, b.top - 1.5, b.gy * WORLD_SCALE).project(camera);
      if (vv.z > 1) continue;
      const sx = (vv.x * 0.5 + 0.5) * rect.width + rect.left;
      const sy = (-vv.y * 0.5 + 0.5) * rect.height + rect.top;
      if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) continue;
      out.push({ x: sx, y: sy, gx: b.gx, gy: b.gy });
    }
    return out;
  },
  mats() {
    return {
      waterBoxes: waterBoxes.length, foamBoxes: foamBoxes.length,
      waterOpacity: 1, foamOpacity: +foamMat.opacity.toFixed(3),
    };
  },
  view(x, z, dist) {
    controls.autoRotate = false;
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    controls.target.set(x, 2, z);
    camera.position.set(x, 2, z).addScaledVector(dir, dist || 60);
    controls.update();
  },
  cam() {
    return {
      pos: { ...camera.position },
      tgt: { ...controls.target },
      az: Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z),
    };
  },
};

refreshSnapshot();
setInterval(refreshSnapshot, 30000);
tick();
