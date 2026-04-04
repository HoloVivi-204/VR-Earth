/**
 * NavigationControls — Camera orbit, zoom, on-screen buttons, keyboard
 *
 * Camera orbits around a target (Earth center) using spherical coordinates.
 * On-screen buttons: hold → accelerate orbit/zoom, release → stop.
 * Mouse: drag to orbit, scroll to zoom.
 * Keyboard: M = mode toggle (emits event).
 */
import * as THREE from 'three';
import { CAMERA, WGS84 } from '../core/constants.js';

export class NavigationControls {
  constructor(camera, domElement, target = new THREE.Vector3()) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = target;

    // Spherical coordinates (radius, polar phi, azimuthal theta)
    this.spherical = new THREE.Spherical();
    this._fromCameraPosition();

    // Input state
    this._dragging = false;
    this._lastMouse = { x: 0, y: 0 };
    this._activeDir = null;
    this._holdTime = 0;

    // Limits
    this.minDistance = CAMERA.ZOOM_MIN;
    this.maxDistance = CAMERA.ZOOM_MAX;
    this.rotateSpeed = 0.004;
    this.orbitSpeed = 0.6;
    this.zoomSpeed = 0.08;
    this.orbitAccel = 1.8;
    this.maxOrbitSpeed = 3.0;

    // Callbacks
    this.onModeToggle = null;

    this._bindMouseEvents();
    this._bindKeyboardEvents();
    this._bindNavButtons();
  }

  /* ---- Sync spherical from current camera ---- */
  _fromCameraPosition() {
    const offset = this.camera.position.clone().sub(this.target);
    this.spherical.setFromVector3(offset);
  }

  /* ---- Apply spherical back to camera ---- */
  _applyPosition() {
    const offset = new THREE.Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }

  /* ---- Mouse events ---- */
  _bindMouseEvents() {
    const el = this.domElement;

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this._dragging = true;
      this._lastMouse.x = e.clientX;
      this._lastMouse.y = e.clientY;
      el.style.cursor = 'grabbing';
    });

    el.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastMouse.x;
      const dy = e.clientY - this._lastMouse.y;
      this._lastMouse.x = e.clientX;
      this._lastMouse.y = e.clientY;

      this.spherical.theta -= dx * this.rotateSpeed;
      this.spherical.phi -= dy * this.rotateSpeed;
      this._clampPhi();
      this._applyPosition();
    });

    el.addEventListener('pointerup', () => {
      this._dragging = false;
      el.style.cursor = 'grab';
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = 1 + Math.sign(e.deltaY) * this.zoomSpeed;
      this.spherical.radius = THREE.MathUtils.clamp(
        this.spherical.radius * factor,
        this.minDistance,
        this.maxDistance
      );
      this._applyPosition();
    }, { passive: false });

    el.style.cursor = 'grab';
  }

  /* ---- Keyboard ---- */
  _bindKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'm' || e.key === 'M') {
        this.onModeToggle?.();
      }
    });
  }

  /* ---- On-screen nav buttons ---- */
  _bindNavButtons() {
    const dirs = ['up', 'down', 'left', 'right'];
    dirs.forEach(dir => {
      const btn = document.querySelector(`[data-dir="${dir}"]`);
      if (!btn) return;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this._activeDir = dir;
        this._holdTime = 0;
        btn.classList.add('active');
      });
      btn.addEventListener('pointerup', () => this._releaseDir(btn));
      btn.addEventListener('pointerleave', () => this._releaseDir(btn));
    });

    this._bindZoomBtn('zoomIn', -1);
    this._bindZoomBtn('zoomOut', 1);

    const reset = document.getElementById('resetView');
    if (reset) {
      reset.addEventListener('click', () => this.resetToDefault());
    }
  }

  _bindZoomBtn(id, sign) {
    const btn = document.getElementById(id);
    if (!btn) return;
    let interval = null;

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.classList.add('active');
      const zoom = () => {
        const factor = 1 + sign * this.zoomSpeed * 0.5;
        this.spherical.radius = THREE.MathUtils.clamp(
          this.spherical.radius * factor,
          this.minDistance, this.maxDistance
        );
        this._applyPosition();
      };
      zoom();
      interval = setInterval(zoom, 60);
    });

    const stop = () => { clearInterval(interval); btn.classList.remove('active'); };
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointerleave', stop);
  }

  _releaseDir(btn) {
    this._activeDir = null;
    this._holdTime = 0;
    btn.classList.remove('active');
  }

  _clampPhi() {
    this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi, 0.15, Math.PI - 0.15);
  }

  /* ---- Reset to ISS spawn ---- */
  resetToDefault() {
    this.spherical.radius = CAMERA.ISS_DISTANCE;
    this.spherical.phi = Math.PI / 3;
    this.spherical.theta = 0;
    this._applyPosition();
  }

  /* ---- Frame update (call from animation loop) ---- */
  update(delta) {
    if (!this._activeDir) return;

    this._holdTime += delta;
    const speed = Math.min(this.orbitSpeed + this._holdTime * this.orbitAccel, this.maxOrbitSpeed);
    const step = speed * delta;

    switch (this._activeDir) {
      case 'up':    this.spherical.phi -= step; break;
      case 'down':  this.spherical.phi += step; break;
      case 'left':  this.spherical.theta -= step; break;
      case 'right': this.spherical.theta += step; break;
    }

    this._clampPhi();
    this._applyPosition();
  }
}
