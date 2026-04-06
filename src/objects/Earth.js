import * as THREE from 'three';
import {
  EARTH_AXIAL_TILT,
  EARTH_SIDEREAL_DAY,
  J2000_EPOCH,
  QUALITY,
  WGS84,
} from '../core/constants.js';

export class Earth {
  constructor() {
    this.group = new THREE.Group();
    this.surfaceRoot = new THREE.Group();
    this.group.rotation.z = EARTH_AXIAL_TILT;
    this.group.add(this.surfaceRoot);
    this._buildSurface();
    this._buildAtmosphere();
  }

  _buildSurface() {
    const loader = new THREE.TextureLoader();
    const texture = loader.load('/textures/earth_color_01.jpg');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const nightTex = loader.load('/textures/earth_night.jpg');
    nightTex.colorSpace = THREE.SRGBColorSpace;

    const topo = loader.load('/textures/earth_topography.jpg');
    const bathy = loader.load('/textures/earth_Bathymetry.jpg');

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      bumpMap: topo,
      bumpScale: 0.07,
      roughness: 0.9,
      metalness: 0,
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uNightTex = { value: nightTex };
      shader.uniforms.uBathyTex = { value: bathy };
      shader.uniforms.uSunDir = { value: new THREE.Vector3(1, 0, 0) };
      shader.uniforms.uNightLightsEnabled = { value: 1 };

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

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         float bathyMask = texture2D(uBathyTex, vMapUv2).r;
         float oceanMask = smoothstep(0.45, 0.12, bathyMask);
         roughnessFactor = mix(0.9, 0.28, oceanMask);`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `float sunDot = dot(normalize(vWorldNormal), normalize(uSunDir));
         float daylightLift = smoothstep(-0.75, 0.35, sunDot) * 0.18;
         gl_FragColor.rgb += gl_FragColor.rgb * daylightLift;
         float nightFactor = smoothstep(0.05, -0.28, sunDot);
         vec3 nightColor = texture2D(uNightTex, vMapUv2).rgb;
         gl_FragColor.rgb += nightColor * nightFactor * 1.45 * uNightLightsEnabled;

         #include <dithering_fragment>`
      );

      this._shader = shader;
    };

    const geometry = new THREE.SphereGeometry(
      WGS84.SCENE_RADIUS,
      QUALITY.EARTH_SEGMENTS,
      QUALITY.EARTH_SEGMENTS
    );
    geometry.scale(1, WGS84.POLAR_SCALE, 1);

    this.surfaceMesh = new THREE.Mesh(geometry, material);
    this.surfaceRoot.add(this.surfaceMesh);
  }

  _buildAtmosphere() {
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;

        void main() {
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 norm = normalize(vWorldNormal);
          float rim = pow(1.0 - max(0.0, dot(viewDir, norm)), 2.1);
          float sunFactor = 0.45 + 0.55 * max(0.0, dot(norm, normalize(uSunDir)));
          vec3 color = vec3(0.2, 0.48, 1.0) * sunFactor;
          gl_FragColor = vec4(color, rim * 0.62 * sunFactor);
        }
      `,
      uniforms: {
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      },
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
    });

    const geometry = new THREE.SphereGeometry(
      WGS84.SCENE_RADIUS * 1.024,
      QUALITY.ATMOSPHERE_SEGMENTS,
      QUALITY.ATMOSPHERE_SEGMENTS
    );
    geometry.scale(1, WGS84.POLAR_SCALE, 1);

    this.atmosphereMesh = new THREE.Mesh(geometry, material);
    this.surfaceRoot.add(this.atmosphereMesh);
  }

  update(virtualTime) {
    const elapsed = (virtualTime - J2000_EPOCH) / 1000;
    this.surfaceRoot.rotation.y = (elapsed / EARTH_SIDEREAL_DAY) * Math.PI * 2;
  }

  setSunDirection(dir) {
    if (this._shader) {
      this._shader.uniforms.uSunDir.value.copy(dir);
    }
    this.atmosphereMesh.material.uniforms.uSunDir.value.copy(dir);
  }

  setNightLights(enabled) {
    if (this._shader) {
      this._shader.uniforms.uNightLightsEnabled.value = enabled ? 1 : 0;
    }
  }

  setMaxAnisotropy(renderer) {
    const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    this.surfaceMesh.material.map.anisotropy = anisotropy;
  }
}
