/**
 * CloudLayer — Static High-Res Texture Layer
 *
 * Uses a downloaded equirectangular cloud map (JPG or PNG).
 * Replaces the buggy GIBS API fetch with a clean, performant rotating sphere.
 */
import * as THREE from 'three';
import { WGS84 } from '../core/constants.js';

export class CloudLayer {
  constructor() {
    this.mesh = new THREE.Group(); // Wrapper to match previous API if needed
    
    // Create the cloud sphere slightly larger than the Earth
    // Scene radius * 1.006 is roughly 38km altitude, perfect for clouds
    const radius = WGS84.SCENE_RADIUS * 1.006;
    const geom = new THREE.SphereGeometry(radius, 128, 128);
    geom.scale(1, WGS84.POLAR_SCALE, 1);

    const loader = new THREE.TextureLoader();
    
    /* 
     * HƯỚNG DẪN: 
     * Bạn tải file earth_clouds.jpg (gợi ý từ Solar System Scope) 
     * và thả vào thư mục /textures/ của dự án nhé.
     */
    const cloudTex = loader.load('/textures/earth_clouds.jpg');
    cloudTex.colorSpace = THREE.SRGBColorSpace;
    cloudTex.anisotropy = 16;

    const mat = new THREE.MeshStandardMaterial({
      map: cloudTex,
      alphaMap: cloudTex,   // Dùng chính ảnh mây làm alpha (đen = trong suốt, màu trắng = hiện mây)
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,    // Rất quan trọng để không dính z-fighting với nước/đất
      opacity: 0.85,        // Giảm một chút để nhìn xuyên xuống địa hình
      roughness: 1.0,       // Mây tán xạ ánh sáng, không chói lóa
      metalness: 0.0,
    });

    this.cloudSphere = new THREE.Mesh(geom, mat);
    
    // Bóng đổ mây xuống mặt đất
    this.cloudSphere.castShadow = true;
    this.cloudSphere.receiveShadow = true;
    
    this.mesh.add(this.cloudSphere);
  }

  /**
   * Cập nhật vòng lặp
   * @param {number} time - virtual time tính theo milli-seconds hoặc seconds
   * @param {THREE.Vector3} sunDir - vector hướng sáng (nếu cần cho custom shader sau này)
   */
  update(time, sunDir) {
    // Để mây tự trôi chầm chậm so với mặt đất (xoay độc lập một chút)
    // Giả sử mây trôi nhanh hơn Trái Đất một chút (super-rotation)
    if (this.cloudSphere) {
      // time truyền vào từ main.js đang là virtualTime / 1000 (giây)
      // Nhân với tốc độ drift nhỏ để mây trôi nhẹ
      this.cloudSphere.rotation.y = time * 0.00005; 
    }
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }
}
