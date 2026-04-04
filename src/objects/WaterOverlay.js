/**
 * WaterOverlay — Real River & Lake data from Natural Earth
 *
 * Fetches GeoJSON rivers and lakes from Natural Earth CDN (geojson.xyz)
 * Converts lat/lon → 3D sphere coordinates
 * Rivers: rendered as glowing blue lines on the globe
 * Lakes: rendered as filled blue polygons
 *
 * Spec ref: Section 1.4 — Hydrology
 */
import * as THREE from 'three';
import { WGS84 } from '../core/constants.js';

const RIVERS_URL = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_rivers_lake_centerlines.geojson';
const LAKES_URL = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_lakes.geojson';

export class WaterOverlay {
  constructor() {
    this.group = new THREE.Group();
    this._loadRivers();
    this._loadLakes();
  }

  /**
   * Convert geographic coordinates (lon, lat) to 3D position on sphere
   * Slightly above Earth surface to prevent z-fighting
   */
  _geoToVec3(lon, lat, radius = WGS84.SCENE_RADIUS * 1.003) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi) * WGS84.POLAR_SCALE,
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  /**
   * Fetch and render rivers as 3D lines on the globe
   */
  async _loadRivers() {
    try {
      console.log('[WaterOverlay] Fetching Natural Earth rivers...');
      const res = await fetch(RIVERS_URL);
      const geojson = await res.json();

      const riverMaterial = new THREE.LineBasicMaterial({
        color: 0x1a6ed8,
        transparent: true,
        opacity: 0.6,
        linewidth: 1,
      });

      let lineCount = 0;

      for (const feature of geojson.features) {
        const coords = this._extractLineCoords(feature.geometry);
        if (!coords) continue;

        for (const lineCoords of coords) {
          if (lineCoords.length < 2) continue;

          const points = [];
          for (let i = 0; i < lineCoords.length; i++) {
            const [lon, lat] = lineCoords[i];
            points.push(this._geoToVec3(lon, lat));
          }

          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(geometry, riverMaterial);
          this.group.add(line);
          lineCount++;
        }
      }

      console.log(`[WaterOverlay] ✓ Loaded ${lineCount} river segments`);
    } catch (e) {
      console.warn('[WaterOverlay] Failed to load rivers:', e.message);
    }
  }

  /**
   * Fetch and render lakes as filled polygons on the globe
   */
  async _loadLakes() {
    try {
      console.log('[WaterOverlay] Fetching Natural Earth lakes...');
      const res = await fetch(LAKES_URL);
      const geojson = await res.json();

      const lakeMaterial = new THREE.MeshBasicMaterial({
        color: 0x1565c0,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      let lakeCount = 0;

      for (const feature of geojson.features) {
        const polygons = this._extractPolygonCoords(feature.geometry);
        if (!polygons) continue;

        for (const ring of polygons) {
          if (ring.length < 4) continue;

          // Create 3D points for the polygon outline on the sphere
          const points3D = ring.map(([lon, lat]) => this._geoToVec3(lon, lat));

          // Triangulate using fan from centroid approach
          const shape = this._triangulateSphericalPolygon(points3D);
          if (!shape) continue;

          const mesh = new THREE.Mesh(shape, lakeMaterial);
          this.group.add(mesh);
          lakeCount++;
        }
      }

      console.log(`[WaterOverlay] ✓ Loaded ${lakeCount} lakes`);
    } catch (e) {
      console.warn('[WaterOverlay] Failed to load lakes:', e.message);
    }
  }

  /**
   * Extract line coordinates from GeoJSON geometry
   * Handles LineString and MultiLineString
   */
  _extractLineCoords(geometry) {
    if (geometry.type === 'LineString') {
      return [geometry.coordinates];
    }
    if (geometry.type === 'MultiLineString') {
      return geometry.coordinates;
    }
    return null;
  }

  /**
   * Extract polygon coordinates from GeoJSON geometry
   * Handles Polygon and MultiPolygon (outer rings only)
   */
  _extractPolygonCoords(geometry) {
    if (geometry.type === 'Polygon') {
      return [geometry.coordinates[0]]; // outer ring only
    }
    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.map(poly => poly[0]); // outer rings
    }
    return null;
  }

  /**
   * Triangulate a spherical polygon using fan triangulation from centroid
   * Works well for convex and mildly concave lake shapes
   */
  _triangulateSphericalPolygon(points3D) {
    if (points3D.length < 3) return null;

    // Calculate centroid
    const centroid = new THREE.Vector3();
    for (const p of points3D) {
      centroid.add(p);
    }
    centroid.divideScalar(points3D.length);
    // Project centroid onto sphere surface
    centroid.normalize().multiplyScalar(WGS84.SCENE_RADIUS * 1.003);

    const vertices = [];
    const n = points3D.length;

    for (let i = 0; i < n - 1; i++) {
      // Triangle: centroid → point[i] → point[i+1]
      vertices.push(centroid.x, centroid.y, centroid.z);
      vertices.push(points3D[i].x, points3D[i].y, points3D[i].z);
      vertices.push(points3D[i + 1].x, points3D[i + 1].y, points3D[i + 1].z);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.computeVertexNormals();
    return geom;
  }

  update(time, sunDirection) {
    // Rivers and lakes are static geometry; no per-frame update needed
  }
}
