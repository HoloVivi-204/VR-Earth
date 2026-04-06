import * as THREE from 'three';
import { CAMERA, COLORS, J2000_EPOCH, QUALITY } from './core/constants.js';
import { Earth } from './objects/Earth.js';
import { CloudLayer } from './objects/CloudLayer.js';
import { Moon } from './objects/Moon.js';
import { Sun } from './objects/Sun.js';
import { AdminMode } from './objects/AdminMode.js';
import { NavigationControls } from './controls/NavigationControls.js';
import { VRManager } from './xr/VRManager.js';

let timeScale = 240;
let virtualTime = Date.now();
let isAdminMode = false;

const app = document.getElementById('app');
const modeButton = document.getElementById('modeToggleBtn');
const speedValue = document.getElementById('speedValue');
const speedDownButton = document.getElementById('speedDownBtn');
const speedUpButton = document.getElementById('speedUpBtn');
const pauseButton = document.getElementById('pauseBtn');
const viewButtons = Array.from(document.querySelectorAll('[data-view]'));
const vrButton = document.getElementById('vrButton');
const vrLabel = document.getElementById('vrLabel');

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.SPACE_BLACK);

const camera = new THREE.PerspectiveCamera(
  CAMERA.FOV,
  window.innerWidth / window.innerHeight,
  CAMERA.NEAR,
  CAMERA.FAR
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.PIXEL_RATIO_DESKTOP));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = false;
renderer.xr.enabled = true;
app.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xf0f6ff, 0.5);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0x8fc7ff, 0x08111f, 0.38);
scene.add(hemiLight);

const fillLight = new THREE.DirectionalLight(0xa9d7ff, 0.28);
fillLight.position.set(-25, 8, 18);
scene.add(fillLight);

const sunLight = new THREE.DirectionalLight(0xfff1d8, 3.8);
scene.add(sunLight);

function getSunDirection(timestamp) {
  const daysSinceJ2000 = (timestamp - J2000_EPOCH) / 86400000;
  const L = (280.46 + 0.9856474 * daysSinceJ2000) % 360;
  const g = ((357.528 + 0.9856003 * daysSinceJ2000) % 360) * Math.PI / 180;
  const lambda = ((L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) % 360) * Math.PI / 180;
  const epsilon = 23.44 * Math.PI / 180;

  return new THREE.Vector3(
    Math.cos(lambda),
    Math.sin(lambda) * Math.sin(epsilon),
    -Math.sin(lambda) * Math.cos(epsilon)
  ).normalize();
}

const earth = new Earth();
earth.setMaxAnisotropy(renderer);
scene.add(earth.group);

const clouds = new CloudLayer();
earth.surfaceRoot.add(clouds.mesh);

const moon = new Moon();
earth.group.add(moon.pivot);

const sun = new Sun();
scene.add(sun.group);

const adminMode = new AdminMode();
earth.surfaceRoot.add(adminMode.group);

const controls = new NavigationControls(camera, renderer.domElement);
const vrManager = new VRManager(renderer, camera, scene);

const PRESET_VIEWS = {
  overview: new THREE.Vector3(0, CAMERA.ISS_DISTANCE * 0.35, CAMERA.ISS_DISTANCE),
  equator: new THREE.Vector3(CAMERA.ISS_DISTANCE, 0, 0),
  polar: new THREE.Vector3(0, CAMERA.ISS_DISTANCE * 1.15, 0.001),
};

function applyDesktopQuality() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.PIXEL_RATIO_DESKTOP));
}

function applyVRQuality() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.PIXEL_RATIO_VR));
}

function setView(name) {
  const preset = PRESET_VIEWS[name];
  if (!preset) return;
  camera.position.copy(preset);
  camera.lookAt(0, 0, 0);
  controls.syncFromCamera();

  viewButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.view === name);
  });
}

function updateSpeedLabel() {
  speedValue.textContent = timeScale === 0 ? 'Paused' : `${timeScale}x`;
  pauseButton.classList.toggle('active', timeScale === 0);
}

function setMode(admin) {
  isAdminMode = admin;
  adminMode.setActive(admin);
  modeButton.classList.toggle('admin', admin);
  modeButton.querySelector('.mode-text').textContent = admin ? 'Admin-lite' : 'Natural';
}

function toggleMode() {
  setMode(!isAdminMode);
}

function stepSpeed(direction) {
  const speeds = [0, 60, 120, 240, 480, 960];
  const index = Math.max(0, speeds.indexOf(timeScale));
  const nextIndex = THREE.MathUtils.clamp(index + direction, 0, speeds.length - 1);
  timeScale = speeds[nextIndex];
  updateSpeedLabel();
}

function togglePause() {
  timeScale = timeScale === 0 ? 240 : 0;
  updateSpeedLabel();
}

controls.onModeToggle = toggleMode;
vrManager.onModeToggle = toggleMode;
vrManager.onResetView = () => setView('overview');
vrManager.onSpeedChange = stepSpeed;

modeButton.addEventListener('click', toggleMode);
speedDownButton.addEventListener('click', () => stepSpeed(-1));
speedUpButton.addEventListener('click', () => stepSpeed(1));
pauseButton.addEventListener('click', togglePause);

viewButtons.forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'm' || event.key === 'M') toggleMode();
  if (event.key === ' ') {
    event.preventDefault();
    togglePause();
  }
  if (event.key === '[') stepSpeed(-1);
  if (event.key === ']') stepSpeed(1);
  if (event.key === '1') setView('overview');
  if (event.key === '2') setView('equator');
  if (event.key === '3') setView('polar');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.xr.addEventListener('sessionstart', applyVRQuality);
renderer.xr.addEventListener('sessionend', applyDesktopQuality);

if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
    if (!supported) {
      vrButton.classList.add('unavailable');
      vrLabel.textContent = 'VR Unsupported';
      return;
    }

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
  });
} else {
  vrButton.classList.add('unavailable');
  vrLabel.textContent = 'No WebXR';
}

setView('overview');
setMode(false);
updateSpeedLabel();

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  virtualTime += delta * 1000 * timeScale;

  const sunDir = getSunDirection(virtualTime);
  sunLight.position.copy(sunDir).multiplyScalar(100);

  earth.update(virtualTime);
  earth.setSunDirection(sunDir);
  clouds.update(virtualTime / 1000);
  moon.update(virtualTime, J2000_EPOCH);
  sun.update(sunDir);
  adminMode.update(virtualTime, delta);
  controls.update(delta);
  vrManager.update();

  renderer.render(scene, camera);
});
