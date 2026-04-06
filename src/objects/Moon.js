import * as THREE from 'three';
import { QUALITY, WGS84 } from '../core/constants.js';

const MOON_RADIUS_RATIO = 1737.4 / 6378.137;
const MOON_DISTANCE = WGS84.SCENE_RADIUS * 6;
const MOON_ORBITAL_PERIOD = 27.32 * 86400;
const MOON_ORBITAL_INCLINATION = 5.14 * (Math.PI / 180);

export class Moon {
  constructor() {
    this.pivot = new THREE.Group();
    this.pivot.rotation.x = MOON_ORBITAL_INCLINATION;
    this._build();
  }

  _build() {
    const loader = new THREE.TextureLoader();
    const radius = WGS84.SCENE_RADIUS * MOON_RADIUS_RATIO;
    const colorTex = loader.load('/textures/moon_color.jpg');
    colorTex.colorSpace = THREE.SRGBColorSpace;
    const bumpTex = loader.load('/textures/moon_displacement.jpg');

    const geometry = new THREE.SphereGeometry(radius, QUALITY.MOON_SEGMENTS, QUALITY.MOON_SEGMENTS);
    const material = new THREE.MeshStandardMaterial({
      map: colorTex,
      color: new THREE.Color(0.3, 0.3, 0.3),
      bumpMap: bumpTex,
      bumpScale: 0.03,
      roughness: 0.95,
      metalness: 0,
      emissive: new THREE.Color(0x10161d),
      emissiveIntensity: 0.18,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(MOON_DISTANCE, 0, 0);
    this.pivot.add(this.mesh);
  }

  update(virtualTime, j2000Epoch) {
    const elapsed = (virtualTime - j2000Epoch) / 1000;
    const orbitalAngle = (elapsed / MOON_ORBITAL_PERIOD) * Math.PI * 2;
    this.pivot.rotation.y = orbitalAngle;
    this.mesh.rotation.y = -orbitalAngle;
  }
}
