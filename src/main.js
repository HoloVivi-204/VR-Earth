import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { SETTINGS, sunPosition } from './config.js';
import { initControlPanel } from './ui/controlPanel.js';
import { createSun } from './scene/sun.js';
import { createStarfield } from './scene/starfield.js';
import { createGalaxyBackdrop } from './scene/galaxy.js';
import { createEarth } from './scene/earth.js';
import { createMoon } from './scene/moon.js';
import { createSatellite } from './scene/satellite.js';
import { createRegionLabels, getRegionAtRay, updateRegionLabels } from './scene/regions.js';
import { findCountryNameAtLonLat, loadCountryFeatures } from './scene/countryLookup.js';

let camera, scene, renderer;
let controls;
let earthGroup, earthMesh, cloudsMesh;
let coordinatesOverlayEnabled = false;
let coordinatesMesh;
let geoOverlayGroup;
let ensureGeoOverlayLoaded;
let updateMoon;
let updateSatellite;
let regionsGroup;
let sunGroup;
let keySunLight;
let moonPivotRef;
let satelliteGroupRef;
let moonMeshRef;
let controller1, controller2;
let worldRoot;
let vrInput = { right: null };
let vrWorldScale = 1;
let raycaster;
const isMobileLike = /Mobi|Android|iPhone|iPad|Quest/i.test(navigator.userAgent);
let performanceMode = isMobileLike ? 'vrSmooth' : 'balanced';
let starfield;
const vrZoomConfig = {
  minZ: -6.1,
  maxZ: -4.65,
  speed: 0.72
};
const vrRotateConfig = {
  speed: 1.05,
  deadZone: 0.18
};
const vrRayConfig = {
  idleColor: 0xffffff,
  targetColor: 0x74d8ff,
  idleOpacity: 0.72,
  targetOpacity: 1,
  idleLength: 8,
  targetLength: 10
};
const _tmpControllerMatrix = new THREE.Matrix4();
const _tmpControllerDirection = new THREE.Vector3();
const PERFORMANCE_PRESETS = {
  quality: {
    pixelRatioCap: 1.8,
    starCount: 5200,
    starSize: 0.12,
    starOpacity: 0.95,
    galaxyTextureWidth: 2048,
    galaxyTextureHeight: 1024,
    galaxySegmentsW: 64,
    galaxySegmentsH: 48
  },
  balanced: {
    pixelRatioCap: 1.35,
    starCount: 3600,
    starSize: 0.09,
    starOpacity: 0.93,
    galaxyTextureWidth: 1536,
    galaxyTextureHeight: 768,
    galaxySegmentsW: 52,
    galaxySegmentsH: 36
  },
  vrSmooth: {
    pixelRatioCap: 1.0,
    starCount: 2200,
    starSize: 0.07,
    starOpacity: 0.9,
    galaxyTextureWidth: 1024,
    galaxyTextureHeight: 512,
    galaxySegmentsW: 40,
    galaxySegmentsH: 28
  }
};
const vrDefaultScale = 0.78;
const vrDefaultDistance = -5.2;
const clock = new THREE.Clock();
let galaxyBackdrop;
const GREENWICH_TIMEZONE_ID = 'Etc/UTC';
const TIME_CACHE_TTL_MS = 60 * 1000;
const timeCache = new Map();
let activeRegionTimeRequest = 0;
let cameraTransition = null;
let countryLookupReady = false;

const CITY_TIMEZONE_IDS = {
  'New York': 'America/New_York',
  Toronto: 'America/Toronto',
  'Los Angeles': 'America/Los_Angeles',
  Vancouver: 'America/Vancouver',
  'Mexico City': 'America/Mexico_City',
  Rio: 'America/Sao_Paulo',
  'São Paulo': 'America/Sao_Paulo',
  'Buenos Aires': 'America/Argentina/Buenos_Aires',
  Lima: 'America/Lima',
  'Bogotá': 'America/Bogota',
  Bangkok: 'Asia/Bangkok',
  'Hà Nội': 'Asia/Ho_Chi_Minh',
  Singapore: 'Asia/Singapore',
  Jakarta: 'Asia/Jakarta',
  Manila: 'Asia/Manila',
  'Kuala Lumpur': 'Asia/Kuala_Lumpur',
  Yangon: 'Asia/Yangon',
  'Trung Quốc': 'Asia/Shanghai',
  Shanghai: 'Asia/Shanghai',
  'Hong Kong': 'Asia/Hong_Kong',
  Tokyo: 'Asia/Tokyo',
  Seoul: 'Asia/Seoul',
  'Bắc Kinh': 'Asia/Shanghai',
  Nga: 'Europe/Moscow',
  Moscow: 'Europe/Moscow',
  London: 'Europe/London',
  Paris: 'Europe/Paris',
  Berlin: 'Europe/Berlin',
  Rome: 'Europe/Rome',
  Barcelona: 'Europe/Madrid',
  Cairo: 'Africa/Cairo',
  Lagos: 'Africa/Lagos',
  Johannesburg: 'Africa/Johannesburg',
  'Cape Town': 'Africa/Johannesburg',
  Nairobi: 'Africa/Nairobi',
  Sydney: 'Australia/Sydney',
  Melbourne: 'Australia/Melbourne',
  Brisbane: 'Australia/Brisbane',
  Auckland: 'Pacific/Auckland'
};

init();
animate();

function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = null;
  worldRoot = new THREE.Group();
  scene.add(worldRoot);

  const infoEl = document.getElementById('info');
  if (infoEl) {
    infoEl.innerHTML = [
      'Realistic Earth (Space Scene)',
      'VR tay phải: Thumbstick Y = zoom, Thumbstick X = xoay Trái Đất',
      'Trigger hoặc Grip: chỉ dùng để mở bảng điều khiển'
    ].join('<br>');
  }

  // Camera
  camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 0.38, 4.8);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.012);
  scene.add(ambientLight);

  keySunLight = new THREE.DirectionalLight(0xfff1d2, 4.7);
  keySunLight.position.copy(sunPosition);
  scene.add(keySunLight);

  const sunBloomLight = new THREE.PointLight(0xff9b2f, 2.9, 0, 2);
  sunBloomLight.position.copy(sunPosition);
  scene.add(sunBloomLight);

  const fillLight = new THREE.DirectionalLight(0x89a8d6, 0.04);
  fillLight.position.set(-16, -9, -12);
  scene.add(fillLight);

  const hemisphere = new THREE.HemisphereLight(0x1a2d4a, 0x03060d, 0.03);
  scene.add(hemisphere);

  sunGroup = createSun();
  sunGroup.position.copy(sunPosition);
  worldRoot.add(sunGroup);

  // Earth
  const earth = createEarth({ settings: SETTINGS, sunDirection: sunPosition });
  earthGroup = earth.earthGroup;
  earthMesh = earth.earthMesh;
  cloudsMesh = earth.cloudsMesh;
  coordinatesMesh = earth.coordinatesMesh;
  geoOverlayGroup = earth.geoOverlayGroup;
  ensureGeoOverlayLoaded = earth.ensureGeoOverlayLoaded;
  worldRoot.add(earthGroup);

  // Region labels (attach to earthMesh so they rotate with Earth spin)
  regionsGroup = createRegionLabels({ earthRadius: SETTINGS.earthRadius });
  earthMesh.add(regionsGroup);

  // Moon (child of earthGroup so it follows grabs in VR)
  const moon = createMoon({ earthRadius: SETTINGS.earthRadius });
  earthGroup.add(moon.moonPivot);
  updateMoon = moon.updateMoon;
  moonPivotRef = moon.moonPivot;
  moonMeshRef = moon.moonMesh;

  // Satellite (orbits Earth and continuously faces the planet)
  const satellite = createSatellite({ earthRadius: SETTINGS.earthRadius });
  worldRoot.add(satellite.satelliteGroup);
  updateSatellite = satellite.updateSatellite;
  satelliteGroupRef = satellite.satelliteGroup;

  // Subtle rim light (keep off for stylized/flat by default)
  if (SETTINGS.style === 'realistic' || SETTINGS.style === 'procedural') {
    const rim = new THREE.DirectionalLight(0xf5f8ff, 0.08);
    rim.position.set(-12, 2, -8);
    worldRoot.add(rim);
  }

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, PERFORMANCE_PRESETS[performanceMode].pixelRatioCap));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);
  renderer.setClearColor(0x02030a, 1);

  // Controls (non-VR)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  controls.minDistance = 1.75;
  controls.maxDistance = 90;

  // VR Controllers
  controller1 = renderer.xr.getController(0);
  controller2 = renderer.xr.getController(1);
  scene.add(controller1);
  scene.add(controller2);
  addControllerRay(controller1);
  addControllerRay(controller2);

  controller1.addEventListener('connected', onControllerConnected);
  controller1.addEventListener('disconnected', onControllerDisconnected);
  controller1.addEventListener('selectstart', onControllerSelectStart);
  controller1.addEventListener('selectend', onControllerSelectEnd);
  controller1.addEventListener('squeezestart', onControllerGrabStart);
  controller1.addEventListener('squeezeend', onControllerGrabEnd);
  controller2.addEventListener('connected', onControllerConnected);
  controller2.addEventListener('disconnected', onControllerDisconnected);
  controller2.addEventListener('selectstart', onControllerSelectStart);
  controller2.addEventListener('selectend', onControllerSelectEnd);
  controller2.addEventListener('squeezestart', onControllerGrabStart);
  controller2.addEventListener('squeezeend', onControllerGrabEnd);

  renderer.xr.addEventListener('sessionstart', onXRSessionStart);
  renderer.xr.addEventListener('sessionend', onXRSessionEnd);

  applyPerformanceMode(performanceMode);

  // Start with a slightly reduced world scale for a more panoramic first impression in VR.
  vrWorldScale = vrDefaultScale;
  worldRoot.scale.setScalar(vrWorldScale);

  // VR Button
  document.body.appendChild(VRButton.createButton(renderer, {
    optionalFeatures: ['local-floor']
  }));

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Raycaster for detecting clicks on regions
  raycaster = new THREE.Raycaster();
  document.addEventListener('click', onDocumentClick);
  document.getElementById('closeRegionInfo').addEventListener('click', closeRegionInfo);
  document.getElementById('panelToggle')?.addEventListener('click', () => {
    togglePanelVisibility();
  });

  initControlPanel({
    settings: SETTINGS,
    renderer,
    keySunLight,
    getPerformanceMode: () => performanceMode,
    setPerformanceMode: (nextMode) => applyPerformanceMode(nextMode),
    getStarsEnabled: () => SETTINGS.enableStars,
    setStarsEnabled: (enabled) => {
      SETTINGS.enableStars = enabled;
      rebuildSpaceEnvironment();
    },
    getLabelsEnabled: () => (regionsGroup ? regionsGroup.visible : true),
    setLabelsEnabled: (enabled) => {
      if (regionsGroup) regionsGroup.visible = enabled;
    },
    getCoordinatesMapEnabled: () => coordinatesOverlayEnabled,
    setCoordinatesMapEnabled: (enabled) => {
      coordinatesOverlayEnabled = enabled;
      if (coordinatesMesh) coordinatesMesh.visible = enabled;
      if (enabled && ensureGeoOverlayLoaded) {
        ensureGeoOverlayLoaded().then(() => {
          if (geoOverlayGroup) geoOverlayGroup.visible = coordinatesOverlayEnabled;
        });
      } else if (geoOverlayGroup) {
        geoOverlayGroup.visible = enabled;
      }
    },
    onResetView: () => {
      applyCameraPreset('default');
    },
    onViewSatellite: () => applyCameraPreset('satellite'),
    onViewMoon: () => applyCameraPreset('moon'),
    onViewSun: () => applyCameraPreset('sun')
  });

  if (coordinatesMesh) coordinatesMesh.visible = coordinatesOverlayEnabled;
  syncPanelToggleButton();
  if (geoOverlayGroup) geoOverlayGroup.visible = false;

  loadCountryFeatures(new URL('../assets/geojson/countries.json', import.meta.url))
    .then(() => {
      countryLookupReady = true;
    })
    .catch(() => {
      countryLookupReady = false;
    });
}

function startCameraTransition(targetPosition, targetLookAt, durationSec = 0.9, targetFov = camera?.fov ?? 72) {
  if (!camera || !controls) return;

  cameraTransition = {
    fromPosition: camera.position.clone(),
    toPosition: targetPosition.clone(),
    fromTarget: controls.target.clone(),
    toTarget: targetLookAt.clone(),
    fromFov: camera.fov,
    toFov: targetFov,
    elapsed: 0,
    duration: Math.max(0.01, durationSec)
  };
}

function resetVRWorldTransform() {
  if (!worldRoot) return;

  worldRoot.position.set(0, 0, vrDefaultDistance);
  worldRoot.rotation.set(0, 0, 0);
  vrWorldScale = vrDefaultScale;
  worldRoot.scale.setScalar(vrWorldScale);
}

function onXRSessionStart() {
  resetVRWorldTransform();
  setPanelVisibility(false);
  closeRegionInfo();
  setControllerRayAppearance(controller1, false);
  setControllerRayAppearance(controller2, false);
}

function onXRSessionEnd() {
  setPanelVisibility(true);
  closeRegionInfo();
  vrInput.right = null;
  setControllerRayAppearance(controller1, false);
  setControllerRayAppearance(controller2, false);
}

function isPanelVisible() {
  const panel = document.getElementById('panel');
  return !!panel && !panel.classList.contains('is-hidden');
}

function syncPanelToggleButton() {
  const button = document.getElementById('panelToggle');
  if (!button) return;

  const visible = isPanelVisible();
  button.textContent = visible ? 'Ẩn điều khiển' : 'Hiện điều khiển';
  button.setAttribute('aria-pressed', visible ? 'true' : 'false');
}

function setPanelVisibility(visible) {
  const panel = document.getElementById('panel');
  if (!panel) return;

  panel.classList.toggle('is-hidden', !visible);
  syncPanelToggleButton();
}

function togglePanelVisibility(forceVisible) {
  const visible = typeof forceVisible === 'boolean' ? forceVisible : !isPanelVisible();
  setPanelVisibility(visible);
}

function setControlDistanceRange(minDistance, maxDistance) {
  if (!controls) return;
  controls.minDistance = minDistance;
  controls.maxDistance = maxDistance;
}

function setViewObjectVisibility({ sunVisible = true, moonVisible = true, satelliteVisible = true } = {}) {
  if (sunGroup) sunGroup.visible = sunVisible;
  if (moonPivotRef) moonPivotRef.visible = moonVisible;
  if (satelliteGroupRef) satelliteGroupRef.visible = satelliteVisible;
}

function applyCameraPreset(preset) {
  if (!camera || !controls || renderer.xr.isPresenting) return;

  setViewObjectVisibility({ sunVisible: true, moonVisible: true, satelliteVisible: true });

  worldRoot.rotation.set(0, 0, 0);
  worldRoot.position.set(0, 0, 0);
  vrWorldScale = vrDefaultScale;
  worldRoot.scale.setScalar(vrWorldScale);

  scene.updateMatrixWorld(true);

  const earthCenter = new THREE.Vector3(0, 0, 0);
  const r = SETTINGS.earthRadius;

  if (preset === 'default') {
    setControlDistanceRange(1.75, 24);
    startCameraTransition(new THREE.Vector3(0, 0.38, 4.8), earthCenter, 0.75, 72);
    return;
  }

  if (preset === 'satellite') {
    setViewObjectVisibility({ sunVisible: true, moonVisible: true, satelliteVisible: false });
    setControlDistanceRange(1.3, 8);
    // Approximate low-earth-orbit view: ~6-8% Earth radius above surface.
    const orbitAltitude = r * 0.18;
    const distanceFromCenter = r + orbitAltitude;
    const direction = new THREE.Vector3(0.88, 0.2, 0.43).normalize();
    const satellitePos = direction.multiplyScalar(distanceFromCenter);
    startCameraTransition(satellitePos, earthCenter, 0.95, 66);
    return;
  }

  if (preset === 'moon' && moonMeshRef) {
    setViewObjectVisibility({ sunVisible: true, moonVisible: false, satelliteVisible: true });
    setControlDistanceRange(3.2, 18);
    const moonWorld = new THREE.Vector3();
    moonMeshRef.getWorldPosition(moonWorld);

    const moonDirection = moonWorld.clone().normalize();
    // Place observer on near side of the moon body, facing Earth.
    const moonObserverPos = moonWorld.clone().sub(moonDirection.multiplyScalar(r * 0.27));

    startCameraTransition(moonObserverPos, earthCenter, 1.05, 56);
    return;
  }

  if (preset === 'sun') {
    setViewObjectVisibility({ sunVisible: false, moonVisible: true, satelliteVisible: true });
    setControlDistanceRange(20, 150);
    // Offset sideways so the sun disc does not sit directly in the center of the frame.
    const sunDir = sunPosition.clone().normalize();
    const sideAxis = Math.abs(sunDir.y) > 0.85 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const sideOffset = new THREE.Vector3().crossVectors(sunDir, sideAxis).normalize().multiplyScalar(18);

    // Keep far enough so Earth appears much smaller than moon/satellite views.
    const sunObserverPos = sunDir.multiplyScalar(60).add(sideOffset);
    startCameraTransition(sunObserverPos, earthCenter, 1.1, 26);
  }
}

function updateCameraTransition(deltaSeconds) {
  if (!cameraTransition || !camera || !controls) return;

  cameraTransition.elapsed += deltaSeconds;
  const t = Math.min(cameraTransition.elapsed / cameraTransition.duration, 1);
  const eased = 1 - Math.pow(1 - t, 3);

  camera.position.lerpVectors(cameraTransition.fromPosition, cameraTransition.toPosition, eased);
  controls.target.lerpVectors(cameraTransition.fromTarget, cameraTransition.toTarget, eased);
  camera.fov = THREE.MathUtils.lerp(cameraTransition.fromFov, cameraTransition.toFov, eased);
  camera.updateProjectionMatrix();

  if (t >= 1) {
    cameraTransition = null;
  }
}

function disposeObject3D(object) {
  if (!object) return;
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      } else {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    }
  });
}

function rebuildSpaceEnvironment() {
  const preset = PERFORMANCE_PRESETS[performanceMode] || PERFORMANCE_PRESETS.balanced;

  if (galaxyBackdrop) {
    worldRoot.remove(galaxyBackdrop);
    disposeObject3D(galaxyBackdrop);
  }

  galaxyBackdrop = createGalaxyBackdrop({
    sunPosition,
    seed: 2026,
    textureWidth: preset.galaxyTextureWidth,
    textureHeight: preset.galaxyTextureHeight,
    widthSegments: preset.galaxySegmentsW,
    heightSegments: preset.galaxySegmentsH
  });
  worldRoot.add(galaxyBackdrop);

  if (starfield) {
    worldRoot.remove(starfield);
    disposeObject3D(starfield);
    starfield = null;
  }

  if (SETTINGS.enableStars) {
    starfield = createStarfield({
      starCount: preset.starCount,
      size: preset.starSize,
      opacity: preset.starOpacity
    });
    worldRoot.add(starfield);
  }

  if (coordinatesMesh) {
    coordinatesMesh.visible = coordinatesOverlayEnabled;
  }
  if (geoOverlayGroup) {
    geoOverlayGroup.visible = coordinatesOverlayEnabled;
  }
}

function applyPerformanceMode(nextMode) {
  if (!PERFORMANCE_PRESETS[nextMode]) return;
  performanceMode = nextMode;
  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, PERFORMANCE_PRESETS[performanceMode].pixelRatioCap));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  rebuildSpaceEnvironment();
}

function onControllerConnected(event) {
  event.target.userData.inputSource = event.data;
  event.target.userData.handedness = event.data?.handedness || '';
}

function onControllerDisconnected(event) {
  const controller = event.target;
  controller.userData.inputSource = null;
  controller.userData.handedness = '';
  vrInput.right = null;
  setControllerRayAppearance(controller, false);
}

function onControllerGrabStart(event) {
  void event;
  if (!renderer.xr.isPresenting) return;

  closeRegionInfo();
  setPanelVisibility(true);
}

function onControllerGrabEnd(event) {
  void event;
}

function addControllerRay(controller) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1)
  ]);
  const material = new THREE.LineBasicMaterial({
    color: vrRayConfig.idleColor,
    transparent: true,
    opacity: vrRayConfig.idleOpacity
  });
  const ray = new THREE.Line(geometry, material);
  ray.name = 'controllerRay';
  ray.scale.z = vrRayConfig.idleLength;
  controller.add(ray);
}

function onControllerSelectStart(event) {
  if (!renderer.xr.isPresenting) return;

  const controller = event.target;
  controller.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);
  const region = getSelectableRegionFromController(controller);

  if (region) {
    setPanelVisibility(false);
    showRegionInfo(region, null);
    return;
  }

  closeRegionInfo();
}

function onControllerSelectEnd(event) {
  void event;
}

function getRightController() {
  const rightController =
    controller1?.userData?.handedness === 'right'
      ? controller1
      : controller2?.userData?.handedness === 'right'
      ? controller2
      : controller2;

  return rightController;
}

function extractPrimaryAxes(inputSource) {
  const gamepad = inputSource?.gamepad;
  if (!gamepad || !gamepad.axes || gamepad.axes.length === 0) {
    return null;
  }

  if (gamepad.axes.length >= 4) {
    const pair0 = Math.abs(gamepad.axes[0]) + Math.abs(gamepad.axes[1]);
    const pair1 = Math.abs(gamepad.axes[2]) + Math.abs(gamepad.axes[3]);
    if (pair1 > pair0) {
      return { x: gamepad.axes[2], y: gamepad.axes[3] };
    }
  }

  return { x: gamepad.axes[0] || 0, y: gamepad.axes[1] || 0 };
}

function applyDeadZone(value, deadZone) {
  if (Math.abs(value) < deadZone) return 0;
  const sign = Math.sign(value);
  const normalized = (Math.abs(value) - deadZone) / (1 - deadZone);
  return sign * normalized;
}

function updateVRInputSources() {
  const rightController = getRightController();
  vrInput.right = extractPrimaryAxes(rightController?.userData?.inputSource);
}

function getSelectableRegionFromController(controller) {
  if (!controller || !regionsGroup) return null;

  setRaycasterFromController(controller);
  const region = getRegionAtRay(raycaster, regionsGroup);
  if (!region || region.isRegion) return null;

  return region;
}

function setRaycasterFromController(controller) {
  if (!controller || !raycaster) return;

  if (typeof raycaster.setFromXRController === 'function') {
    raycaster.setFromXRController(controller);
    return;
  }

  _tmpControllerMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  _tmpControllerDirection.set(0, 0, -1).applyMatrix4(_tmpControllerMatrix);
  raycaster.ray.direction.copy(_tmpControllerDirection.normalize());
}

function setControllerRayAppearance(controller, isTargetingRegion) {
  const ray = controller?.getObjectByName?.('controllerRay');
  const material = ray?.material;
  if (!ray || !material) return;

  material.color.setHex(isTargetingRegion ? vrRayConfig.targetColor : vrRayConfig.idleColor);
  material.opacity = isTargetingRegion ? vrRayConfig.targetOpacity : vrRayConfig.idleOpacity;
  ray.scale.z = isTargetingRegion ? vrRayConfig.targetLength : vrRayConfig.idleLength;
}

function updateVRMovement(deltaSeconds) {
  if (!renderer.xr.isPresenting || !worldRoot) return;

  if (isPanelVisible()) {
    vrInput.right = null;
    return;
  }

  updateVRInputSources();
  const zoomAxes = vrInput.right;

  if (zoomAxes) {
    const zoomY = applyDeadZone(zoomAxes.y, vrRotateConfig.deadZone);
    const rotateX = applyDeadZone(zoomAxes.x, vrRotateConfig.deadZone);

    if (zoomY !== 0) {
      closeRegionInfo();
      worldRoot.position.z -= zoomY * vrZoomConfig.speed * deltaSeconds;
      worldRoot.position.z = THREE.MathUtils.clamp(worldRoot.position.z, vrZoomConfig.minZ, vrZoomConfig.maxZ);
    }

    if (rotateX !== 0) {
      closeRegionInfo();
      worldRoot.rotation.y -= rotateX * vrRotateConfig.speed * deltaSeconds;
    }
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onDocumentClick(event) {
  // Skip if mouse is over UI elements
  if (
    event.target.closest('#panel') ||
    event.target.closest('#panelToggle') ||
    event.target.closest('#regionInfo') !== null
  ) {
    return;
  }

  // Calculate mouse position in normalized device coordinates
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );

  // Update raycaster
  raycaster.setFromCamera(mouse, camera);

  // Check for intersection with regions group
  const intersects = raycaster.intersectObject(regionsGroup, true);
  
  if (intersects.length > 0) {
    let foundRegion = null;
    
    // Find both label and marker, prefer label
    for (let i = 0; i < intersects.length; i++) {
      const obj = intersects[i].object;
      if (obj.userData?.name && !obj.userData?.isRegion) {
        if (obj.userData.type === 'label') {
          foundRegion = obj.userData;
          break; // Found label, use it
        } else if (obj.userData.type === 'marker' && !foundRegion) {
          foundRegion = obj.userData;
        }
      }
    }

    if (foundRegion) {
      showRegionInfo(foundRegion, {
        x: event.clientX,
        y: event.clientY
      });
      return;
    }
  }

  const earthHits = raycaster.intersectObject(earthMesh, false);
  if (earthHits.length > 0) {
    showEarthSurfaceInfo(earthHits[0].point, {
      x: event.clientX,
      y: event.clientY
    });
    return;
  }

  closeRegionInfo();
}

function normalizeLongitude(lon) {
  let normalized = lon;

  while (normalized <= -180) normalized += 360;
  while (normalized > 180) normalized -= 360;

  return normalized;
}

function formatUtcOffset(hours) {
  const roundedHours = Math.round(hours * 2) / 2;
  const sign = roundedHours >= 0 ? '+' : '-';
  const absoluteHours = Math.abs(roundedHours);
  const wholeHours = Math.floor(absoluteHours);
  const minutes = Math.round((absoluteHours - wholeHours) * 60);

  if (minutes === 0) {
    return `UTC${sign}${wholeHours}`;
  }

  return `UTC${sign}${wholeHours}:${String(minutes).padStart(2, '0')}`;
}

function getUtcClockText(date = new Date()) {
  return date.toUTCString().slice(17, 25);
}

function getEstimatedSurfaceTime(lon) {
  const utcMs = Date.now();
  const offsetHours = lon / 15;
  const localMs = utcMs + offsetHours * 3600 * 1000;

  return {
    utcTime: getUtcClockText(new Date(utcMs)),
    localTime: getUtcClockText(new Date(localMs)),
    timezone: formatUtcOffset(offsetHours)
  };
}

function resolveTimeZoneId(region) {
  return CITY_TIMEZONE_IDS[region.name] || null;
}

function formatTimeFromApiResponse(data) {
  if (!data) return null;

  if (data.time) {
    return data.time;
  }

  if (data.dateTime) {
    const parsed = new Date(data.dateTime);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    }
  }

  return null;
}

async function fetchCurrentTimeByZone(timeZoneId) {
  const now = Date.now();
  const cached = timeCache.get(timeZoneId);
  if (cached && now - cached.timestamp < TIME_CACHE_TTL_MS) {
    return cached.value;
  }

  const url = `https://timeapi.io/api/Time/current/zone?timeZone=${encodeURIComponent(timeZoneId)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Time API error: ${response.status}`);
  }

  const payload = await response.json();
  const timeText = formatTimeFromApiResponse(payload);
  if (!timeText) {
    throw new Error('Invalid time payload');
  }

  const value = {
    time: timeText,
    date: payload.date || ''
  };

  timeCache.set(timeZoneId, {
    timestamp: now,
    value
  });

  return value;
}

async function updateRegionTimes(region, requestId) {
  const cityTimeEl = document.getElementById('regionCurrentTime');
  const utcTimeEl = document.getElementById('regionUtcTime');
  const timezoneEl = document.getElementById('regionTimezone');
  const timeZoneId = resolveTimeZoneId(region);

  if (!timeZoneId) {
    cityTimeEl.textContent = 'Không có dữ liệu';
    utcTimeEl.textContent = 'Không có dữ liệu';
    return;
  }

  timezoneEl.textContent = `${region.timezone || 'N/A'} (${timeZoneId})`;
  cityTimeEl.textContent = 'Đang tải...';
  utcTimeEl.textContent = 'Đang tải...';

  try {
    const [cityTimeData, utcTimeData] = await Promise.all([
      fetchCurrentTimeByZone(timeZoneId),
      fetchCurrentTimeByZone(GREENWICH_TIMEZONE_ID)
    ]);

    if (requestId !== activeRegionTimeRequest) return;

    cityTimeEl.textContent = cityTimeData.time;
    utcTimeEl.textContent = utcTimeData.time;
  } catch (error) {
    if (requestId !== activeRegionTimeRequest) return;
    cityTimeEl.textContent = 'Lỗi tải giờ';
    utcTimeEl.textContent = 'Lỗi tải giờ';
  }
}

function showRegionInfo(region, clickPoint) {
  const countryRow = document.getElementById('regionCountryRow');
  countryRow.hidden = true;

  showLocationInfo({
    title: region.name,
    lat: region.lat,
    lon: region.lon,
    timezone: region.timezone || 'N/A'
  }, clickPoint);

  activeRegionTimeRequest += 1;
  const currentRequestId = activeRegionTimeRequest;
  updateRegionTimes(region, currentRequestId);
  return;

  const panel = document.getElementById('regionInfo');
  document.getElementById('regionName').textContent = region.name;
  document.getElementById('regionLat').textContent = `${region.lat.toFixed(2)}°`;
  document.getElementById('regionLon').textContent = `${region.lon.toFixed(2)}°`;
  document.getElementById('regionTimezone').textContent = region.timezone || 'N/A';

  // Anchor panel to click point: always prioritize right side and stay near city label.
  const panelWidth = 320;
  const panelHeight = 160;
  const margin = 10;
  const offsetRight = 14;

  const baseX = clickPoint?.x ?? (renderer?.xr?.isPresenting ? window.innerWidth - panelWidth - 24 : window.innerWidth * 0.5);
  const baseY = clickPoint?.y ?? (renderer?.xr?.isPresenting ? 112 : window.innerHeight * 0.5);

  let finalX = baseX + offsetRight;
  let finalY = baseY - panelHeight * 0.5;

  // Keep right placement whenever possible; if impossible, pin to right viewport boundary.
  if (finalX + panelWidth > window.innerWidth - margin) {
    finalX = window.innerWidth - panelWidth - margin;
  }

  if (finalY < margin) {
    finalY = margin;
  }
  if (finalY + panelHeight > window.innerHeight - margin) {
    finalY = window.innerHeight - panelHeight - margin;
  }

  panel.style.left = `${Math.max(margin, finalX)}px`;
  panel.style.top = `${finalY}px`;
  
  panel.classList.remove('hidden');

  activeRegionTimeRequest += 1;
  const requestId = activeRegionTimeRequest;
  updateRegionTimes(region, requestId);
}

function showEarthSurfaceInfo(worldPoint, clickPoint) {
  const localPoint = earthMesh.worldToLocal(worldPoint.clone());
  const radius = localPoint.length() || 1;
  const lat = THREE.MathUtils.radToDeg(Math.asin(localPoint.y / radius));
  const lon = normalizeLongitude(THREE.MathUtils.radToDeg(Math.atan2(-localPoint.z, localPoint.x)));
  const countryName = countryLookupReady
    ? (findCountryNameAtLonLat(lon, lat) || 'Ocean / unknown')
    : 'Country data unavailable';
  const estimatedTime = getEstimatedSurfaceTime(lon);
  const countryRow = document.getElementById('regionCountryRow');
  const countryValue = document.getElementById('regionCountry');

  countryValue.textContent = countryName;
  countryRow.hidden = false;

  showLocationInfo({
    title: 'Surface point on Earth',
    lat,
    lon,
    timezone: estimatedTime.timezone,
    currentTime: estimatedTime.localTime,
    utcTime: estimatedTime.utcTime
  }, clickPoint);
}

function showLocationInfo(location, clickPoint) {
  const panel = document.getElementById('regionInfo');
  document.getElementById('regionName').textContent = location.title;
  document.getElementById('regionLat').textContent = `${location.lat.toFixed(2)}°`;
  document.getElementById('regionLon').textContent = `${location.lon.toFixed(2)}°`;
  document.getElementById('regionTimezone').textContent = location.timezone || 'N/A';
  document.getElementById('regionCurrentTime').textContent = location.currentTime || '--:--:--';
  document.getElementById('regionUtcTime').textContent = location.utcTime || '--:--:--';

  const panelWidth = 320;
  const panelHeight = 160;
  const margin = 10;
  const offsetRight = 14;

  const baseX = clickPoint?.x ?? window.innerWidth * 0.5;
  const baseY = clickPoint?.y ?? window.innerHeight * 0.5;

  let finalX = baseX + offsetRight;
  let finalY = baseY - panelHeight * 0.5;

  if (finalX + panelWidth > window.innerWidth - margin) {
    finalX = window.innerWidth - panelWidth - margin;
  }

  if (finalY < margin) {
    finalY = margin;
  }
  if (finalY + panelHeight > window.innerHeight - margin) {
    finalY = window.innerHeight - panelHeight - margin;
  }

  panel.style.left = `${Math.max(margin, finalX)}px`;
  panel.style.top = `${finalY}px`;
  panel.classList.remove('hidden');
}

function closeRegionInfo() {
  const panel = document.getElementById('regionInfo');
  if (panel) panel.classList.add('hidden');
  activeRegionTimeRequest += 1;
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render() {
  const deltaSeconds = clock.getDelta();

  // Spin Earth around its axis
  earthMesh.rotation.y += SETTINGS.earthSpin;
  if (cloudsMesh && cloudsMesh.visible) cloudsMesh.rotation.y += SETTINGS.cloudsSpin;
  if (updateMoon) updateMoon();
  if (updateSatellite) updateSatellite();

  // Enable/disable OrbitControls depending on XR and map mode
  const presenting = renderer.xr.isPresenting;
  if (controls) {
    controls.enabled = !presenting;
    if (!presenting) controls.update();
  }

  if (presenting) {
    updateVRMovement(deltaSeconds);
  }

  if (!presenting) {
    updateCameraTransition(deltaSeconds);
  }

  // Update region labels to face camera
  if (regionsGroup && renderer.xr.isPresenting) {
    updateRegionLabels(regionsGroup, renderer.xr.getCamera(camera));
  }

  renderer.render(scene, camera);
}
