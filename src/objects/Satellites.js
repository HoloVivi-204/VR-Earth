import * as THREE from 'three';
import { WGS84 } from '../core/constants.js';

export class Satellites {
  constructor() {
    this.group = new THREE.Group();

    this.iss = this._buildSwarm(1, WGS84.SCENE_RADIUS * 1.065, 0xffb347, 0.055, 0.007);
    this.starlinks = this._buildSwarm(24, WGS84.SCENE_RADIUS * 1.09, 0xffffff, 0.022, 0.0024);
    this.gps = this._buildSwarm(8, WGS84.SCENE_RADIUS * 3.8, 0x4dffd2, 0.07, 0.0008);

    this.group.add(this.iss.system, this.starlinks.system, this.gps.system);
  }

  _buildSwarm(count, radius, color, size, speed) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const orbitData = [];

    for (let index = 0; index < count; index++) {
      orbitData.push({
        inc: Math.random() * Math.PI,
        asc: Math.random() * Math.PI * 2,
        nu: Math.random() * Math.PI * 2,
        speed: speed * (0.8 + Math.random() * 0.4),
        radius,
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 16, 16);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.PointsMaterial({
      color,
      size,
      map: texture,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });

    return {
      system: new THREE.Points(geometry, material),
      orbitData,
    };
  }

  update() {
    [this.iss, this.starlinks, this.gps].forEach((swarm) => {
      const positions = swarm.system.geometry.attributes.position.array;

      for (let index = 0; index < swarm.orbitData.length; index++) {
        const orbit = swarm.orbitData[index];
        orbit.nu += orbit.speed;

        const x = orbit.radius * (
          Math.cos(orbit.asc) * Math.cos(orbit.nu) -
          Math.sin(orbit.asc) * Math.sin(orbit.nu) * Math.cos(orbit.inc)
        );
        const y = orbit.radius * Math.sin(orbit.nu) * Math.sin(orbit.inc);
        const z = orbit.radius * (
          Math.sin(orbit.asc) * Math.cos(orbit.nu) +
          Math.cos(orbit.asc) * Math.sin(orbit.nu) * Math.cos(orbit.inc)
        );

        const offset = index * 3;
        positions[offset] = x;
        positions[offset + 1] = y;
        positions[offset + 2] = z;
      }

      swarm.system.geometry.attributes.position.needsUpdate = true;
    });
  }
}
