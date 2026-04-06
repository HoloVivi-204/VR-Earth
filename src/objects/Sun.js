import * as THREE from 'three';
import { QUALITY, WGS84 } from '../core/constants.js';

const SUN_DISTANCE = WGS84.SCENE_RADIUS * 80;
const SUN_RADIUS = WGS84.SCENE_RADIUS * 2.6;

export class Sun {
  constructor() {
    this.group = new THREE.Group();
    this._build();
  }

  _build() {
    const geometry = new THREE.SphereGeometry(SUN_RADIUS, QUALITY.SUN_SEGMENTS, QUALITY.SUN_SEGMENTS);
    const material = new THREE.MeshBasicMaterial({ color: 0xfff4de });
    this.mesh = new THREE.Mesh(geometry, material);
    this.group.add(this.mesh);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,246,224,0.85)');
    gradient.addColorStop(0.35, 'rgba(255,220,150,0.3)');
    gradient.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    corona.scale.setScalar(SUN_RADIUS * 7);
    this.group.add(corona);
  }

  update(sunDirection) {
    this.group.position.copy(sunDirection).multiplyScalar(SUN_DISTANCE);
  }
}
