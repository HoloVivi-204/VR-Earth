/**
 * Earth — Full Natural Mode rendering
 *
 * Spec ref: Section 1 — True View
 * - PBR with correct albedo (0.30)
 * - Night Lights (earth_night.jpg) blend on dark side
 * - Rayleigh atmosphere glow (blue rim)
 * - Water Mask roughness (ocean glossy, land matte)
 * - Displacement (Bathymetry) + Bump (Topography)
 */
import * as THREE from 'three';
import { WGS84, EARTH_SIDEREAL_DAY, EARTH_AXIAL_TILT, J2000_EPOCH, QUALITY } from '../core/constants.js';

export class Earth {
  constructor() {
    this.group = new THREE.Group();
    this._buildSurface();
    this._buildAtmosphere();
    this.group.rotation.z = EARTH_AXIAL_TILT;
  }

  _buildSurface() {
    const loader = new THREE.TextureLoader();

    const texture = loader.load('/textures/earth_color_01.jpg');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;

    const nightTex = loader.load('/textures/earth_night.jpg');
    nightTex.colorSpace = THREE.SRGBColorSpace;

    const topo = loader.load('/textures/earth_topography.jpg');
    const bathy = loader.load('/textures/earth_Bathymetry.jpg');

    // PBR Material with albedo 0.30 (spec 1.3)
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      bumpMap: topo,
      bumpScale: 0.06,
      displacementMap: bathy,
      displacementScale: 0.1,
      displacementBias: -0.05,
      roughness: 0.85,
      metalness: 0.0,
    });

    // Custom shader: Night Lights + Water Roughness
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uNightTex = { value: nightTex };
      shader.uniforms.uBathyTex = { value: bathy };
      shader.uniforms.uSunDir = { value: new THREE.Vector3(1, 0, 0) };
      shader.uniforms.uNightLightsEnabled = { value: 1.0 };

      // Vertex: pass world normal to fragment
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldNormal;
         varying vec2 vMapUv2;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
         vMapUv2 = uv;`
      );

      // Fragment: Night Lights on dark side + Water roughness
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         uniform sampler2D uNightTex;
         uniform sampler2D uBathyTex;
         uniform vec3 uSunDir;
         uniform float uNightLightsEnabled;
         varying vec3 vWorldNormal;
         varying vec2 vMapUv2;`
      );

      // Inject after lighting calc
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `// Night Lights: blend city lights on dark hemisphere
         float sunDot = dot(normalize(vWorldNormal), normalize(uSunDir));
         float nightFactor = smoothstep(0.0, -0.15, sunDot);
         vec3 nightColor = texture2D(uNightTex, vMapUv2).rgb;
         // Warm city glow
         gl_FragColor.rgb += nightColor * nightFactor * 1.5 * uNightLightsEnabled;

         #include <dithering_fragment>`
      );

      // Roughness: make ocean glossy, land matte
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         float waterMask = texture2D(uBathyTex, vMapUv2).r;
         // Dark bathymetry = deep ocean = glossy (low roughness)
         // Bright bathymetry = land = matte (high roughness)
         float oceanGloss = smoothstep(0.4, 0.1, waterMask);
         roughnessFactor = mix(0.85, 0.08, oceanGloss);`
      );

      this._shader = shader;
    };

    const geom = new THREE.SphereGeometry(WGS84.SCENE_RADIUS, 300, 300);
    geom.scale(1, WGS84.POLAR_SCALE, 1);

    this.surfaceMesh = new THREE.Mesh(geom, mat);
    this.group.add(this.surfaceMesh);
  }

  /**
   * Rayleigh Atmosphere — thin blue glow around Earth rim
   * Spec ref: Section 1.5
   */
  _buildAtmosphere() {
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */`
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uSunDir;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 norm = normalize(vWorldNormal);

          // Fresnel rim: glow strongest at edges
          float rim = 1.0 - max(0.0, dot(viewDir, norm));
          rim = pow(rim, 3.0);

          // Rayleigh: blue wavelength dominates at rim
          // λ_blue ≈ 450nm, λ_red ≈ 700nm → 1/λ⁴ ratio
          vec3 rayleighColor = vec3(0.15, 0.4, 1.0);

          // Sun illumination on atmosphere
          float sunFactor = max(0.0, dot(norm, normalize(uSunDir)));
          sunFactor = 0.3 + 0.7 * sunFactor; // Some glow even on dark side

          // Mie: forward scattering (halo around the sun)
          float viewSunDot = dot(viewDir, normalize(uSunDir));
          float mie = pow(max(0.0, viewSunDot), 30.0); // sharp highlight
          vec3 mieColor = vec3(1.0, 0.95, 0.85) * mie * sunFactor;

          float alpha = rim * 0.6 * sunFactor + (mie * 0.4);
          vec3 color = rayleighColor * sunFactor + mieColor;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      uniforms: {
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
    });

    const atmosGeom = new THREE.SphereGeometry(WGS84.SCENE_RADIUS * 1.025, 64, 64);
    atmosGeom.scale(1, WGS84.POLAR_SCALE, 1);
    this.atmosphereMesh = new THREE.Mesh(atmosGeom, atmosMat);
    this.group.add(this.atmosphereMesh);
  }

  update(virtualTime) {
    const s = (virtualTime - J2000_EPOCH) / 1000;
    this.surfaceMesh.rotation.y = (s / EARTH_SIDEREAL_DAY) * Math.PI * 2;
  }

  setSunDirection(dir) {
    // Update night lights & atmosphere shader sun direction
    if (this._shader) {
      this._shader.uniforms.uSunDir.value.copy(dir);
    }
    if (this.atmosphereMesh) {
      this.atmosphereMesh.material.uniforms.uSunDir.value.copy(dir);
    }
  }

  setNightLights(enabled) {
    if (this._shader) {
      this._shader.uniforms.uNightLightsEnabled.value = enabled ? 1.0 : 0.0;
    }
  }

  setMaxAnisotropy(renderer) {
    if (this.surfaceMesh.material.map) {
      this.surfaceMesh.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }
  }
}
