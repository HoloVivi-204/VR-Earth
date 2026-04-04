/**
 * Sun — Visible Spectrum (4500Å HMI)
 *
 * Spec ref: Section 4 — Mặt Trời tiêu chuẩn Visible Spectrum
 * - Nhiệt độ màu: 5,778K → trắng/vàng nhạt
 * - Limb Darkening: vùng rìa tối hơn tâm
 * - LensFlare + Corona glow
 * - ACES Filmic Tone Mapping giữ chi tiết vùng sáng
 */
import * as THREE from 'three';
import { WGS84 } from '../core/constants.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';

// Khoảng cách Mặt Trời (scene units) — nén tỉ lệ để nhìn thấy
const SUN_DISTANCE = WGS84.SCENE_RADIUS * 80;
const SUN_RADIUS = WGS84.SCENE_RADIUS * 3;

export class Sun {
  constructor() {
    this.group = new THREE.Group();
    this._build();
  }

  _build() {
    // Mặt Trời: phát sáng tự thân (emissive), không nhận ánh sáng
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xfff5e0,
    });

    // Limb Darkening shader overlay
    sunMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         // Limb Darkening: vùng rìa tối dần
         vec3 viewDir = normalize(vViewPosition);
         vec3 norm = normalize(vNormal);
         float mu = abs(dot(norm, viewDir));
         // Darkening law chuẩn thiên văn
         float limb = 0.3 + 0.7 * pow(mu, 0.4);
         diffuseColor.rgb *= limb;
        `
      );
    };

    const geom = new THREE.SphereGeometry(SUN_RADIUS, 48, 48);
    this.mesh = new THREE.Mesh(geom, sunMat);
    this.group.add(this.mesh);

    // Corona glow (sprite lớn bao quanh)
    const coronaCanvas = document.createElement('canvas');
    coronaCanvas.width = 256;
    coronaCanvas.height = 256;
    const ctx = coronaCanvas.getContext('2d');
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 245, 220, 0.8)');
    gradient.addColorStop(0.2, 'rgba(255, 230, 180, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 200, 100, 0.08)');
    gradient.addColorStop(1, 'rgba(255, 180, 50, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    const coronaTex = new THREE.CanvasTexture(coronaCanvas);
    const corona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: coronaTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    corona.scale.set(SUN_RADIUS * 8, SUN_RADIUS * 8, 1);
    this.group.add(corona);

    // LensFlare
    this._addLensFlare();
  }

  _addLensFlare() {
    const flareCanvas = document.createElement('canvas');
    flareCanvas.width = 64;
    flareCanvas.height = 64;
    const ctx = flareCanvas.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    g.addColorStop(0.3, 'rgba(255, 240, 200, 0.6)');
    g.addColorStop(1, 'rgba(255, 200, 50, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const flareTex = new THREE.CanvasTexture(flareCanvas);

    const lensflare = new Lensflare();
    lensflare.addElement(new LensflareElement(flareTex, 300, 0, new THREE.Color(0xfff8f0)));
    lensflare.addElement(new LensflareElement(flareTex, 60, 0.6, new THREE.Color(0xffd080)));
    lensflare.addElement(new LensflareElement(flareTex, 40, 0.8, new THREE.Color(0xff8040)));
    this.group.add(lensflare);
  }

  /**
   * Cập nhật vị trí Mặt Trời theo hướng tính từ Kepler
   */
  update(sunDirection) {
    this.group.position.copy(sunDirection).multiplyScalar(SUN_DISTANCE);
  }
}
