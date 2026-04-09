import * as THREE from 'three';
import { createGeoOverlayGroup } from './geoOverlays.js';

const isMobileLike = /Mobi|Android|iPhone|iPad|Quest/i.test(navigator.userAgent);
const DAY_TEXTURE_MAX_SIZE = isMobileLike ? 2048 : 4096;
const AUX_TEXTURE_MAX_SIZE = isMobileLike ? 1024 : 2048;

export function createEarth({ settings, sunDirection = new THREE.Vector3(30, 0.5, -6) }) {
  // Earth group
  const earthGroup = new THREE.Group();

  const widthSegments = isMobileLike ? 96 : 128;
  const heightSegments = isMobileLike ? 72 : 96;
  const earthGeometry = new THREE.SphereGeometry(settings.earthRadius, widthSegments, heightSegments);
  const earthMesh = new THREE.Mesh(earthGeometry, createEarthMaterialForStyle(settings));
  earthGroup.add(earthMesh);

  const cityLightsLayer = createCityLightsLayer({
    earthRadius: settings.earthRadius,
    sunDirection: sunDirection.clone().normalize(),
    nightTexture: null
  });
  earthMesh.add(cityLightsLayer.mesh);

  const coordinatesLayer = createCoordinatesLayer({ earthRadius: settings.earthRadius });
  earthMesh.add(coordinatesLayer.mesh);

  const geoOverlayGroup = new THREE.Group();
  geoOverlayGroup.name = 'geo-overlays';
  geoOverlayGroup.visible = false;
  earthMesh.add(geoOverlayGroup);
  let geoOverlayLoadPromise = null;

  // Optional realism textures (if present / reachable)
  if (settings.enableRealTextures && settings.style === 'realistic') {
    loadEarthTextures(settings.textures)
      .then((maps) => {
        if (!maps.day) return;
        earthMesh.material.dispose();
        earthMesh.material = createRealEarthMaterial(maps);
        cityLightsLayer.setNightTexture(maps.night ?? null);
      })
      .catch(() => {
        // keep current
      });
  }

  // Clouds layer (optional)
  const cloudsGeometry = new THREE.SphereGeometry(settings.earthRadius * 1.012, widthSegments, heightSegments);
  const cloudsMaterial = new THREE.MeshLambertMaterial({
    color: 0xc3cdd8,
    transparent: true,
    opacity: 0.52,
    alphaTest: 0.22,
    depthWrite: false,
    side: THREE.FrontSide
  });
  const cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
  earthGroup.add(cloudsMesh);
  cloudsMesh.visible = settings.showClouds;

  if (settings.enableRealTextures && settings.showClouds) {
    loadTexture(settings.textures.clouds)
      .then((tex) => {
        tex.colorSpace = THREE.NoColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.anisotropy = 8;
        cloudsMesh.material.map = null;
        cloudsMesh.material.alphaMap = tex;
        cloudsMesh.material.needsUpdate = true;
      })
      .catch(() => {
        // Reduce fallback cloud opacity so night lights remain visible.
        cloudsMesh.material.opacity = 0.2;
      });
  }

  // Atmosphere (simple Fresnel rim)
  const atmosphereMesh = createAtmosphereMesh(settings.earthRadius);
  earthGroup.add(atmosphereMesh);
  atmosphereMesh.visible = settings.showAtmosphere;

  // Axis (visual guide)
  const axisGeometry = new THREE.CylinderGeometry(0.015, 0.015, 3.2, 24);
  const axisMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
  const axisMesh = new THREE.Mesh(axisGeometry, axisMaterial);
  earthGroup.add(axisMesh);
  axisMesh.visible = settings.showAxis;

  // Earth's axial tilt
  earthGroup.rotation.z = THREE.MathUtils.degToRad(settings.axialTiltDeg);

  // Keep Earth centered for space view
  earthGroup.position.y = 0;

  return {
    earthGroup,
    earthMesh,
    cloudsMesh,
    atmosphereMesh,
    axisMesh,
    cityLightsMesh: cityLightsLayer.mesh,
    coordinatesMesh: coordinatesLayer.mesh,
    geoOverlayGroup,
    ensureGeoOverlayLoaded() {
      if (geoOverlayGroup.children.length > 0) {
        return Promise.resolve(geoOverlayGroup);
      }

      if (!geoOverlayLoadPromise) {
        geoOverlayLoadPromise = createGeoOverlayGroup({
          earthRadius: settings.earthRadius,
          countriesUrl: new URL('../../assets/geojson/countries.json', import.meta.url),
          graticulesUrl: new URL('../../assets/geojson/ne_110m_graticules_5.json', import.meta.url)
        })
          .then((group) => {
            geoOverlayGroup.add(...group.children);
            return geoOverlayGroup;
          })
          .catch(() => geoOverlayGroup);
      }

      return geoOverlayLoadPromise;
    }
  };
}

function createCoordinatesLayer({ earthRadius }) {
  const tex = createCoordinatesTexture({ width: isMobileLike ? 1024 : 2048, height: isMobileLike ? 512 : 1024 });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;

  const geometry = new THREE.SphereGeometry(earthRadius * 1.016, isMobileLike ? 128 : 192, isMobileLike ? 96 : 140);
  const material = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.96,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.renderOrder = 10;

  return { mesh };
}

function createCoordinatesTexture({ width, height }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = 'round';

  for (let lat = -80; lat <= 80; lat += 10) {
    const y = ((90 - lat) / 180) * height;
    const major = lat % 30 === 0;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.lineWidth = major ? 2.2 : 1.1;
    ctx.strokeStyle = major ? 'rgba(188, 226, 255, 0.7)' : 'rgba(166, 206, 236, 0.38)';
    ctx.stroke();
  }

  for (let lon = -180; lon <= 180; lon += 10) {
    const x = ((lon + 180) / 360) * width;
    const major = lon % 30 === 0;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.lineWidth = major ? 2.2 : 1.1;
    ctx.strokeStyle = major ? 'rgba(188, 226, 255, 0.7)' : 'rgba(166, 206, 236, 0.38)';
    ctx.stroke();
  }

  // Prime meridian and equator for clear orientation.
  const primeMeridianX = width * 0.5;
  ctx.beginPath();
  ctx.moveTo(primeMeridianX, 0);
  ctx.lineTo(primeMeridianX, height);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 219, 89, 0.92)';
  ctx.stroke();

  const equatorY = height * 0.5;
  ctx.beginPath();
  ctx.moveTo(0, equatorY);
  ctx.lineTo(width, equatorY);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 117, 117, 0.92)';
  ctx.stroke();

  ctx.font = '600 34px Sora, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 117, 117, 0.95)';
  ctx.fillText('Xich dao 0°', width * 0.18, equatorY - 24);

  ctx.fillStyle = 'rgba(255, 219, 89, 0.95)';
  ctx.fillText('Kinh tuyen goc 0°', primeMeridianX + 170, height * 0.12);

  return new THREE.CanvasTexture(canvas);
}

function createCityLightsLayer({ earthRadius, sunDirection, nightTexture = null }) {
  // Keep this shell slightly outside clouds so dense light dots stay visible.
  const geometry = new THREE.SphereGeometry(earthRadius * 1.018, isMobileLike ? 128 : 192, isMobileLike ? 96 : 140);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uNightMap: { value: nightTexture },
      uSunDirection: { value: sunDirection.clone().normalize() },
      uIntensity: { value: 1.55 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uNightMap;
      uniform vec3 uSunDirection;
      uniform float uIntensity;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 n = normalize(vWorldNormal);
        vec3 sunDir = normalize(uSunDirection);

        float nDotL = dot(n, sunDir);
        float nightFactor = 1.0 - smoothstep(-0.06, 0.14, nDotL);

        vec3 nightTex = texture2D(uNightMap, vUv).rgb;
        float nightTexLuma = dot(nightTex, vec3(0.2126, 0.7152, 0.0722));
        float city = smoothstep(0.01, 0.36, nightTexLuma);
        city = min(city * 1.25, 1.0);

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float viewFacing = clamp(dot(n, viewDir), 0.0, 1.0);
        float depthShape = pow(viewFacing, 0.55);

        float glow = city * nightFactor * uIntensity * (0.52 + depthShape * 0.48);
        if (glow < 0.002) discard;

        vec3 color = nightTex * 1.35;
        gl_FragColor = vec4(color * glow * 1.25, min(glow * 1.05, 1.0));
      }
    `
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 8;

  return {
    mesh,
    setNightTexture(nextTexture) {
      material.uniforms.uNightMap.value = nextTexture;
      material.needsUpdate = true;
    }
  };
}

function createEarthMaterialForStyle(settings) {
  if (settings.style === 'flat') {
    return new THREE.MeshBasicMaterial({ color: settings.flatColor });
  }

  if (settings.style === 'stylized') {
    const map = createStylizedEarthTexture({ width: 1024, height: 512, seed: 2026 });
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
    map.anisotropy = 8;

    const gradientMap = createToonGradientMap();
    gradientMap.colorSpace = THREE.NoColorSpace;

    return new THREE.MeshToonMaterial({
      map,
      gradientMap
    });
  }

  if (settings.style === 'realistic') {
    // Start with fallback; will be swapped if textures exist.
    return createFallbackEarthMaterial();
  }

  // 'procedural'
  return createFallbackEarthMaterial();
}

function createToonGradientMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 256, 0);
  // Hard-ish bands for a clean illustration look
  grd.addColorStop(0.0, '#2a2a2a');
  grd.addColorStop(0.25, '#6b6b6b');
  grd.addColorStop(0.55, '#b5b5b5');
  grd.addColorStop(1.0, '#ffffff');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function createFallbackEarthMaterial() {
  const earthTexture = createEarthTexture({ width: 1024, height: 512, seed: 1337 });
  earthTexture.colorSpace = THREE.SRGBColorSpace;
  earthTexture.wrapS = THREE.RepeatWrapping;
  earthTexture.wrapT = THREE.ClampToEdgeWrapping;
  earthTexture.anisotropy = 8;

  return new THREE.MeshStandardMaterial({
    map: earthTexture,
    roughness: 0.95,
    metalness: 0.0
  });
}

function createStylizedEarthTexture({ width, height, seed }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const fract = (x) => x - Math.floor(x);

  function hash2(x, y) {
    const h = Math.sin(x * 127.1 + y * 311.7 + seed * 0.01) * 43758.5453123;
    return fract(h);
  }

  function valueNoisePeriodic(x, y, periodX) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const px0 = ((x0 % periodX) + periodX) % periodX;
    const px1 = ((x1 % periodX) + periodX) % periodX;

    const sx = smoothstep(fract(x));
    const sy = smoothstep(fract(y));

    const n00 = hash2(px0, y0);
    const n10 = hash2(px1, y0);
    const n01 = hash2(px0, y1);
    const n11 = hash2(px1, y1);

    const ix0 = lerp(n00, n10, sx);
    const ix1 = lerp(n01, n11, sx);
    return lerp(ix0, ix1, sy);
  }

  function fbm(x, y, periodX) {
    let value = 0;
    let amplitude = 0.55;
    let frequency = 1;
    for (let i = 0; i < 5; i++) {
      const p = Math.max(1, Math.round(periodX * frequency));
      value += amplitude * valueNoisePeriodic(x * frequency, y * frequency, p);
      frequency *= 2;
      amplitude *= 0.5;
    }
    return value;
  }

  // Illustration palette (sRGB)
  const ocean1 = [38, 156, 232];
  const ocean2 = [14, 108, 196];
  const ocean3 = [140, 220, 252];
  const land1 = [82, 172, 92];
  const land2 = [52, 138, 84];
  const sand = [230, 210, 135];
  const rock = [190, 175, 150];
  const ice = [250, 252, 255];
  const coast = [210, 235, 250];

  const periodX = 6.0;

  // Precompute land mask for simple coastline detection
  const landMask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const lat = (v - 0.5) * Math.PI;
    const latAbs01 = Math.abs(lat) / (Math.PI / 2);
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const nx = u * periodX;
      const ny = v * 3.0;

      const base = fbm(nx, ny, periodX);
      const detail = fbm(nx + 10.0, ny + 10.0, periodX);
      const continents = base * 0.85 + detail * 0.15 + (1.0 - Math.pow(latAbs01, 1.8)) * 0.12;
      landMask[y * width + x] = continents > 0.57 ? 1 : 0;
    }
  }

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const lat = (v - 0.5) * Math.PI;
    const latAbs01 = Math.abs(lat) / (Math.PI / 2);

    const iceMask = clamp01((latAbs01 - 0.78) / 0.18);

    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const nx = u * periodX;
      const ny = v * 3.0;

      const idx = y * width + x;
      const isLand = landMask[idx] === 1;

      // Simple coastline detection (4-neighborhood)
      const xL = (x - 1 + width) % width;
      const xR = (x + 1) % width;
      const yU = Math.max(0, y - 1);
      const yD = Math.min(height - 1, y + 1);
      const landNeighbors =
        landMask[y * width + xL] +
        landMask[y * width + xR] +
        landMask[yU * width + x] +
        landMask[yD * width + x];
      const isCoast = isLand ? landNeighbors < 4 : landNeighbors > 0;

      let r, g, b;

      if (!isLand) {
        // Oceans with big simple swirls
        const sw = fbm(nx * 1.6 + 20.0, ny * 1.6 + 5.0, periodX);
        const t = clamp01((sw - 0.45) / 0.25);
        const shade = clamp01(0.25 + t * 0.85);
        r = lerp(ocean2[0], ocean1[0], shade);
        g = lerp(ocean2[1], ocean1[1], shade);
        b = lerp(ocean2[2], ocean1[2], shade);
        // Add lighter accents
        const accent = clamp01((sw - 0.72) / 0.15);
        r = lerp(r, ocean3[0], accent * 0.55);
        g = lerp(g, ocean3[1], accent * 0.55);
        b = lerp(b, ocean3[2], accent * 0.55);
      } else {
        // Land: green + deserts in mid-latitudes
        const elev = fbm(nx + 7.0, ny + 17.0, periodX);
        const dryness = fbm(nx + 37.0, ny + 3.0, periodX);
        const desertBand = clamp01((0.85 - latAbs01) * 1.4);
        const desert = clamp01((dryness - 0.52) / 0.25) * desertBand;

        r = lerp(land2[0], land1[0], elev);
        g = lerp(land2[1], land1[1], elev);
        b = lerp(land2[2], land1[2], elev);

        r = lerp(r, sand[0], desert);
        g = lerp(g, sand[1], desert);
        b = lerp(b, sand[2], desert);

        // Mountains/rocks
        const mount = clamp01((elev - 0.68) / 0.22) * (1.0 - desert * 0.6);
        r = lerp(r, rock[0], mount);
        g = lerp(g, rock[1], mount);
        b = lerp(b, rock[2], mount);
      }

      // Coast highlight
      if (isCoast) {
        const coastStrength = isLand ? 0.28 : 0.22;
        r = lerp(r, coast[0], coastStrength);
        g = lerp(g, coast[1], coastStrength);
        b = lerp(b, coast[2], coastStrength);
      }

      // Ice caps
      r = lerp(r, ice[0], iceMask);
      g = lerp(g, ice[1], iceMask);
      b = lerp(b, ice[2], iceMask);

      const i = idx * 4;
      data[i + 0] = r | 0;
      data[i + 1] = g | 0;
      data[i + 2] = b | 0;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => resolve(tex),
      undefined,
      (err) => reject(err)
    );
  });
}

async function loadEarthTextures(paths) {
  const results = await Promise.allSettled([
    loadTexture(paths.day),
    loadTexture(paths.normal),
    loadTexture(paths.roughness),
    loadTexture(paths.specular),
    loadTexture(paths.bump),
    loadTexture(paths.seaIce),
    loadTexture(paths.night)
  ]);

  const [day, normal, roughness, specular, bump, seaIce, night] = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
  if (day) {
    prepareTexture(day, THREE.SRGBColorSpace);
  }

  // non-color maps
  for (const tex of [normal, roughness, specular, bump, seaIce]) {
    if (!tex) continue;
    prepareTexture(tex, THREE.NoColorSpace);
  }

  if (night) {
    prepareTexture(night, THREE.SRGBColorSpace);
  }

  return {
    day: resizeTextureIfNeeded(day, DAY_TEXTURE_MAX_SIZE, THREE.SRGBColorSpace),
    normal: resizeTextureIfNeeded(normal, AUX_TEXTURE_MAX_SIZE, THREE.NoColorSpace),
    roughness: resizeTextureIfNeeded(roughness, AUX_TEXTURE_MAX_SIZE, THREE.NoColorSpace),
    specular: resizeTextureIfNeeded(specular, AUX_TEXTURE_MAX_SIZE, THREE.NoColorSpace),
    bump: resizeTextureIfNeeded(bump, AUX_TEXTURE_MAX_SIZE, THREE.NoColorSpace),
    seaIce: resizeTextureIfNeeded(seaIce, AUX_TEXTURE_MAX_SIZE, THREE.NoColorSpace),
    night: resizeTextureIfNeeded(night, AUX_TEXTURE_MAX_SIZE, THREE.SRGBColorSpace)
  };
}

function createRealEarthMaterial(maps) {
  const clearOceanDayMap = maps.day
    ? createEnhancedEarthDayMap(maps.day, maps.specular, maps.seaIce)
    : null;
  const landBumpMap = maps.bump && maps.specular
    ? createLandOnlyBumpMap(maps.bump, maps.specular, maps.seaIce)
    : null;
  const oceanRoughnessMap = maps.specular
    ? createOceanRoughnessMap(maps.specular, maps.seaIce)
    : null;

  const material = new THREE.MeshStandardMaterial({
    map: clearOceanDayMap ?? maps.day ?? null,
    normalMap: maps.normal ?? null,
    normalScale: maps.normal ? new THREE.Vector2(0.42, 0.42) : new THREE.Vector2(1, 1),
    bumpMap: landBumpMap,
    bumpScale: landBumpMap ? 0.038 : 0,
    roughnessMap: oceanRoughnessMap,
    roughness: 0.92,
    metalness: 0.0
  });

  // Keep oceans reflective and land comparatively matte without sinking geometry.
  material.color = new THREE.Color(0xf6fbff);
  material.envMapIntensity = 0.65;

  return material;
}

function createEnhancedEarthDayMap(dayTexture, specularTexture, seaIceTexture) {
  const sourceImage = dayTexture?.image;
  if (!sourceImage || !sourceImage.width || !sourceImage.height) return dayTexture;

  const { canvas, ctx, img, data } = createEditableTextureCanvas(sourceImage);
  const specData = getComparableImageData(specularTexture, canvas.width, canvas.height);
  const iceData = getComparableImageData(seaIceTexture, canvas.width, canvas.height);
  const clamp255 = (v) => Math.max(0, Math.min(255, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i + 0];
    let g = data[i + 1];
    let b = data[i + 2];

    const spec = specData ? specData[i] / 255 : 0;
    const ice = iceData ? iceData[i] / 255 : 0;
    const oceanMask = THREE.MathUtils.clamp(spec, 0, 1);

    const contrast = 1.06;
    r = ((r / 255 - 0.5) * contrast + 0.5) * 255;
    g = ((g / 255 - 0.5) * contrast + 0.5) * 255;
    b = ((b / 255 - 0.5) * contrast + 0.5) * 255;

    // Deepen and enrich oceans using the specular mask.
    const oceanStrength = oceanMask * 0.6;
    r = lerp(r, 28, oceanStrength);
    g = lerp(g, 102, oceanStrength);
    b = lerp(b, 196, oceanStrength);

    // Add bright, cold sea ice without changing geometry height.
    const iceStrength = THREE.MathUtils.clamp(ice, 0, 1) * 0.9;
    r = lerp(r, 236, iceStrength);
    g = lerp(g, 244, iceStrength);
    b = lerp(b, 250, iceStrength);

    data[i + 0] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
  }

  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = dayTexture.wrapS;
  tex.wrapT = dayTexture.wrapT;
  tex.anisotropy = dayTexture.anisotropy;
  tex.generateMipmaps = true;

  return tex;
}

function createLandOnlyBumpMap(bumpTexture, specularTexture, seaIceTexture) {
  const sourceImage = bumpTexture?.image;
  if (!sourceImage || !sourceImage.width || !sourceImage.height) return bumpTexture;

  const { canvas, ctx, img, data } = createEditableTextureCanvas(sourceImage);
  const specData = getComparableImageData(specularTexture, canvas.width, canvas.height);
  const iceData = getComparableImageData(seaIceTexture, canvas.width, canvas.height);

  for (let i = 0; i < data.length; i += 4) {
    const base = data[i] / 255;
    const landMask = specData ? (1 - specData[i] / 255) : 1;
    const iceMask = iceData ? iceData[i] / 255 : 0;
    const emphasizedLand = Math.pow(base, 1.28);
    const landRelief = Math.round(emphasizedLand * 255 * landMask);
    const iceRelief = Math.round(iceMask * 18);
    const value = Math.max(0, Math.min(255, landRelief + iceRelief));

    data[i + 0] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = bumpTexture.wrapS;
  tex.wrapT = bumpTexture.wrapT;
  tex.anisotropy = bumpTexture.anisotropy;
  tex.generateMipmaps = true;

  return tex;
}

function createOceanRoughnessMap(specularTexture, seaIceTexture) {
  const sourceImage = specularTexture?.image;
  if (!sourceImage || !sourceImage.width || !sourceImage.height) return null;

  const { canvas, ctx, img, data } = createEditableTextureCanvas(sourceImage);
  const iceData = getComparableImageData(seaIceTexture, canvas.width, canvas.height);

  for (let i = 0; i < data.length; i += 4) {
    const oceanMask = data[i] / 255;
    const iceMask = iceData ? iceData[i] / 255 : 0;
    const roughnessValue = Math.round(
      THREE.MathUtils.lerp(
        214,
        54,
        oceanMask * (1 - iceMask * 0.5)
      ) + iceMask * 34
    );

    data[i + 0] = roughnessValue;
    data[i + 1] = roughnessValue;
    data[i + 2] = roughnessValue;
    data[i + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = specularTexture.wrapS;
  tex.wrapT = specularTexture.wrapT;
  tex.anisotropy = specularTexture.anisotropy;
  tex.generateMipmaps = true;

  return tex;
}

function createEditableTextureCanvas(sourceImage) {
  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(sourceImage, 0, 0);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;

  return { canvas, ctx, img, data };
}

function prepareTexture(texture, colorSpace) {
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = isMobileLike ? 2 : 4;
}

function resizeTextureIfNeeded(texture, maxSize, colorSpace) {
  const image = texture?.image;
  if (!texture || !image?.width || !image?.height) return texture;

  const largestSide = Math.max(image.width, image.height);
  if (largestSide <= maxSize) return texture;

  const scale = maxSize / largestSide;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);

  const resized = new THREE.CanvasTexture(canvas);
  resized.colorSpace = colorSpace;
  resized.wrapS = texture.wrapS;
  resized.wrapT = texture.wrapT;
  resized.anisotropy = texture.anisotropy;
  resized.generateMipmaps = true;
  texture.dispose();

  return resized;
}

function getComparableImageData(texture, width, height) {
  const image = texture?.image;
  if (!image) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);

  return ctx.getImageData(0, 0, width, height).data;
}

function createAtmosphereMesh(radius) {
  const geometry = new THREE.SphereGeometry(radius * 1.04, 96, 64);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      glowColor: { value: new THREE.Color(0x87bfff) },
      intensity: { value: 0.48 },
      power: { value: 2.4 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float intensity;
      uniform float power;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), power);
        gl_FragColor = vec4(glowColor, fresnel * intensity);
      }
    `
  });
  return new THREE.Mesh(geometry, material);
}

function createEarthTexture({ width, height, seed }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const fract = (x) => x - Math.floor(x);

  function hash2(x, y) {
    // Deterministic pseudo-random in [0,1)
    const h = Math.sin(x * 127.1 + y * 311.7 + seed * 0.01) * 43758.5453123;
    return fract(h);
  }

  function valueNoisePeriodic(x, y, periodX) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const px0 = ((x0 % periodX) + periodX) % periodX;
    const px1 = ((x1 % periodX) + periodX) % periodX;

    const sx = smoothstep(fract(x));
    const sy = smoothstep(fract(y));

    const n00 = hash2(px0, y0);
    const n10 = hash2(px1, y0);
    const n01 = hash2(px0, y1);
    const n11 = hash2(px1, y1);

    const ix0 = lerp(n00, n10, sx);
    const ix1 = lerp(n01, n11, sx);
    return lerp(ix0, ix1, sy);
  }

  function fbm(x, y, periodX) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let i = 0; i < 6; i++) {
      const p = Math.max(1, Math.round(periodX * frequency));
      value += amplitude * valueNoisePeriodic(x * frequency, y * frequency, p);
      frequency *= 2;
      amplitude *= 0.5;
    }
    return value;
  }

  // Colors (sRGB)
  const oceanDeep = [6, 40, 118];
  const oceanShallow = [14, 96, 176];
  const landLow = [26, 102, 78];
  const landHigh = [82, 126, 88];
  const ice = [235, 245, 255];
  const desert = [190, 170, 110];
  const cloud = [245, 245, 250];

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const lat = (v - 0.5) * Math.PI; // -pi/2..pi/2
    const latAbs01 = Math.abs(lat) / (Math.PI / 2);

    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);

      // Equirectangular domain; wrap u naturally by periodic sampling
      const nx = u * 6.0;
      const ny = v * 3.0;

      // Base height field
      const periodX = 6.0;
      const h = fbm(nx, ny, periodX);
      const h2 = fbm(nx + 10.0, ny + 10.0, periodX);
      const heightField = h * 0.75 + h2 * 0.25;

      // Encourage oceans near poles and more land in mid-latitudes
      const latMask = 1.0 - Math.pow(latAbs01, 1.6);
      const continents = heightField * 1.05 + latMask * 0.15;
      const landThreshold = 0.57;
      const isLand = continents > landThreshold;

      // Ocean/land color
      let r, g, b;
      if (!isLand) {
        const depth = clamp01((landThreshold - continents) / 0.25);
        const t = clamp01(1.0 - depth);
        r = lerp(oceanDeep[0], oceanShallow[0], t);
        g = lerp(oceanDeep[1], oceanShallow[1], t);
        b = lerp(oceanDeep[2], oceanShallow[2], t);
      } else {
        const elev = clamp01((continents - landThreshold) / 0.35);
        const dryness = clamp01(fbm(nx + 25.0, ny + 5.0, periodX) * 1.1);
        const desertBias = clamp01((0.85 - latAbs01) * 1.3) * dryness;

        const baseLand = [
          lerp(landLow[0], landHigh[0], elev),
          lerp(landLow[1], landHigh[1], elev),
          lerp(landLow[2], landHigh[2], elev)
        ];

        r = lerp(baseLand[0], desert[0], desertBias * 0.8);
        g = lerp(baseLand[1], desert[1], desertBias * 0.8);
        b = lerp(baseLand[2], desert[2], desertBias * 0.8);
      }

      // Ice caps
      const iceMask = clamp01((latAbs01 - 0.78) / 0.18);
      r = lerp(r, ice[0], iceMask);
      g = lerp(g, ice[1], iceMask);
      b = lerp(b, ice[2], iceMask);

      // Sparse clouds (very subtle)
      const c = fbm(nx * 1.8 + 40.0, ny * 1.8 + 10.0, periodX);
      const cloudMask = clamp01((c - 0.7) / 0.18) * (1.0 - iceMask * 0.6);
      r = lerp(r, cloud[0], cloudMask * 0.35);
      g = lerp(g, cloud[1], cloudMask * 0.35);
      b = lerp(b, cloud[2], cloudMask * 0.35);

      const i = (y * width + x) * 4;
      data[i + 0] = Math.round(clamp01(r / 255) * 255);
      data[i + 1] = Math.round(clamp01(g / 255) * 255);
      data[i + 2] = Math.round(clamp01(b / 255) * 255);
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return new THREE.CanvasTexture(canvas);
}
