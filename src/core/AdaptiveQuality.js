/**
 * Adaptive Quality Manager
 * Monitors FPS and adjusts render quality for Desktop vs VR.
 */
import { QUALITY } from './constants.js';

export class AdaptiveQuality {
  constructor(renderer) {
    this.renderer = renderer;
    this.isVR = false;
    this.frames = 0;
    this.lastTime = performance.now();
    this.currentFPS = 60;
    this.qualityLevel = 2; // 0=low, 1=med, 2=high
    this.callbacks = [];

    renderer.xr.addEventListener('sessionstart', () => {
      this.isVR = true;
      this._applyVRQuality();
    });

    renderer.xr.addEventListener('sessionend', () => {
      this.isVR = false;
      this._applyDesktopQuality();
    });
  }

  onQualityChange(cb) { this.callbacks.push(cb); }

  update() {
    this.frames++;
    const now = performance.now();
    const delta = now - this.lastTime;

    if (delta >= 1000) {
      this.currentFPS = Math.round((this.frames * 1000) / delta);
      this.frames = 0;
      this.lastTime = now;

      const threshold = this.isVR ? 68 : 55;
      if (this.currentFPS < threshold && this.qualityLevel > 0) {
        this.qualityLevel--;
        this._notifyChange();
      }
    }
  }

  get shadowMapSize() {
    const base = this.isVR ? QUALITY.SHADOW_VR : QUALITY.SHADOW_DESKTOP;
    return base >> (2 - this.qualityLevel);
  }

  get earthSegments() {
    const base = this.isVR ? QUALITY.SEGMENTS_VR : QUALITY.SEGMENTS_DESKTOP;
    return Math.max(64, base - (2 - this.qualityLevel) * 40);
  }

  _applyVRQuality() {
    this.qualityLevel = 2;
    this._notifyChange();
  }

  _applyDesktopQuality() {
    this.qualityLevel = 2;
    this._notifyChange();
  }

  _notifyChange() {
    this.callbacks.forEach(cb => cb(this));
  }
}
