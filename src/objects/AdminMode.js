import * as THREE from 'three';
import { COLORS, WGS84 } from '../core/constants.js';
import { Satellites } from './Satellites.js';

const TOP_AIRPORTS = [
  { lat: 33.64, lon: -84.43 },
  { lat: 25.25, lon: 55.36 },
  { lat: 32.9, lon: -97.04 },
  { lat: 51.47, lon: -0.46 },
  { lat: 35.55, lon: 139.78 },
  { lat: 1.36, lon: 103.99 },
  { lat: -33.95, lon: 151.18 },
  { lat: 40.08, lon: 116.58 },
];

const FLIGHT_ROUTES = [
  [0, 3],
  [0, 4],
  [1, 3],
  [1, 5],
  [3, 4],
  [4, 5],
  [5, 6],
  [7, 4],
];

export class AdminMode {
  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.active = false;

    this.routesGroup = new THREE.Group();
    this.satellites = new Satellites();

    this.group.add(this.routesGroup);
    this.group.add(this.satellites.group);

    this._buildDarkOverlay();
    this._buildFlightRoutes();
  }

  _geoToVec3(lon, lat, radius = WGS84.SCENE_RADIUS * 1.007) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi) * WGS84.POLAR_SCALE,
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  _buildDarkOverlay() {
    const material = new THREE.MeshBasicMaterial({
      color: COLORS.ADMIN_BG,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });

    const geometry = new THREE.SphereGeometry(WGS84.SCENE_RADIUS * 1.002, 40, 40);
    geometry.scale(1, WGS84.POLAR_SCALE, 1);

    this.darkOverlay = new THREE.Mesh(geometry, material);
    this.group.add(this.darkOverlay);
  }

  _buildFlightRoutes() {
    const routeMaterial = new THREE.LineBasicMaterial({
      color: 0x47b9ff,
      transparent: true,
      opacity: 0.5,
    });

    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0x47b9ff,
      transparent: true,
      opacity: 0.9,
    });

    this.routeLines = [];

    for (const [fromIndex, toIndex] of FLIGHT_ROUTES) {
      const geometry = this._createArc(TOP_AIRPORTS[fromIndex], TOP_AIRPORTS[toIndex], 32);
      const line = new THREE.Line(geometry, routeMaterial);
      this.routeLines.push(line);
      this.routesGroup.add(line);
    }

    for (const airport of TOP_AIRPORTS) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), markerMaterial);
      marker.position.copy(this._geoToVec3(airport.lon, airport.lat));
      this.routesGroup.add(marker);
    }
  }

  _createArc(from, to, segments) {
    const start = this._geoToVec3(from.lon, from.lat);
    const end = this._geoToVec3(to.lon, to.lat);
    const points = [];
    const distance = start.distanceTo(end);

    for (let index = 0; index <= segments; index++) {
      const t = index / segments;
      const point = new THREE.Vector3().copy(start).lerp(end, t);
      const lift = Math.sin(t * Math.PI) * distance * 0.08;
      point.normalize().multiplyScalar(WGS84.SCENE_RADIUS * 1.008 + lift);
      points.push(point);
    }

    return new THREE.BufferGeometry().setFromPoints(points);
  }

  setActive(active) {
    this.active = active;
    this.group.visible = active;
  }

  update(virtualTime, delta) {
    if (!this.active) return;

    this.satellites.update(virtualTime);

    const pulse = 0.45 + Math.sin(virtualTime * 0.0015) * 0.08;
    for (const line of this.routeLines) {
      line.material.opacity = pulse;
    }

    this.darkOverlay.rotation.y += delta * 0.02;
  }
}
