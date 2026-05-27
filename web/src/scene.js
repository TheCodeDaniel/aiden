// ─────────────────────────────────────────────────────────────────────────────
// scene.js — All Three.js / 3D logic.
//
// Exports (same interface as before — main.js is unchanged):
//   initScene()           → call once on page load
//   setNpcStanding(value) → recolours the NPC + updates the HTML label
//   isPlayerInRange()     → true when player can interact
//   getNpcScreenPos()     → {x,y} pixel coords for the floating label
//
// Everything here is primitive-based geometry. No external model files.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';

// ─── Constants ────────────────────────────────────────────────────────────────

// Fixed world position of the NPC (never moves)
const NPC_WORLD_POS      = new THREE.Vector3(0, 0, -8);
const INTERACTION_RADIUS = 3.0;

// NPC standing colours
const COLOR_POSITIVE = 0x4caf50; // green
const COLOR_NEUTRAL  = 0x8a8a7e; // warm grey
const COLOR_NEGATIVE = 0xe53935; // red

// Player colour palette — three tones of blue
const PLAYER_TORSO = 0x4a9eff; // bright blue
const PLAYER_LIMBS = 0x2d6eb8; // darker blue for arms & legs
const PLAYER_HEAD  = 0x7bbfff; // lighter blue for head

// ─── Camera orbit parameters ─────────────────────────────────────────────────
//
// The camera orbits the player in spherical coordinates:
//   theta = horizontal angle (yaw),  phi = vertical angle (pitch)
//
// Spherical → Cartesian (relative to orbit target):
//   x = r · sin(φ) · sin(θ)
//   y = r · cos(φ)
//   z = r · sin(φ) · cos(θ)
//
// θ = 0  →  camera is directly behind the player at +Z.
// φ = 0  →  camera is straight above (looking straight down).
const cam = {
  theta:     0,
  phi:       Math.PI / 3.5, // start slightly above horizontal
  radius:    9,
  minRadius: 3,
  maxRadius: 18,
  minPhi:    0.25,  // ~14° — camera can't sink below the ground
  maxPhi:    1.45,  // ~83° — camera can't flip overhead
};

// The camera smoothly follows this target, which lerps toward the player
const camTarget = new THREE.Vector3();

// ─── Module state ─────────────────────────────────────────────────────────────

let scene, camera, renderer;
let playerGroup, npcGroup;
// Single material shared by every body-part mesh of the NPC.
// Updating npcMaterial.color recolours the whole figure in one call.
let npcMaterial;
let _isPlayerInRange = false;
let lastFrameTime    = performance.now();

// ─── Input ────────────────────────────────────────────────────────────────────

const keys = {
  ArrowUp: false, w: false, W: false,
  ArrowDown:  false, s: false, S: false,
  ArrowLeft:  false, a: false, A: false,
  ArrowRight: false, d: false, D: false,
};

// Tracks whether the user is click-dragging the camera
const drag = { active: false, lastX: 0, lastY: 0 };

// ─── initScene ────────────────────────────────────────────────────────────────
export function initScene() {

  // ── Scene & atmosphere ────────────────────────────────────────────────────
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd4956a); // warm golden-orange sky
  // Linear fog: starts at 30 units, fully opaque at 65. Matches the sky colour
  // so objects dissolve into the horizon rather than cutting off hard.
  scene.fog = new THREE.Fog(0xd4956a, 30, 65);

  // ── Camera ────────────────────────────────────────────────────────────────
  camera = new THREE.PerspectiveCamera(
    60,                                      // fov — 60° feels natural
    window.innerWidth / window.innerHeight,  // aspect
    0.1,                                     // near — small avoids clipping
    100                                      // far
  );

  // ── Renderer ──────────────────────────────────────────────────────────────
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Shadow maps let objects cast shadows onto the ground and each other.
  // PCFSoft gives softer shadow edges — good for outdoor sunlight.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  // ACES filmic tone mapping adds warmth and subtle contrast — cinematic feel
  renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  document.getElementById('canvas-container').appendChild(renderer.domElement);

  // ── Lights ────────────────────────────────────────────────────────────────
  // Warm ambient: fills shadows so they're dark but not pure black
  const ambient = new THREE.AmbientLight(0xffd8a0, 0.55);
  scene.add(ambient);

  // Directional "sun" at a golden-hour angle, strong enough to cast clear shadows
  const sun = new THREE.DirectionalLight(0xfff4a0, 1.9);
  sun.position.set(15, 25, 10);
  sun.castShadow = true;

  // Shadow camera frustum must cover the entire area where shadows are visible.
  // left/right/top/bottom define a box in the sun's local space.
  sun.shadow.camera.near   =  1;
  sun.shadow.camera.far    = 90;
  sun.shadow.camera.left   = -30;
  sun.shadow.camera.right  =  30;
  sun.shadow.camera.top    =  30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.mapSize.width  = 2048; // higher = crisper shadows at GPU cost
  sun.shadow.mapSize.height = 2048;
  sun.shadow.bias = -0.001;         // prevents "shadow acne" (self-shadowing noise)
  scene.add(sun);

  // ── Ground ────────────────────────────────────────────────────────────────
  // Large grass plane — 80 × 80 units; fog hides the far edge
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshLambertMaterial({ color: 0x5c7a3e }) // medium green
  );
  grass.rotation.x = -Math.PI / 2; // PlaneGeometry lies in XY by default; rotate to XZ
  grass.receiveShadow = true;
  scene.add(grass);

  // Warm dirt clearing in the village centre.
  // Raised 0.01 units to prevent Z-fighting (two coplanar surfaces flickering).
  const dirt = new THREE.Mesh(
    new THREE.CircleGeometry(14, 32),
    new THREE.MeshLambertMaterial({ color: 0x9b7a3e })
  );
  dirt.rotation.x  = -Math.PI / 2;
  dirt.position.y  = 0.01;
  dirt.receiveShadow = true;
  scene.add(dirt);

  // ── Player character ──────────────────────────────────────────────────────
  // buildHumanoid(torsoColor, limbColor, headColor, sharedMat)
  // Passing null for sharedMat gives each body part its own material (needed
  // for the three-tone blue palette).
  playerGroup = buildHumanoid(PLAYER_TORSO, PLAYER_LIMBS, PLAYER_HEAD, null);
  playerGroup.position.set(0, 0, 0);
  scene.add(playerGroup);

  // ── NPC character ─────────────────────────────────────────────────────────
  // All NPC body parts share ONE material instance so setNpcStanding() can
  // recolour the entire figure with a single npcMaterial.color update.
  npcMaterial = new THREE.MeshLambertMaterial({ color: COLOR_NEUTRAL });
  npcGroup    = buildHumanoid(COLOR_NEUTRAL, COLOR_NEUTRAL, COLOR_NEUTRAL, npcMaterial);
  npcGroup.position.copy(NPC_WORLD_POS);
  scene.add(npcGroup);

  // ── NPC ground marker ─────────────────────────────────────────────────────
  // Gold ring on the ground — tells the player "walk here to interact"
  const marker = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.07, 8, 36),
    new THREE.MeshLambertMaterial({
      color:             0xffd700,
      emissive:          0xffd700,
      emissiveIntensity: 0.35, // subtle glow even in shadow
    })
  );
  marker.rotation.x = -Math.PI / 2; // lay the torus flat on the ground
  marker.position.set(NPC_WORLD_POS.x, 0.05, NPC_WORLD_POS.z);
  scene.add(marker);

  // ── Village props ─────────────────────────────────────────────────────────
  buildVillage();

  // ── Input events ──────────────────────────────────────────────────────────
  window.addEventListener('keydown', e => { if (e.key in keys) keys[e.key] = true; });
  window.addEventListener('keyup',   e => { if (e.key in keys) keys[e.key] = false; });

  // Pointer drag → orbit camera
  renderer.domElement.addEventListener('pointerdown', e => {
    drag.active = true;
    drag.lastX  = e.clientX;
    drag.lastY  = e.clientY;
    // setPointerCapture keeps reporting events even if the pointer leaves the canvas
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', e => {
    if (!drag.active) return;
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    // Horizontal drag → yaw (theta), vertical drag → pitch (phi)
    cam.theta -= dx * 0.006;
    cam.phi    = Math.max(cam.minPhi, Math.min(cam.maxPhi, cam.phi + dy * 0.006));
  });
  renderer.domElement.addEventListener('pointerup',    () => { drag.active = false; });
  renderer.domElement.addEventListener('pointerleave', () => { drag.active = false; });

  // Scroll wheel → zoom (adjust orbit radius)
  renderer.domElement.addEventListener('wheel', e => {
    cam.radius = Math.max(
      cam.minRadius,
      Math.min(cam.maxRadius, cam.radius + e.deltaY * 0.02)
    );
  }, { passive: true });

  // Window resize → update camera aspect and renderer size
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); // must call after changing aspect
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Seed the camera target at the player's spawn position
  camTarget.copy(playerGroup.position);
  syncCamera();

  animate();
}

// ─── buildHumanoid ────────────────────────────────────────────────────────────
//
// Assembles a humanoid figure entirely from BoxGeometry and SphereGeometry
// (no external model files).
//
// Y layout (root at y = 0, feet on ground):
//
//    ●  head    centre y ≈ 1.52  (sphere r = 0.22)
//   ███ torso   centre y ≈ 0.975 (box 0.50 × 0.65 × 0.28)
//  ┤ ├ ┤ ├ arms centre y ≈ 0.975 (box 0.18 × 0.60 × 0.18, at x ±0.35)
//   ┃ ┃ legs   centre y ≈ 0.325 (box 0.22 × 0.65 × 0.22, at x ±0.13)
//   ━ ━           total height ≈ 1.74 units
//
// sharedMat: if provided, ALL body parts use this single material — updating
//            sharedMat.color recolours the whole figure in one call.
//            Pass null to give each part its own independent material.
function buildHumanoid(torsoColor, limbColor, headColor, sharedMat) {
  const group = new THREE.Group();

  // m(color) returns the shared material if there is one, otherwise a fresh one.
  const m = color => sharedMat ?? new THREE.MeshLambertMaterial({ color });

  // ── Legs ──────────────────────────────────────────────────────────────────
  const legGeo = new THREE.BoxGeometry(0.22, 0.65, 0.22);
  const legL   = new THREE.Mesh(legGeo, m(limbColor));
  legL.position.set(-0.13, 0.325, 0);
  legL.castShadow = true;

  // .clone() copies all properties (position, material ref, etc.) as new objects,
  // so legR has its own Vector3 position but shares the same material reference.
  const legR = legL.clone();
  legR.position.x = 0.13;

  // ── Torso ─────────────────────────────────────────────────────────────────
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.65, 0.28),
    m(torsoColor)
  );
  torso.position.set(0, 0.975, 0); // directly on top of the legs
  torso.castShadow = true;

  // ── Arms ──────────────────────────────────────────────────────────────────
  const armGeo = new THREE.BoxGeometry(0.18, 0.60, 0.18);
  const armL   = new THREE.Mesh(armGeo, m(limbColor));
  armL.position.set(-0.35, 0.975, 0);
  armL.castShadow = true;

  const armR = armL.clone();
  armR.position.x = 0.35;

  // ── Head ──────────────────────────────────────────────────────────────────
  // Low segment counts (7 width, 5 height) give a faceted "low-poly" sphere
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 7, 5),
    m(headColor)
  );
  head.position.set(0, 1.52, 0); // short neck gap between torso top and head centre
  head.castShadow = true;

  group.add(legL, legR, torso, armL, armR, head);
  return group;
}

// ─── Village building ─────────────────────────────────────────────────────────

function buildVillage() {
  // Two houses in the background
  scene.add(makeHouse(-11, -14,  0.3));
  scene.add(makeHouse( 10, -12, -0.2));

  // Four trees around the clearing edge
  scene.add(makeTree(-5, -13));
  scene.add(makeTree( 7, -11));
  scene.add(makeTree(-8,   5));
  scene.add(makeTree( 9,   4));

  // A few rocks scattered on the ground
  scene.add(makeRock( 3, -4,  0.85));
  scene.add(makeRock(-4,  2,  0.65));
  scene.add(makeRock( 7, -7,  1.0));

  // Well near the NPC — atmospheric village centrepiece
  scene.add(makeWell(-4, -10));
}

// Box body + 4-sided pyramid (ConeGeometry with 4 segments) roof
function makeHouse(x, z, rotY = 0) {
  const group = new THREE.Group();

  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 2.8, 3.0),
    new THREE.MeshLambertMaterial({ color: 0xc9a472 }) // warm sandstone
  );
  walls.position.y = 1.4;
  walls.castShadow    = true;
  walls.receiveShadow = true;

  // ConeGeometry with 4 radial segments = square pyramid
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, 1.8, 4),
    new THREE.MeshLambertMaterial({ color: 0x7a3b1e }) // dark reddish-brown
  );
  roof.position.y  = 2.8 + 0.9;   // top-of-walls + half-roof-height
  roof.rotation.y  = Math.PI / 4; // align pyramid corners with wall corners
  roof.castShadow  = true;

  group.add(walls, roof);
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  return group;
}

// Hexagonal trunk + 7-sided cone canopy = low-poly stylised tree
function makeTree(x, z) {
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.25, 1.8, 6), // 6 sides → hexagonal
    new THREE.MeshLambertMaterial({ color: 0x6b4423 })
  );
  trunk.position.y = 0.9;
  trunk.castShadow = true;

  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.4, 7), // 7 sides → faceted low-poly look
    new THREE.MeshLambertMaterial({ color: 0x2d6b36 })
  );
  canopy.position.y = 1.8 + 1.2; // top-of-trunk + half-canopy-height
  canopy.castShadow = true;

  group.add(trunk, canopy);
  group.position.set(x, 0, z);
  return group;
}

// Squashed dodecahedron = organic-looking ground rock (no randomness that changes per-frame)
function makeRock(x, z, scale = 1.0) {
  const rock = new THREE.Mesh(
    // DodecahedronGeometry(r, detail=0) — 12 pentagonal faces, very low-poly
    new THREE.DodecahedronGeometry(0.45 * scale, 0),
    new THREE.MeshLambertMaterial({ color: 0x7a7060 }) // warm grey
  );
  rock.scale.y    = 0.55;      // squash vertically so it reads as a ground stone
  rock.rotation.y = x * 0.7;  // deterministic variety — same every run
  rock.position.set(x, 0.18 * scale, z);
  rock.castShadow    = true;
  rock.receiveShadow = true;
  return rock;
}

// Stone cylinder base + thin wooden beam
function makeWell(x, z) {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.72, 0.6, 10),
    new THREE.MeshLambertMaterial({ color: 0x888070 })
  );
  base.position.y    = 0.3;
  base.castShadow    = true;
  base.receiveShadow = true;

  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 1.5, 0.12),
    new THREE.MeshLambertMaterial({ color: 0x6b4423 })
  );
  beam.position.y = 1.35;
  beam.castShadow = true;

  group.add(base, beam);
  group.position.set(x, 0, z);
  return group;
}

// ─── Camera sync ──────────────────────────────────────────────────────────────
// Positions and orients the camera based on current cam orbit state + camTarget.
// Called once at init and once per frame inside animate().
function syncCamera() {
  camera.position.set(
    camTarget.x + cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta),
    camTarget.y + cam.radius * Math.cos(cam.phi),
    camTarget.z + cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta)
  );
  camera.lookAt(camTarget);
}

// ─── Animation loop ───────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  const now  = performance.now();
  const dt   = Math.min((now - lastFrameTime) * 0.001, 0.05); // seconds, capped at 50 ms
  lastFrameTime = now;
  const time = now * 0.001; // absolute elapsed seconds for sin-wave animations

  // ── WASD movement relative to camera facing ──────────────────────────────
  //
  // We need two unit vectors in the XZ plane:
  //   forward — the direction the camera is looking (projected onto XZ)
  //   right   — 90° clockwise from forward
  //
  // When θ=0, camera is at +Z looking toward -Z.
  // forward = (-sinθ, 0, -cosθ)   ← at θ=0: (0,0,-1) ✓
  // right   = ( cosθ, 0, -sinθ)   ← at θ=0: (1,0,0)  ✓

  const fX = -Math.sin(cam.theta);
  const fZ = -Math.cos(cam.theta);
  const rX =  Math.cos(cam.theta);
  const rZ = -Math.sin(cam.theta);

  let mX = 0, mZ = 0;
  if (keys.ArrowUp    || keys.w || keys.W) { mX += fX; mZ += fZ; }
  if (keys.ArrowDown  || keys.s || keys.S) { mX -= fX; mZ -= fZ; }
  if (keys.ArrowRight || keys.d || keys.D) { mX += rX; mZ += rZ; }
  if (keys.ArrowLeft  || keys.a || keys.A) { mX -= rX; mZ -= rZ; }

  const moving = mX !== 0 || mZ !== 0;

  if (moving) {
    const len = Math.sqrt(mX * mX + mZ * mZ);
    mX /= len; mZ /= len; // normalise so diagonal speed = cardinal speed

    const speed = 5.0; // units per second
    playerGroup.position.x += mX * speed * dt;
    playerGroup.position.z += mZ * speed * dt;

    // Rotate player to face the direction of travel.
    // Math.atan2(x, z) returns the Y-axis angle for a direction vector in XZ.
    playerGroup.rotation.y = Math.atan2(mX, mZ);
  }

  // ── Idle bob ──────────────────────────────────────────────────────────────
  // Subtle sine-wave on Y — faster and larger while moving (footstep feel)
  playerGroup.position.y = Math.sin(time * (moving ? 7.5 : 1.8)) * (moving ? 0.05 : 0.02);
  npcGroup.position.y    = Math.sin(time * 1.6 + 0.9) * 0.04; // offset phase from player

  // ── NPC always faces the player ───────────────────────────────────────────
  const toPlayerX = playerGroup.position.x - NPC_WORLD_POS.x;
  const toPlayerZ = playerGroup.position.z - NPC_WORLD_POS.z;
  if (Math.abs(toPlayerX) + Math.abs(toPlayerZ) > 0.1) {
    npcGroup.rotation.y = Math.atan2(toPlayerX, toPlayerZ);
  }

  // ── Proximity check (XZ only — bob on Y doesn't affect interaction range) ─
  const dist = Math.sqrt(
    (playerGroup.position.x - NPC_WORLD_POS.x) ** 2 +
    (playerGroup.position.z - NPC_WORLD_POS.z) ** 2
  );
  _isPlayerInRange = dist < INTERACTION_RADIUS;

  // ── Smooth camera follow ──────────────────────────────────────────────────
  // Framerate-independent lerp: factor = 1 − e^(−k·dt).
  // At k=6 the camera reaches ~99 % of the player's position in ~0.75 s.
  const k = 1 - Math.exp(-6 * dt);
  camTarget.x += (playerGroup.position.x - camTarget.x) * k;
  camTarget.y += (playerGroup.position.y - camTarget.y) * k;
  camTarget.z += (playerGroup.position.z - camTarget.z) * k;

  syncCamera();
  renderer.render(scene, camera);
}

// ─── Public API (identical signatures to the original scene.js) ──────────────

// Called by main.js when the onchain standing value changes.
// Updates the NPC colour (via the shared material) and the HTML label.
export function setNpcStanding(value) {
  let color;
  if      (value >= 5)  color = COLOR_POSITIVE;
  else if (value <= -5) color = COLOR_NEGATIVE;
  else                  color = COLOR_NEUTRAL;

  // One material update recolours every body part on the NPC
  npcMaterial.color.setHex(color);

  const el = document.getElementById('npc-standing');
  if (el) {
    el.textContent = value >= 0 ? `+${value}` : `${value}`;
    el.style.color = '#' + color.toString(16).padStart(6, '0');
  }
}

// Returns true when the player is close enough to the NPC to interact.
export function isPlayerInRange() {
  return _isPlayerInRange;
}

// Projects the NPC's head position to 2D screen space.
// main.js uses this to position the floating HTML label above the NPC each frame.
export function getNpcScreenPos() {
  if (!renderer || !camera) return { x: 0, y: 0 };

  // Sample from the top of the NPC figure (group Y + head height ≈ 1.8 units)
  const worldPos = new THREE.Vector3(
    NPC_WORLD_POS.x,
    (npcGroup?.position.y ?? 0) + 1.8,
    NPC_WORLD_POS.z
  );

  // project() converts world-space → NDC (Normalised Device Coordinates: −1 to +1)
  worldPos.project(camera);

  return {
    x:  ( worldPos.x * 0.5 + 0.5) * window.innerWidth,
    y:  (-worldPos.y * 0.5 + 0.5) * window.innerHeight - 8,
  };
}
