/**
 * AdminMode — Administrative & Social overlay system (Full)
 *
 * Spec ref: Section 2 — Complete Admin Mode
 * - Dark base map overlay (#050A14) when active
 * - Country borders (Natural Earth GeoJSON, #00FFAA)
 * - Country labels (Billboard Sprites)
 * - Flight routes (Great Circle arcs)
 * - Maritime routes (dashed lines)
 * - GDP 3D charts (World Bank API)
 * - Clear separation: ALL admin elements in one group
 */
import * as THREE from 'three';
import { WGS84, COLORS } from '../core/constants.js';
import { Satellites } from './Satellites.js';

const BORDERS_URL = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_boundary_lines_land.geojson';
const COUNTRIES_URL = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson';
const WORLDBANK_URL = 'https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?date=2022&format=json&per_page=300';

// Top airports for flight routes
const TOP_AIRPORTS = [
  { name: 'ATL', lat: 33.64, lon: -84.43 },
  { name: 'DXB', lat: 25.25, lon: 55.36 },
  { name: 'DFW', lat: 32.90, lon: -97.04 },
  { name: 'LHR', lat: 51.47, lon: -0.46 },
  { name: 'HND', lat: 35.55, lon: 139.78 },
  { name: 'CDG', lat: 49.01, lon: 2.55 },
  { name: 'PEK', lat: 40.08, lon: 116.58 },
  { name: 'SIN', lat: 1.36, lon: 103.99 },
  { name: 'ICN', lat: 37.46, lon: 126.44 },
  { name: 'SYD', lat: -33.95, lon: 151.18 },
  { name: 'GRU', lat: -23.43, lon: -46.47 },
  { name: 'IST', lat: 41.26, lon: 28.72 },
  { name: 'DEL', lat: 28.56, lon: 77.10 },
  { name: 'NRT', lat: 35.76, lon: 140.39 },
  { name: 'FCO', lat: 41.80, lon: 12.25 },
];

const FLIGHT_ROUTES = [
  [0, 3], [0, 4], [1, 3], [1, 7], [3, 5], [5, 12],
  [6, 8], [6, 4], [7, 9], [9, 10], [11, 1], [11, 3],
  [12, 7], [13, 8], [14, 3], [0, 10], [1, 12],
];

// Major maritime routes (port-to-port)
const PORTS = [
  { name: 'Shanghai', lat: 31.23, lon: 121.47 },
  { name: 'Singapore', lat: 1.26, lon: 103.84 },
  { name: 'Rotterdam', lat: 51.91, lon: 4.48 },
  { name: 'Los Angeles', lat: 33.73, lon: -118.27 },
  { name: 'Dubai', lat: 25.27, lon: 55.29 },
  { name: 'Santos', lat: -23.96, lon: -46.30 },
  { name: 'Mumbai', lat: 18.95, lon: 72.83 },
  { name: 'Cape Town', lat: -33.92, lon: 18.42 },
];

const MARITIME_ROUTES = [
  [0, 1], [1, 4], [4, 2], [0, 3], [1, 6], [2, 5],
  [6, 4], [7, 4], [1, 7], [0, 6],
];

export class AdminMode {
  constructor(camera) {
    this.group = new THREE.Group();
    // Default opacity = 0 out of standard display flow. visibility logic handled by GSAP
    this.group.visible = false;
    this.active = false;
    this.camera = camera;
    this.labels = [];

    // Groups for toggling
    this.flightsGroup = new THREE.Group();
    this.group.add(this.flightsGroup);
    
    this.satellites = new Satellites();
    this.group.add(this.satellites.group);

    // Elements
    this._buildDarkOverlay();
    this._loadBorders();
    this._loadCountryLabels();
    this._buildFlightRoutes();
    this._buildMaritimeRoutes();
    this._fetchGDP();
  }

  setFlightsVisible(visible) {
    this.flightsGroup.visible = visible;
  }

  setSatellitesVisible(visible) {
    this.satellites.group.visible = visible;
  }

  _geoToVec3(lon, lat, radius = WGS84.SCENE_RADIUS * 1.004) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi) * WGS84.POLAR_SCALE,
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  /**
   * Dark overlay sphere — dims the Earth texture to #050A14 (spec 2.1)
   */
  _buildDarkOverlay() {
    const mat = new THREE.MeshBasicMaterial({
      color: COLORS.ADMIN_BG, // #050A14
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const geom = new THREE.SphereGeometry(WGS84.SCENE_RADIUS * 1.001, 64, 64);
    geom.scale(1, WGS84.POLAR_SCALE, 1);
    this.darkOverlay = new THREE.Mesh(geom, mat);
    this.group.add(this.darkOverlay);
  }

  /**
   * Country borders — #00FFAA lines from Natural Earth
   */
  async _loadBorders() {
    try {
      const res = await fetch(BORDERS_URL);
      const geojson = await res.json();

      const borderMat = new THREE.LineBasicMaterial({
        color: COLORS.ADMIN_BORDER,
        transparent: true,
        opacity: 0.6,
      });

      for (const feature of geojson.features) {
        const coords = this._extractLineCoords(feature.geometry);
        if (!coords) continue;
        for (const line of coords) {
          if (line.length < 2) continue;
          const points = line.map(([lon, lat]) => this._geoToVec3(lon, lat));
          const geom = new THREE.BufferGeometry().setFromPoints(points);
          this.group.add(new THREE.Line(geom, borderMat));
        }
      }
      console.log('[AdminMode] ✓ Borders loaded');
    } catch (e) {
      console.warn('[AdminMode] Border load failed:', e.message);
    }
  }

  /**
   * Country labels — Billboard Sprites (spec 2.4)
   */
  async _loadCountryLabels() {
    try {
      const res = await fetch(COUNTRIES_URL);
      const geojson = await res.json();

      for (const feature of geojson.features) {
        const props = feature.properties;
        const name = props.name || props.NAME || '';
        if (!name) continue;

        // Calculate centroid from geometry
        const centroid = this._getGeomCentroid(feature.geometry);
        if (!centroid) continue;

        const sprite = this._createLabelSprite(name);
        sprite.position.copy(this._geoToVec3(centroid[0], centroid[1], WGS84.SCENE_RADIUS * 1.02));
        sprite.scale.set(1.5, 0.5, 1);
        this.labels.push(sprite);
        this.group.add(sprite);
      }
      console.log(`[AdminMode] ✓ ${this.labels.length} country labels loaded`);
    } catch (e) {
      console.warn('[AdminMode] Labels load failed:', e.message);
    }
  }

  _createLabelSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.fillStyle = '#00FFAA';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;

    return new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
    }));
  }

  _getGeomCentroid(geometry) {
    let coords;
    if (geometry.type === 'Polygon') {
      coords = geometry.coordinates[0];
    } else if (geometry.type === 'MultiPolygon') {
      // Use largest polygon
      let maxLen = 0;
      for (const poly of geometry.coordinates) {
        if (poly[0].length > maxLen) {
          maxLen = poly[0].length;
          coords = poly[0];
        }
      }
    }
    if (!coords || coords.length === 0) return null;

    let sumLon = 0, sumLat = 0;
    for (const [lon, lat] of coords) {
      sumLon += lon;
      sumLat += lat;
    }
    return [sumLon / coords.length, sumLat / coords.length];
  }

  /**
   * Flight routes — Great Circle arcs (spec 2.6)
   */
  _buildFlightRoutes() {
    const routeMat = new THREE.LineBasicMaterial({
      color: 0x44bbff,
      transparent: true,
      opacity: 0.4,
    });

    for (const [fromIdx, toIdx] of FLIGHT_ROUTES) {
      const arc = this._createGreatCircleArc(
        TOP_AIRPORTS[fromIdx], TOP_AIRPORTS[toIdx]
      );
      this.flightsGroup.add(new THREE.Line(arc, routeMat));
    }

    // Airport markers (small glowing spheres)
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0x44bbff, transparent: true, opacity: 0.9,
    });
    for (const airport of TOP_AIRPORTS) {
      const pos = this._geoToVec3(airport.lon, airport.lat, WGS84.SCENE_RADIUS * 1.005);
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), markerMat);
      marker.position.copy(pos);
      this.flightsGroup.add(marker);
    }
  }

  /**
   * Maritime routes — dashed lines with dash offset animation (spec 2.6)
   */
  _buildMaritimeRoutes() {
    const dashMat = new THREE.LineDashedMaterial({
      color: 0xffcc44,
      transparent: true,
      opacity: 0.35,
      dashSize: 0.15,
      gapSize: 0.08,
    });

    this._maritimeLines = [];

    for (const [fromIdx, toIdx] of MARITIME_ROUTES) {
      const from = PORTS[fromIdx];
      const to = PORTS[toIdx];
      const arc = this._createGreatCircleArc(from, to, 80);
      const line = new THREE.Line(arc, dashMat.clone());
      line.computeLineDistances();
      this._maritimeLines.push(line);
      this.group.add(line);
    }

    // Port markers (orange)
    const portMat = new THREE.MeshBasicMaterial({
      color: 0xffcc44, transparent: true, opacity: 0.9,
    });
    for (const port of PORTS) {
      const pos = this._geoToVec3(port.lon, port.lat, WGS84.SCENE_RADIUS * 1.005);
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), portMat);
      marker.position.copy(pos);
      this.group.add(marker);
    }
  }

  /**
   * GDP 3D visualization — Cylinder bars at capitals (spec 2.5)
   * Data from World Bank API, cache 7 days
   */
  async _fetchGDP() {
    try {
      // Check localStorage cache (7 days TTL)
      const cacheKey = 'wb_gdp_data';
      const cached = localStorage.getItem(cacheKey);
      let gdpData;

      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 7 * 86400000) {
          gdpData = data;
        }
      }

      if (!gdpData) {
        const res = await fetch(WORLDBANK_URL);
        const json = await res.json();
        gdpData = json[1] || [];
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ data: gdpData, timestamp: Date.now() }));
        } catch {}
      }

      this._buildGDPBars(gdpData);
      console.log('[AdminMode] ✓ GDP data loaded');
    } catch (e) {
      console.warn('[AdminMode] GDP fetch failed:', e.message);
    }
  }

  _buildGDPBars(gdpData) {
    // Country code → approximate capital coordinates
    const CAPITALS = {
      US: [38.9, -77.0], CN: [39.9, 116.4], JP: [35.7, 139.7],
      DE: [52.5, 13.4], GB: [51.5, -0.1], IN: [28.6, 77.2],
      FR: [48.9, 2.3], BR: [-15.8, -47.9], IT: [41.9, 12.5],
      CA: [45.4, -75.7], RU: [55.8, 37.6], KR: [37.6, 127.0],
      AU: [-35.3, 149.1], MX: [19.4, -99.1], ID: [-6.2, 106.8],
      SA: [24.7, 46.7], TR: [39.9, 32.9], NL: [52.4, 4.9],
      CH: [46.9, 7.4], AR: [-34.6, -58.4],
    };

    // Find max GDP for scaling
    let maxGDP = 0;
    const validEntries = [];
    for (const entry of gdpData) {
      if (!entry.value || !entry.countryiso3code) continue;
      const code2 = this._iso3to2(entry.countryiso3code);
      if (!code2 || !CAPITALS[code2]) continue;
      validEntries.push({ code: code2, gdp: entry.value });
      if (entry.value > maxGDP) maxGDP = entry.value;
    }

    const barMat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.7,
    });

    for (const { code, gdp } of validEntries) {
      const [lat, lon] = CAPITALS[code];
      const height = (gdp / maxGDP) * 3; // Max bar = 3 scene units tall
      if (height < 0.05) continue; // Skip tiny economies

      const pos = this._geoToVec3(lon, lat, WGS84.SCENE_RADIUS * 1.005);
      const normal = pos.clone().normalize();

      const barGeom = new THREE.CylinderGeometry(0.03, 0.03, height, 6);
      const bar = new THREE.Mesh(barGeom, barMat);

      // Position at surface and orient along surface normal
      bar.position.copy(pos).add(normal.clone().multiplyScalar(height / 2));
      bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      this.group.add(bar);
    }
  }

  _iso3to2(iso3) {
    const map = {
      USA: 'US', CHN: 'CN', JPN: 'JP', DEU: 'DE', GBR: 'GB',
      IND: 'IN', FRA: 'FR', BRA: 'BR', ITA: 'IT', CAN: 'CA',
      RUS: 'RU', KOR: 'KR', AUS: 'AU', MEX: 'MX', IDN: 'ID',
      SAU: 'SA', TUR: 'TR', NLD: 'NL', CHE: 'CH', ARG: 'AR',
    };
    return map[iso3] || null;
  }

  _createGreatCircleArc(from, to, segments = 50) {
    const start = this._geoToVec3(from.lon, from.lat, WGS84.SCENE_RADIUS * 1.005);
    const end = this._geoToVec3(to.lon, to.lat, WGS84.SCENE_RADIUS * 1.005);
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = new THREE.Vector3().copy(start).lerp(end, t);
      const dist = start.distanceTo(end);
      const lift = Math.sin(t * Math.PI) * dist * 0.15;
      point.normalize().multiplyScalar(WGS84.SCENE_RADIUS * 1.005 + lift);
      points.push(point);
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }

  _extractLineCoords(geometry) {
    if (geometry.type === 'LineString') return [geometry.coordinates];
    if (geometry.type === 'MultiLineString') return geometry.coordinates;
    return null;
  }

  toggle() {
    this.active = !this.active;
    this.group.visible = this.active;
    return this.active;
  }

  setActive(active) {
    this.active = active;
    this.group.visible = active;
  }

  update(virtualTime) {
    // Animate maritime dash offset
    if (this._maritimeLines && this.active) {
      for (const line of this._maritimeLines) {
        line.material.dashOffset -= 0.002;
      }
    }
    
    // Animate satellites
    if (this.satellites && this.active && this.satellites.group.visible) {
      this.satellites.update(virtualTime);
    }
  }
}
