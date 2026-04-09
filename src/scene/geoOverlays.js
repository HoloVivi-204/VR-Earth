import * as THREE from 'three';

const MAP_LONGITUDE_DIRECTION = -1;
const DEFAULT_LATLON_SAMPLES = 24;

export async function createGeoOverlayGroup({
  earthRadius,
  countriesUrl,
  graticulesUrl
}) {
  const overlayGroup = new THREE.Group();
  overlayGroup.name = 'geo-overlays';
  overlayGroup.visible = false;

  const [countries, graticules] = await Promise.all([
    fetchGeoJson(countriesUrl),
    fetchGeoJson(graticulesUrl)
  ]);

  const borderLines = buildCountryBorders(countries, earthRadius * 1.0175);
  const graticuleLines = buildGraticules(graticules, earthRadius * 1.0165);

  overlayGroup.add(graticuleLines);
  overlayGroup.add(borderLines);

  return overlayGroup;
}

async function fetchGeoJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load GeoJSON: ${response.status}`);
  }

  return response.json();
}

function buildCountryBorders(featureCollection, radius) {
  const group = new THREE.Group();
  group.name = 'country-borders';
  const positions = [];

  for (const feature of featureCollection?.features || []) {
    const geometry = feature?.geometry;
    if (!geometry) continue;

    if (geometry.type === 'Polygon') {
      addPolygonRings(positions, geometry.coordinates, radius);
      continue;
    }

    if (geometry.type === 'MultiPolygon') {
      for (const polygon of geometry.coordinates) {
        addPolygonRings(positions, polygon, radius);
      }
    }
  }

  if (positions.length > 0) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const lines = new THREE.LineSegments(geometry, createBorderMaterial());
    lines.renderOrder = 11;
    group.add(lines);
  }

  return group;
}

function buildGraticules(featureCollection, radius) {
  const group = new THREE.Group();
  group.name = 'graticules';
  const positions = [];

  for (const feature of featureCollection?.features || []) {
    const geometry = feature?.geometry;
    if (!geometry) continue;

    if (geometry.type === 'LineString') {
      addLineString(positions, geometry.coordinates, radius);
      continue;
    }

    if (geometry.type === 'MultiLineString') {
      for (const line of geometry.coordinates) {
        addLineString(positions, line, radius);
      }
    }
  }

  if (positions.length > 0) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const lines = new THREE.LineSegments(geometry, createGraticuleMaterial());
    lines.renderOrder = 11;
    group.add(lines);
  }

  return group;
}

function addPolygonRings(positions, polygonCoords, radius) {
  for (const ring of polygonCoords || []) {
    addLineString(positions, ring, radius, true);
  }
}

function addLineString(positions, coordinates, radius, closed = false) {
  const points = [];
  const safeCoords = coordinates || [];

  for (let i = 0; i < safeCoords.length - 1; i += 1) {
    const start = safeCoords[i];
    const end = safeCoords[i + 1];
    appendArcPoints(points, start, end, radius);
  }

  if (closed && safeCoords.length > 2) {
    appendArcPoints(points, safeCoords[safeCoords.length - 1], safeCoords[0], radius);
  }

  if (points.length < 2) return;

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
}

function appendArcPoints(points, start, end, radius) {
  if (!start || !end) return;

  const lonDelta = shortestLonDelta(start[0], end[0]);
  const latDelta = end[1] - start[1];
  const segmentCount = Math.max(
    1,
    Math.ceil(
      Math.max(Math.abs(lonDelta), Math.abs(latDelta)) / (180 / DEFAULT_LATLON_SAMPLES)
    )
  );

  for (let step = 0; step <= segmentCount; step += 1) {
    if (points.length > 0 && step === 0) continue;

    const t = step / segmentCount;
    const lon = normalizeLongitude(start[0] + lonDelta * t);
    const lat = THREE.MathUtils.lerp(start[1], end[1], t);
    points.push(latLonToCartesian(lat, lon, radius));
  }
}

function latLonToCartesian(lat, lon, radius) {
  const latRad = THREE.MathUtils.degToRad(lat);
  const lonRad = THREE.MathUtils.degToRad(lon * MAP_LONGITUDE_DIRECTION);
  const cosLat = Math.cos(latRad);

  return new THREE.Vector3(
    radius * cosLat * Math.cos(lonRad),
    radius * Math.sin(latRad),
    radius * cosLat * Math.sin(lonRad)
  );
}

function shortestLonDelta(fromLon, toLon) {
  let delta = toLon - fromLon;

  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;

  return delta;
}

function normalizeLongitude(lon) {
  let normalized = lon;

  while (normalized <= -180) normalized += 360;
  while (normalized > 180) normalized -= 360;

  return normalized;
}

function createBorderMaterial() {
  return new THREE.LineBasicMaterial({
    color: 0xffdd8a,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });
}

function createGraticuleMaterial() {
  return new THREE.LineBasicMaterial({
    color: 0x9ad7ff,
    transparent: true,
    opacity: 0.36,
    depthWrite: false
  });
}
