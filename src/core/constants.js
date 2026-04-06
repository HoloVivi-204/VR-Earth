/**
 * Digital Earth — Physical Constants & Configuration
 * All values derived from spec: digital_earth_spec.md
 */

// WGS84 Ellipsoid
export const WGS84 = {
  EQUATORIAL_RADIUS: 6378137,
  POLAR_RADIUS: 6356752,
  FLATTENING: 1 / 298.257,
  SCENE_RADIUS: 10,
  get POLAR_SCALE() {
    return this.POLAR_RADIUS / this.EQUATORIAL_RADIUS;
  }
};

// Rotation
export const EARTH_SIDEREAL_DAY = 86164.09;
export const EARTH_AXIAL_TILT = 23.44 * (Math.PI / 180);
export const J2000_EPOCH = Date.UTC(2000, 0, 1, 12, 0, 0);

// Colors (hex integers for Three.js)
export const COLORS = {
  SPACE_BLACK: 0x000000,
  EARTH_PLACEHOLDER: 0x000044,
  MOON_PLACEHOLDER: 0x3A3A3A,
  ADMIN_BG: 0x050A14,
  ADMIN_BORDER: 0x00FFAA,
};

// Camera
export const CAMERA = {
  FOV: 75,
  NEAR: 0.01,
  FAR: 100000,
  ISS_DISTANCE: WGS84.SCENE_RADIUS * 1.25,
  ZOOM_MIN: WGS84.SCENE_RADIUS * 1.02,
  ZOOM_MAX: 500,
};

// Quality presets
export const QUALITY = {
  EARTH_SEGMENTS: 128,
  CLOUD_SEGMENTS: 64,
  ATMOSPHERE_SEGMENTS: 48,
  MOON_SEGMENTS: 36,
  SUN_SEGMENTS: 32,
  PIXEL_RATIO_DESKTOP: 1.5,
  PIXEL_RATIO_VR: 1.0,
};
