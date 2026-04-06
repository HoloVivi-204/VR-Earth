import * as THREE from 'three';
import { WGS84 } from '../core/constants.js';

const SUN_DISTANCE = WGS84.SCENE_RADIUS * 80;
const SUN_RADIUS = WGS84.SCENE_RADIUS * 3.2;

export class Sun {
  constructor() {
    this.group = new THREE.Group();
    this._build();
  }

  _build() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255,252,244,1)');
    gradient.addColorStop(0.24, 'rgba(255,244,210,0.98)');
    gradient.addColorStop(0.56, 'rgba(255,220,150,0.55)');
    gradient.addColorStop(1, 'rgba(255,175,80,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);

    this.core = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.core.scale.setScalar(SUN_RADIUS * 2.1);
    this.group.add(this.core);

    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.halo.scale.setScalar(SUN_RADIUS * 4.6);
    this.group.add(this.halo);
  }

  update(sunDirection) {
    this.group.position.copy(sunDirection).multiplyScalar(SUN_DISTANCE);
  }
}
