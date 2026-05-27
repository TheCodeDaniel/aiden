// ─────────────────────────────────────────────────────────────────────────────
// scene.js — ALL Three.js / 3D logic lives here.
//
// Exports:
//   initScene()          → call once on page load; starts the render loop
//   setNpcStanding(n)    → updates the NPC color + standing label
//   isPlayerInRange()    → returns true when player is close enough to interact
//   getNpcScreenPos()    → returns {x,y} pixel position of the NPC (for the label)
//
// This module knows nothing about wallets or contracts — it only exposes
// a clean interface that main.js calls.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';

// ── Scene-level variables ─────────────────────────────────────────────────────

let scene, camera, renderer;
let playerMesh, npcMesh;
let _isPlayerInRange = false;

// NPC world position (fixed throughout the game)
const NPC_POSITION = new THREE.Vector3(0, 1, -8);

// How close the player must be to trigger the interaction panel
const INTERACTION_RADIUS = 3.0;

// ── Keyboard state ────────────────────────────────────────────────────────────
// We track which keys are held down each frame rather than using key events
// inside the animation loop — this gives smooth movement.
const keys = {
  ArrowUp: false, w: false, W: false,
  ArrowDown: false, s: false, S: false,
  ArrowLeft: false, a: false, A: false,
  ArrowRight: false, d: false, D: false,
};

// ── initScene ─────────────────────────────────────────────────────────────────
// Sets up the full Three.js scene and starts the animation loop.
// Should be called exactly once, as early as possible.
export function initScene() {
  // ── Scene & camera ──────────────────────────────────────────────────────────
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e); // dark navy — easy on the eyes
  scene.fog = new THREE.Fog(0x1a1a2e, 20, 50);  // fades distant objects to bg color

  // PerspectiveCamera(fov, aspect, near, far)
  // fov=60° is natural; near=0.1 avoids z-fighting close to the camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);

  // ── Renderer ────────────────────────────────────────────────────────────────
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // devicePixelRatio makes it sharp on retina/HiDPI screens (capped at 2 to save GPU)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  // Mount the canvas inside our container div (defined in index.html)
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  // ── Lights ──────────────────────────────────────────────────────────────────
  // AmbientLight illuminates everything evenly — prevents total darkness in shadows
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  // DirectionalLight simulates the sun; castShadow makes it project shadows
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(10, 20, 10);
  sun.castShadow = true;
  scene.add(sun);

  // ── Ground plane ────────────────────────────────────────────────────────────
  // PlaneGeometry is flat by default (XZ plane); we rotate it to lie on the floor
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshLambertMaterial({ color: 0x2d4a3e }) // dark green
  );
  ground.rotation.x = -Math.PI / 2; // rotate 90° around X so it faces up
  ground.receiveShadow = true;
  scene.add(ground);

  // Subtle grid helps with spatial orientation
  const grid = new THREE.GridHelper(60, 30, 0x3a5a4a, 0x3a5a4a);
  scene.add(grid);

  // ── Player mesh ─────────────────────────────────────────────────────────────
  // A simple box — no loaded models needed for a test harness
  playerMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.2, 0.6),
    new THREE.MeshLambertMaterial({ color: 0x4a9eff }) // blue
  );
  playerMesh.position.set(0, 0.6, 0); // y=0.6 so the base sits on y=0
  playerMesh.castShadow = true;
  scene.add(playerMesh);

  // ── NPC mesh ─────────────────────────────────────────────────────────────────
  // A cylinder distinguishes the NPC from the boxy player at a glance
  // CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
  npcMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 1.6, 16),
    new THREE.MeshLambertMaterial({ color: 0x888888 }) // starts neutral grey
  );
  npcMesh.position.copy(NPC_POSITION);
  npcMesh.castShadow = true;
  scene.add(npcMesh);

  // ── Keyboard listeners ───────────────────────────────────────────────────────
  window.addEventListener('keydown', (e) => { if (e.key in keys) keys[e.key] = true; });
  window.addEventListener('keyup',   (e) => { if (e.key in keys) keys[e.key] = false; });

  // ── Resize handling ──────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); // must call this after changing aspect
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── Start the render loop ────────────────────────────────────────────────────
  animate();
}

// ── animate ───────────────────────────────────────────────────────────────────
// Called ~60 times/second by requestAnimationFrame.
// Move player → update camera → check NPC distance → render.
function animate() {
  requestAnimationFrame(animate);

  const speed = 0.08; // units per frame

  // Movement is in world-space XZ (no physics, no collision)
  if (keys.ArrowUp    || keys.w || keys.W) playerMesh.position.z -= speed;
  if (keys.ArrowDown  || keys.s || keys.S) playerMesh.position.z += speed;
  if (keys.ArrowLeft  || keys.a || keys.A) playerMesh.position.x -= speed;
  if (keys.ArrowRight || keys.d || keys.D) playerMesh.position.x += speed;

  // Simple camera follow — fixed offset above and behind the player
  camera.position.set(
    playerMesh.position.x,
    playerMesh.position.y + 6,
    playerMesh.position.z + 10
  );
  camera.lookAt(playerMesh.position);

  // Distance check: are we close enough to the NPC to interact?
  const dist = playerMesh.position.distanceTo(NPC_POSITION);
  _isPlayerInRange = dist < INTERACTION_RADIUS;

  renderer.render(scene, camera);
}

// ── setNpcStanding ────────────────────────────────────────────────────────────
// Called by main.js whenever the standing value changes.
// Updates both the NPC color and the standing number displayed on screen.
export function setNpcStanding(value) {
  // Color mapping:
  //   positive (>= +5) → green   — NPC likes you
  //   negative (<= -5) → red     — NPC distrusts you
  //   near zero        → grey    — neutral
  let color;
  if      (value >= 5)  color = 0x4caf50; // green
  else if (value <= -5) color = 0xe53935; // red
  else                  color = 0x888888; // neutral grey

  // npcMesh.material is the MeshLambertMaterial we set up in initScene
  npcMesh.material.color.setHex(color);

  // Update the HTML overlay label
  const standingEl = document.getElementById('npc-standing');
  if (standingEl) {
    standingEl.textContent = value >= 0 ? `+${value}` : `${value}`;
    // Match label color to mesh color for visual consistency
    const hex = '#' + color.toString(16).padStart(6, '0');
    standingEl.style.color = hex;
  }
}

// ── isPlayerInRange ───────────────────────────────────────────────────────────
// Returns true if the player is within INTERACTION_RADIUS of the NPC.
// main.js polls this each frame to show/hide the interaction panel.
export function isPlayerInRange() {
  return _isPlayerInRange;
}

// ── getNpcScreenPos ───────────────────────────────────────────────────────────
// Projects the NPC's 3D world position onto 2D screen coordinates.
// main.js uses this to position the floating HTML label above the NPC each frame.
export function getNpcScreenPos() {
  if (!renderer || !camera) return { x: 0, y: 0 };

  // Clone so we don't mutate NPC_POSITION
  const pos = NPC_POSITION.clone();

  // project() transforms world coords → NDC (Normalized Device Coordinates: -1..1)
  pos.project(camera);

  // Convert NDC to pixel coordinates
  return {
    x: ( pos.x * 0.5 + 0.5) * window.innerWidth,
    y: (-pos.y * 0.5 + 0.5) * window.innerHeight - 20, // -20px so label sits above mesh
  };
}
