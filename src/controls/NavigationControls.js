import * as THREE from 'three';
import { CAMERA } from '../core/constants.js';

export class NavigationControls {
  constructor(camera, domElement, target = new THREE.Vector3()) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = target;
    this.spherical = new THREE.Spherical();
    this.rotateSpeed = 0.004;
    this.zoomSpeed = 0.08;
    this.minDistance = CAMERA.ZOOM_MIN;
    this.maxDistance = CAMERA.ZOOM_MAX;
    this.onModeToggle = null;

    this._dragging = false;
    this._lastMouse = { x: 0, y: 0 };

    this.syncFromCamera();
    this._bindMouseEvents();
    this._bindKeyboardEvents();
  }

  syncFromCamera() {
    const offset = this.camera.position.clone().sub(this.target);
    this.spherical.setFromVector3(offset);
  }

  _applyPosition() {
    const offset = new THREE.Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }

  _clampPhi() {
    this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi, 0.15, Math.PI - 0.15);
  }

  _bindMouseEvents() {
    const element = this.domElement;

    element.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      this._dragging = true;
      this._lastMouse.x = event.clientX;
      this._lastMouse.y = event.clientY;
      element.style.cursor = 'grabbing';
    });

    element.addEventListener('pointermove', (event) => {
      if (!this._dragging) return;

      const dx = event.clientX - this._lastMouse.x;
      const dy = event.clientY - this._lastMouse.y;
      this._lastMouse.x = event.clientX;
      this._lastMouse.y = event.clientY;

      this.spherical.theta -= dx * this.rotateSpeed;
      this.spherical.phi -= dy * this.rotateSpeed;
      this._clampPhi();
      this._applyPosition();
    });

    const stopDragging = () => {
      this._dragging = false;
      element.style.cursor = 'grab';
    };

    element.addEventListener('pointerup', stopDragging);
    element.addEventListener('pointerleave', stopDragging);
    element.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const factor = 1 + Math.sign(event.deltaY) * this.zoomSpeed;
        this.spherical.radius = THREE.MathUtils.clamp(
          this.spherical.radius * factor,
          this.minDistance,
          this.maxDistance
        );
        this._applyPosition();
      },
      { passive: false }
    );

    element.style.cursor = 'grab';
  }

  _bindKeyboardEvents() {
    window.addEventListener('keydown', (event) => {
      if (event.key === 'm' || event.key === 'M') {
        this.onModeToggle?.();
      }
    });
  }

  update() {}
}
