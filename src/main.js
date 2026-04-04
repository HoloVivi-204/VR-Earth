/**
 * Digital Earth — Main Entry (All Phases Complete)
 *
 * Clear Mode Separation:
 * - Natural Mode: Earth + Clouds + Water + Atmosphere + Night Lights
 * - Admin Mode: Dark overlay + Borders + Labels + Flights + Maritime + GDP
 *
 * Two modes NEVER mix — toggled by dedicated button, M key, or VR Y button
 */
import * as THREE from 'three';
import { CAMERA, COLORS, WGS84, J2000_EPOCH } from './core/constants.js';
import { AdaptiveQuality } from './core/AdaptiveQuality.js';
import { Earth } from './objects/Earth.js';
import { CloudLayer } from './objects/CloudLayer.js';
import { WaterOverlay } from './objects/WaterOverlay.js';
import { Moon } from './objects/Moon.js';
import { Sun } from './objects/Sun.js';
import { AdminMode } from './objects/AdminMode.js';
import { createStarField } from './objects/Stars.js';
import { NavigationControls } from './controls/NavigationControls.js';
import { VRManager } from './xr/VRManager.js';

/* ============================================================
   Virtual Time System
   ============================================================ */
let timeScale = 360;
let virtualTime = Date.now();

/* ============================================================
   Scene, Camera, Renderer
   ============================================================ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.SPACE_BLACK);

const camera = new THREE.PerspectiveCamera(
  CAMERA.FOV, window.innerWidth / window.innerHeight, CAMERA.NEAR, CAMERA.FAR
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;

document.getElementById('app').appendChild(renderer.domElement);

/* ============================================================
   Lighting
   ============================================================ */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff8f0, 2.5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
scene.add(sunLight);

function getSunDirection(timestamp) {
  const daysSinceJ2000 = (timestamp - J2000_EPOCH) / 86400000;
  const L = (280.460 + 0.9856474 * daysSinceJ2000) % 360;
  const g = ((357.528 + 0.9856003 * daysSinceJ2000) % 360) * Math.PI / 180;
  const lambda = ((L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) % 360) * Math.PI / 180;
  const epsilon = 23.44 * Math.PI / 180;
  return new THREE.Vector3(
    Math.cos(lambda),
    Math.sin(lambda) * Math.sin(epsilon),
    -Math.sin(lambda) * Math.cos(epsilon)
  ).normalize();
}

/* ============================================================
   NATURAL MODE Objects — Earth, Clouds, Water, Atmosphere
   ============================================================ */
const earth = new Earth();
earth.setMaxAnisotropy(renderer);
scene.add(earth.group);

const clouds = new CloudLayer();
earth.group.add(clouds.mesh);

const water = new WaterOverlay();
earth.group.add(water.group);

/* ============================================================
   Celestial Bodies — Moon + Sun
   ============================================================ */
const moon = new Moon();
earth.group.add(moon.pivot);

const sun = new Sun();
scene.add(sun.group);

/* ============================================================
   ADMIN MODE Objects — Completely separate group
   ============================================================ */
const adminMode = new AdminMode(camera);
earth.group.add(adminMode.group);

/* ============================================================
   Stars
   ============================================================ */
const stars = createStarField();
scene.add(stars);

/* ============================================================
   Camera — ISS spawn
   ============================================================ */
camera.position.set(0, CAMERA.ISS_DISTANCE * 0.35, CAMERA.ISS_DISTANCE);
camera.lookAt(0, 0, 0);

/* ============================================================
   MODE MANAGEMENT — Clear separation Natural vs Admin
   ============================================================ */
let isAdminMode = false;

// Natural-only objects (hidden when Admin)
const naturalObjects = [clouds.mesh, water.group];

const modeBlend = { val: 0 }; // 0 = Natural, 1 = Admin

function setMode(admin) {
  if (isAdminMode === admin) return;
  isAdminMode = admin;
  adminMode.setActive(true); // Ensure admin group stays visible during animation

  window.gsap.to(modeBlend, {
    val: admin ? 1 : 0,
    duration: 1.5,
    ease: 'power2.inOut',
    onUpdate: () => {
      const v = modeBlend.val;
      
      // Fade admin dark overlay
      if (adminMode.darkOverlay) {
        adminMode.darkOverlay.material.opacity = v * 0.7;
      }
      // Fade clouds and water
      if (clouds.cloudSphere) {
        clouds.cloudSphere.material.opacity = (1 - v) * 0.85;
      }
      if (water.waterMesh) {
        water.waterMesh.material.opacity = (1 - v) * 0.6;
      }
      if (earth.atmosphereMesh && isAtmosEnabled) {
        earth.atmosphereMesh.material.opacity = (1 - v);
      }
    },
    onComplete: () => {
      // Hide completely when done fading out
      if (!admin) adminMode.setActive(false);
      if (clouds.mesh) clouds.setVisible(!admin);
      if (water.group) water.group.visible = !admin;
      if (earth.atmosphereMesh) earth.atmosphereMesh.visible = isAtmosEnabled && !admin;
    }
  });

  // Update all UI indicators
  const indicator = document.getElementById('modeIndicator');
  const indLabel = indicator.querySelector('.mode-label');
  indicator.classList.toggle('natural', !admin);
  indicator.classList.toggle('admin', admin);
  indLabel.textContent = admin ? '🗺️ Admin & Social' : '🌍 Natural';

  const toggleBtn = document.getElementById('modeToggleBtn');
  const toggleIcon = document.getElementById('modeIcon');
  const toggleLabel = document.getElementById('modeLabel');
  toggleBtn.classList.toggle('natural', !admin);
  toggleBtn.classList.toggle('admin', admin);
  toggleIcon.textContent = admin ? '🗺️' : '🌍';
  toggleLabel.textContent = admin ? 'Admin & Social' : 'Natural';

  const hudMode = document.getElementById('hudMode');
  if (hudMode) hudMode.textContent = admin ? 'Admin' : 'Natural';
}

function toggleMode() {
  setMode(!isAdminMode);
}

function resetView() {
  camera.position.set(0, CAMERA.ISS_DISTANCE * 0.35, CAMERA.ISS_DISTANCE);
  camera.lookAt(0, 0, 0);
}

/* ============================================================
   Controls
   ============================================================ */
const controls = new NavigationControls(camera, renderer.domElement);
controls.onModeToggle = toggleMode;

// Mode toggle button (dedicated UI button)
document.getElementById('modeToggleBtn').addEventListener('click', toggleMode);

// Mode indicator pill also clickable
document.getElementById('modeIndicator').addEventListener('click', toggleMode);

// Keyboard M
window.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') toggleMode();
});

/* ============================================================
   Settings Panel
   ============================================================ */
document.getElementById('settingsToggle').addEventListener('click', () => {
  document.getElementById('settingsBody').classList.toggle('hidden');
});

// Time speed
document.getElementById('timeSpeedSelect').addEventListener('change', (e) => {
  timeScale = parseInt(e.target.value);
});

// Cloud toggle
document.getElementById('cloudToggle').addEventListener('change', (e) => {
  clouds.setVisible(e.target.checked);
});

// Water toggle
document.getElementById('waterToggle').addEventListener('change', (e) => {
  water.group.visible = e.target.checked && !isAdminMode;
});

// Night Lights toggle
document.getElementById('nightToggle').addEventListener('change', (e) => {
  earth.setNightLights(e.target.checked);
});

// Atmosphere toggle
let isAtmosEnabled = true;
document.getElementById('atmosToggle').addEventListener('change', (e) => {
  isAtmosEnabled = e.target.checked;
  if (earth.atmosphereMesh) {
    earth.atmosphereMesh.visible = isAtmosEnabled && !isAdminMode;
  }
});

// FOV slider
document.getElementById('fovSlider').addEventListener('input', (e) => {
  const fov = parseInt(e.target.value);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  document.getElementById('fovVal').textContent = fov + '°';
});

// Flights toggle
document.getElementById('flightsToggle').addEventListener('change', (e) => {
  adminMode.setFlightsVisible(e.target.checked);
});

// Satellites toggle
document.getElementById('satsToggle').addEventListener('change', (e) => {
  adminMode.setSatellitesVisible(e.target.checked);
});

/* ============================================================
   Adaptive Quality
   ============================================================ */
const quality = new AdaptiveQuality(renderer);

/* ============================================================
   VR Manager
   ============================================================ */
const vrManager = new VRManager(renderer, camera, scene);
vrManager.onModeToggle = toggleMode;
vrManager.onResetView = resetView;

/* ============================================================
   WebXR Button
   ============================================================ */
const vrButton = document.getElementById('vrButton');
const vrLabel = document.getElementById('vrLabel');

if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
    if (supported) {
      vrButton.addEventListener('click', async () => {
        if (!renderer.xr.isPresenting) {
          const session = await navigator.xr.requestSession('immersive-vr', {
            optionalFeatures: ['local-floor', 'bounded-floor'],
          });
          renderer.xr.setSession(session);
          vrLabel.textContent = 'Exit VR';
        } else {
          renderer.xr.getSession()?.end();
          vrLabel.textContent = 'Enter VR';
        }
      });
    } else {
      vrButton.classList.add('unavailable');
      vrLabel.textContent = 'VR Not Available';
    }
  });
} else {
  vrButton.classList.add('unavailable');
  vrLabel.textContent = 'WebXR Not Supported';
}

/* ============================================================
   HUD
   ============================================================ */
const hudUtc = document.getElementById('hudUtc');
const hudFps = document.getElementById('hudFps');
let hudTimer = 0;

function updateHUD(delta) {
  hudTimer += delta;
  if (hudTimer < 0.25) return;
  hudTimer = 0;
  const vDate = new Date(virtualTime);
  hudUtc.textContent = vDate.toISOString().slice(11, 19);
  hudFps.textContent = quality.currentFPS;
}

/* ============================================================
   Resize
   ============================================================ */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ============================================================
   Animation Loop
   ============================================================ */
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  virtualTime += delta * 1000 * timeScale;

  const sunDir = getSunDirection(virtualTime);
  sunLight.position.copy(sunDir).multiplyScalar(100);

  // Earth: rotation + night lights + atmosphere sun direction
  earth.update(virtualTime);
  earth.setSunDirection(sunDir);

  // Clouds (only update if visible)
  if (clouds.mesh.visible) {
    clouds.update(virtualTime / 1000, sunDir);
  }

  // Water (only update if visible)
  if (water.group.visible) {
    water.update(virtualTime / 1000, sunDir);
  }

  // Moon + Sun
  moon.update(virtualTime, J2000_EPOCH);
  sun.update(sunDir);

  // Eclipse Detection (Pure Math)
  const sunToEarth = sunDir.clone().negate(); // Earth is at (0,0,0), so vector from Sun to Earth is -sunDir
  const moonPos = moon.mesh.getWorldPosition(new THREE.Vector3());
  const t = moonPos.dot(sunToEarth);

  // If Moon is on the opposite side of the Earth from the Sun
  if (t > 0) {
    const closestPoint = sunToEarth.multiplyScalar(t);
    const distToAxis = moonPos.distanceTo(closestPoint);
    const EARTH_RADIUS = WGS84.SCENE_RADIUS;
    const MOON_RADIUS = WGS84.SCENE_RADIUS * (1737.4 / 6378.137);
    
    if (distToAxis < EARTH_RADIUS + MOON_RADIUS) {
      // Penumbra / Umbra penetration (0 = edge, 1 = deep umbra)
      const umbraFactor = 1.0 - (distToAxis / (EARTH_RADIUS + MOON_RADIUS));
      
      const baseColor = new THREE.Color(0.12, 0.12, 0.12);
      const bloodMoonColor = new THREE.Color(0.4, 0.05, 0.05); // Blood red for eclipse
      moon.mesh.material.color.lerpColors(baseColor, bloodMoonColor, umbraFactor * umbraFactor);
    } else {
      moon.mesh.material.color.setRGB(0.12, 0.12, 0.12);
    }
  } else {
    moon.mesh.material.color.setRGB(0.12, 0.12, 0.12);
  }

  // Admin overlay (maritime animation etc)
  adminMode.update(virtualTime);

  // VR controllers
  vrManager.update();

  // Controls + Quality + HUD
  controls.update(delta);
  quality.update();
  updateHUD(delta);

  renderer.render(scene, camera);
});
