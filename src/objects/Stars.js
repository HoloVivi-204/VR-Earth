/**
 * Stars — Procedural background star field
 */
import * as THREE from 'three';

export function createStarField(count = 6000) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 4000 + Math.random() * 4000;
    const i3 = i * 3;

    positions[i3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);

    // Slightly varied star colors — white to warm yellow to cool blue
    const temp = Math.random();
    if (temp < 0.7) {
      colors[i3] = 0.9 + Math.random() * 0.1;
      colors[i3+1] = 0.9 + Math.random() * 0.1;
      colors[i3+2] = 0.95 + Math.random() * 0.05;
    } else if (temp < 0.85) {
      colors[i3] = 1.0;
      colors[i3+1] = 0.85 + Math.random() * 0.1;
      colors[i3+2] = 0.6 + Math.random() * 0.2;
    } else {
      colors[i3] = 0.6 + Math.random() * 0.2;
      colors[i3+1] = 0.7 + Math.random() * 0.2;
      colors[i3+2] = 1.0;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.2,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}
