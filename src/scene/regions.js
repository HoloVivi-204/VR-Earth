import * as THREE from 'three';

// Geographic regions calibrated for the current Earth texture orientation.
export const REGIONS = [
  // North America
  { name: 'Bắc Mỹ', lat: 44, lon: -102, color: 0x5dade2, labelScale: 0.34, isRegion: true },
  { name: 'New York', lat: 40.71, lon: -74.0, color: 0x7fb3d5, labelScale: 0.24, timezone: 'UTC-5' },
  { name: 'Toronto', lat: 43.65, lon: -79.38, color: 0x7fb3d5, labelScale: 0.21, timezone: 'UTC-5' },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24, color: 0x7fb3d5, labelScale: 0.23, timezone: 'UTC-8' },
  { name: 'Vancouver', lat: 49.28, lon: -123.12, color: 0x7fb3d5, labelScale: 0.21, timezone: 'UTC-8' },
  { name: 'Mexico City', lat: 19.43, lon: -99.13, color: 0x7fb3d5, labelScale: 0.22, timezone: 'UTC-6' },

  // South America
  { name: 'Nam Mỹ', lat: -15, lon: -60, color: 0xf8b739, labelScale: 0.34, isRegion: true },
  { name: 'Rio', lat: -22.91, lon: -43.17, color: 0xf9ca7a, labelScale: 0.22, timezone: 'UTC-3' },
  { name: 'São Paulo', lat: -23.55, lon: -46.63, color: 0xf9ca7a, labelScale: 0.21, timezone: 'UTC-3' },
  { name: 'Buenos Aires', lat: -34.6, lon: -58.38, color: 0xf9ca7a, labelScale: 0.22, timezone: 'UTC-3' },
  { name: 'Lima', lat: -12.05, lon: -77.04, color: 0xf9ca7a, labelScale: 0.21, timezone: 'UTC-5' },
  { name: 'Bogotá', lat: 4.71, lon: -74.07, color: 0xf9ca7a, labelScale: 0.21, timezone: 'UTC-5' },

  // Southeast / East Asia
  { name: 'Bangkok', lat: 13.75, lon: 100.5, color: 0xff8a80, labelScale: 0.21, timezone: 'UTC+7' },
  { name: 'Hà Nội', lat: 21.03, lon: 105.85, color: 0xff3b30, labelScale: 0.21, timezone: 'UTC+7' },
  { name: 'Singapore', lat: 1.35, lon: 103.82, color: 0xff8a80, labelScale: 0.21, timezone: 'UTC+8' },
  { name: 'Jakarta', lat: -6.21, lon: 106.85, color: 0xff8a80, labelScale: 0.21, timezone: 'UTC+7' },
  { name: 'Manila', lat: 14.6, lon: 120.97, color: 0xff8a80, labelScale: 0.21, timezone: 'UTC+8' },
  { name: 'Kuala Lumpur', lat: 3.14, lon: 101.69, color: 0xff8a80, labelScale: 0.20, timezone: 'UTC+8' },
  { name: 'Yangon', lat: 16.87, lon: 96.20, color: 0xff8a80, labelScale: 0.21, timezone: 'UTC+6:30' },
  { name: 'Trung Quốc', lat: 35, lon: 105, color: 0xc4b4ea, labelScale: 0.28, timezone: 'UTC+8' },
  { name: 'Shanghai', lat: 31.23, lon: 121.47, color: 0xc4b4ea, labelScale: 0.21, timezone: 'UTC+8' },
  { name: 'Hong Kong', lat: 22.30, lon: 114.19, color: 0xc4b4ea, labelScale: 0.21, timezone: 'UTC+8' },
  { name: 'Tokyo', lat: 35.67, lon: 139.65, color: 0xc4b4ea, labelScale: 0.21, timezone: 'UTC+9' },
  { name: 'Seoul', lat: 37.57, lon: 126.98, color: 0xc4b4ea, labelScale: 0.21, timezone: 'UTC+9' },
  { name: 'Bắc Kinh', lat: 39.9, lon: 116.4, color: 0xc4b4ea, labelScale: 0.21, timezone: 'UTC+8' },

  // Russia & Europe
  { name: 'Nga', lat: 60, lon: 100, color: 0xb19cd9, labelScale: 0.30, timezone: 'UTC+3' },
  { name: 'Moscow', lat: 55.75, lon: 37.62, color: 0xb19cd9, labelScale: 0.21, timezone: 'UTC+3' },
  { name: 'Châu Âu', lat: 50, lon: 15, color: 0xaf7ac5, labelScale: 0.30, isRegion: true },
  { name: 'London', lat: 51.51, lon: -0.13, color: 0xc39bd3, labelScale: 0.21, timezone: 'UTC+0' },
  { name: 'Paris', lat: 48.86, lon: 2.35, color: 0xc39bd3, labelScale: 0.21, timezone: 'UTC+1' },
  { name: 'Berlin', lat: 52.52, lon: 13.40, color: 0xc39bd3, labelScale: 0.21, timezone: 'UTC+1' },
  { name: 'Rome', lat: 41.9, lon: 12.49, color: 0xc39bd3, labelScale: 0.21, timezone: 'UTC+1' },
  { name: 'Barcelona', lat: 41.39, lon: 2.17, color: 0xc39bd3, labelScale: 0.20, timezone: 'UTC+1' },

  // Africa
  { name: 'Châu Phi', lat: 5, lon: 20, color: 0x76d7c4, labelScale: 0.31, isRegion: true },
  { name: 'Cairo', lat: 30.04, lon: 31.24, color: 0xa3e4d7, labelScale: 0.21, timezone: 'UTC+2' },
  { name: 'Lagos', lat: 6.52, lon: 3.37, color: 0xa3e4d7, labelScale: 0.21, timezone: 'UTC+1' },
  { name: 'Johannesburg', lat: -26.20, lon: 28.04, color: 0xa3e4d7, labelScale: 0.20, timezone: 'UTC+2' },
  { name: 'Cape Town', lat: -33.92, lon: 18.42, color: 0xa3e4d7, labelScale: 0.21, timezone: 'UTC+2' },
  { name: 'Nairobi', lat: -1.29, lon: 36.82, color: 0xa3e4d7, labelScale: 0.21, timezone: 'UTC+3' },

  // Oceania
  { name: 'Australia', lat: -25, lon: 134, color: 0xfed8b1, labelScale: 0.31, isRegion: true },
  { name: 'Sydney', lat: -33.86, lon: 151.21, color: 0xffe1c6, labelScale: 0.21, timezone: 'UTC+10' },
  { name: 'Melbourne', lat: -37.81, lon: 144.96, color: 0xffe1c6, labelScale: 0.20, timezone: 'UTC+10' },
  { name: 'Brisbane', lat: -27.47, lon: 153.03, color: 0xffe1c6, labelScale: 0.20, timezone: 'UTC+10' },
  { name: 'Auckland', lat: -36.85, lon: 174.76, color: 0xffe1c6, labelScale: 0.21, timezone: 'UTC+12' }
];

const MAP_LONGITUDE_OFFSET_DEG = 0;
const MAP_LONGITUDE_DIRECTION = -1;
const markerGeometry = new THREE.SphereGeometry(0.012, 8, 8);
const hitGeometry = new THREE.SphereGeometry(0.07, 8, 8);
const markerMaterialCache = new Map();
const hitMaterialCache = new Map();
const labelTextureCache = new Map();

function getMarkerMaterial(color) {
  if (!markerMaterialCache.has(color)) {
    markerMaterialCache.set(color, new THREE.MeshBasicMaterial({ color, fog: false }));
  }
  return markerMaterialCache.get(color);
}

function getHitMaterial(color) {
  if (!hitMaterialCache.has(color)) {
    hitMaterialCache.set(color, new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.02,
      depthWrite: false,
      fog: false
    }));
  }
  return hitMaterialCache.get(color);
}

export function createRegionLabels({ earthRadius = 1.2 } = {}) {
  const regionsGroup = new THREE.Group();
  regionsGroup.name = 'regions';

  // Keep markers/labels close to surface so they look pinned to land.
  const markerRadius = earthRadius * 1.001;
  const labelOffsetRatio = 1.045;
  const labelRadius = earthRadius * labelOffsetRatio;

  REGIONS.forEach((region) => {
    const surfacePos = latLonToCartesian(region.lat, region.lon, markerRadius);
    const labelPos = latLonToCartesian(region.lat, region.lon, labelRadius);

    // Only create markers for cities, not for large regions
    if (!region.isRegion) {
      const marker = new THREE.Mesh(markerGeometry, getMarkerMaterial(region.color));
      marker.position.copy(surfacePos);
      marker.name = 'marker';
      regionsGroup.add(marker);

      marker.userData = { 
        ...region, 
        position: surfacePos, 
        type: 'marker'
      };

      // Add a larger transparent collider so VR controller raycasts are easier to hit.
      const hitTarget = new THREE.Mesh(hitGeometry, getHitMaterial(region.color));
      hitTarget.position.copy(labelPos);
      hitTarget.name = 'hitTarget';
      hitTarget.userData = {
        ...region,
        position: labelPos,
        type: 'hitTarget'
      };
      regionsGroup.add(hitTarget);
    }

    const labelSprite = createSimpleTextLabel(region.name, region.color);
    labelSprite.position.copy(labelPos);
    labelSprite.scale.set(region.labelScale, region.labelScale * 0.24, 1);
    labelSprite.userData = { ...region, position: labelPos, type: 'label' };
    regionsGroup.add(labelSprite);
  });

  return regionsGroup;
}

function latLonToCartesian(lat, lon, radius) {
  const latRad = THREE.MathUtils.degToRad(lat);
  const adjustedLon = (lon + MAP_LONGITUDE_OFFSET_DEG) * MAP_LONGITUDE_DIRECTION;
  const lonRad = THREE.MathUtils.degToRad(adjustedLon);

  const cosLat = Math.cos(latRad);

  const x = radius * cosLat * Math.cos(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * cosLat * Math.sin(lonRad);

  return new THREE.Vector3(x, y, z);
}

function createSimpleTextLabel(text, color) {
  const cacheKey = `${text}:${color}`;
  let texture = labelTextureCache.get(cacheKey);

  if (!texture) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      const fallbackMaterial = new THREE.SpriteMaterial({ color });
      return new THREE.Sprite(fallbackMaterial);
    }

    const textColor = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.font = 'bold 52px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.lineWidth = 10;
    ctx.strokeText(text, 256, 64);
    ctx.fillStyle = textColor;
    ctx.fillText(text, 256, 64);

    texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    labelTextureCache.set(cacheKey, texture);
  }

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: false
  });

  return new THREE.Sprite(material);
}

// Sprites auto-face camera, so no per-frame rotation is needed.
export function updateRegionLabels(regionsGroup, camera) {
  void regionsGroup;
  void camera;
}

// Get region info when clicking/raycasting
export function getRegionAtRay(raycaster, regionsGroup) {
  if (!regionsGroup) return null;

  const intersects = raycaster.intersectObject(regionsGroup, true);
  
  if (intersects.length > 0) {
    // Only return city/capital markers or labels, not large region labels.
    for (let i = 0; i < intersects.length; i++) {
      const region = intersects[i].object.userData;
      if (region?.name && !region.isRegion) {
        return region;
      }
    }
  }

  return null;
}
