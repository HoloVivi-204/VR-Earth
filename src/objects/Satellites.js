/**
 * Satellites — Fake orbital generation for ISS, Starlink, GPS
 * Spec ref: Section 2.6
 */
import * as THREE from 'three';
import { WGS84 } from '../core/constants.js';

export class Satellites {
  constructor() {
    this.group = new THREE.Group();
    
    // Config: orbits
    const ISS_ALT = WGS84.SCENE_RADIUS * 1.063; // ~400km
    const STARLINK_ALT = WGS84.SCENE_RADIUS * 1.086; // ~550km
    const GPS_ALT = WGS84.SCENE_RADIUS * 4.1; // ~20,000km

    // ISS (1 vệ tinh, màu cam/đỏ)
    this.iss = this._buildSwarm(1, ISS_ALT, 0xffaa00, 0.05, 0.005);
    
    // Starlink (nhiều vệ tinh bay thấp, màu trắng)
    this.starlinks = this._buildSwarm(200, STARLINK_ALT, 0xffffff, 0.015, 0.002);
    
    // GPS (ít vệ tinh bay cao, màu xanh lá)
    this.gps = this._buildSwarm(24, GPS_ALT, 0x00ffaa, 0.08, 0.0005);

    this.group.add(this.iss.system, this.starlinks.system, this.gps.system);
  }

  _buildSwarm(count, radius, color, size, speed) {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const orbitData = []; // To compute positions in update()

    for (let i = 0; i < count; i++) {
      // Random orbit parameters
      const inclination = Math.random() * Math.PI;
      const ascNode = Math.random() * Math.PI * 2;
      const trueAnomaly = Math.random() * Math.PI * 2;

      orbitData.push({
        inc: inclination, // Inclination
        asc: ascNode,     // Longitude of ascending node
        nu: trueAnomaly,  // Current angle
        speed: speed * (0.8 + Math.random() * 0.4), // slight speed variance
        radius: radius
      });
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Dùng texture tròn mềm mịn
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,16,16);
    const tex = new THREE.CanvasTexture(canvas);

    const mat = new THREE.PointsMaterial({
      color: color,
      size: size,
      map: tex,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const system = new THREE.Points(geom, mat);

    return { system, orbitData };
  }

  update(virtualTime) {
    // virtualTime is in ms, we need a small delta factor
    const timeSec = virtualTime / 1000;

    [this.iss, this.starlinks, this.gps].forEach(swarm => {
      const positions = swarm.system.geometry.attributes.position.array;
      const data = swarm.orbitData;

      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        d.nu += d.speed; // Move along orbit

        // Calculate 3D position from orbital elements (assuming circular)
        const x = d.radius * (Math.cos(d.asc) * Math.cos(d.nu) - Math.sin(d.asc) * Math.sin(d.nu) * Math.cos(d.inc));
        const y = d.radius * (Math.sin(d.nu) * Math.sin(d.inc));
        const z = d.radius * (Math.sin(d.asc) * Math.cos(d.nu) + Math.cos(d.asc) * Math.sin(d.nu) * Math.cos(d.inc));

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
      }
      swarm.system.geometry.attributes.position.needsUpdate = true;
    });
  }
}
