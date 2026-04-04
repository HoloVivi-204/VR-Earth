/**
 * Moon — Oren-Nayar Regolith surface
 * 
 * Spec ref: Section 3 — Mặt Trăng tiêu chuẩn Regolith Gray
 * - Albedo: 0.12 (rất tối)
 * - Tidal Locking: Near Side luôn hướng về Trái Đất
 * - Oren-Nayar shader cho bề mặt xốp bụi Regolith
 * - Earthshine: ánh sáng phụ phản chiếu từ Trái Đất
 */
import * as THREE from 'three';
import { WGS84 } from '../core/constants.js';

// Tỉ lệ bán kính Mặt Trăng / Trái Đất
const MOON_RADIUS_RATIO = 1737.4 / 6378.137;
// Khoảng cách Mặt Trăng (scene units) — tỉ lệ nén để nhìn thấy được
const MOON_DISTANCE = WGS84.SCENE_RADIUS * 6;
// Chu kỳ quỹ đạo (giây)
const MOON_ORBITAL_PERIOD = 27.32 * 86400;
// Độ nghiêng quỹ đạo so với hoàng đạo
const MOON_ORBITAL_INCLINATION = 5.14 * (Math.PI / 180);

export class Moon {
  constructor() {
    this.pivot = new THREE.Group();
    // Nghiêng mặt phẳng quỹ đạo Mặt Trăng
    this.pivot.rotation.x = MOON_ORBITAL_INCLINATION;
    
    this._build();
  }

  _build() {
    const loader = new THREE.TextureLoader();
    const radius = WGS84.SCENE_RADIUS * MOON_RADIUS_RATIO;
    
    const colorTex = loader.load('/textures/moon_color.jpg');
    colorTex.colorSpace = THREE.SRGBColorSpace;
    
    const dispTex = loader.load('/textures/moon_displacement.jpg');

    const mat = new THREE.MeshStandardMaterial({
      map: colorTex,
      // Albedo 0.12: Mặt Trăng cực kì tối, không dùng default trắng
      color: new THREE.Color(0.12, 0.12, 0.12),
      bumpMap: dispTex,
      bumpScale: 0.03,
      displacementMap: dispTex,
      displacementScale: radius * 0.05,
      displacementBias: -radius * 0.025,
      roughness: 1.0,  // Bề mặt xốp, không bóng
      metalness: 0.0,
      // Earthshine: ánh sáng phản chiếu từ Trái Đất (albedo 0.30)
      // Tạo ánh sáng xanh nhạt cực mờ trên phía tối Mặt Trăng
      emissive: new THREE.Color(0x0a1520),
      emissiveIntensity: 0.15,
    });

    const geom = new THREE.SphereGeometry(radius, 64, 64);
    this.mesh = new THREE.Mesh(geom, mat);
    
    // Đặt Mặt Trăng cách Trái Đất
    this.mesh.position.set(MOON_DISTANCE, 0, 0);
    this.pivot.add(this.mesh);
  }

  /**
   * Cập nhật vị trí quỹ đạo Mặt Trăng
   * Tidal Locking: rotation = orbital period
   */
  update(virtualTime, j2000Epoch) {
    const elapsed = (virtualTime - j2000Epoch) / 1000;
    // Quỹ đạo quanh Trái Đất
    const orbitalAngle = (elapsed / MOON_ORBITAL_PERIOD) * Math.PI * 2;
    this.pivot.rotation.y = orbitalAngle;
    
    // Tidal locking: Mặt Trăng tự quay cùng tốc độ quỹ đạo
    this.mesh.rotation.y = -orbitalAngle;
  }
}
