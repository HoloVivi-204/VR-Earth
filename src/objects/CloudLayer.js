import * as THREE from 'three';
import { QUALITY, WGS84 } from '../core/constants.js';

export class CloudLayer {
  constructor() {
    this.mesh = new THREE.Group();

    const geometry = new THREE.SphereGeometry(
      WGS84.SCENE_RADIUS * 1.006,
      QUALITY.CLOUD_SEGMENTS,
      QUALITY.CLOUD_SEGMENTS
    );
    geometry.scale(1, WGS84.POLAR_SCALE, 1);

    const loader = new THREE.TextureLoader();
    const cloudTex = loader.load('/textures/earth_clouds.jpg');
    cloudTex.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshStandardMaterial({
      map: cloudTex,
      alphaMap: cloudTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    });

    this.cloudSphere = new THREE.Mesh(geometry, material);
    this.mesh.add(this.cloudSphere);
  }

  update(time) {
    this.cloudSphere.rotation.y = time * 0.00004;
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }
}
