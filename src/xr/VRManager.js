/**
 * VRManager — WebXR session and controller management
 *
 * Spec ref: Section 6 & 9.2 — WebXR Interaction
 * - Controller raycaster from index finger
 * - Y button on left controller: toggle Natural ↔ Admin mode
 * - Thumbstick press: reset to ISS spawn
 * - Adaptive Quality: reduce LOD when VR active
 */
import * as THREE from 'three';
import { CAMERA, QUALITY } from '../core/constants.js';

export class VRManager {
  constructor(renderer, camera, scene) {
    this.renderer = renderer;
    this.camera = camera;
    this.scene = scene;
    this.isPresenting = false;
    this.controllers = [];
    this.raycaster = new THREE.Raycaster();

    // Callbacks
    this.onModeToggle = null;
    this.onResetView = null;

    this._setupControllers();
    this._setupSessionEvents();
  }

  _setupSessionEvents() {
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.isPresenting = true;
      console.log('[VRManager] VR session started — Adaptive Quality enabled');
      // Giảm chất lượng shadow cho VR
      this.renderer.shadowMap.mapSize = new THREE.Vector2(
        QUALITY.SHADOW_VR, QUALITY.SHADOW_VR
      );
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.isPresenting = false;
      console.log('[VRManager] VR session ended');
      // Khôi phục chất lượng Desktop
      this.renderer.shadowMap.mapSize = new THREE.Vector2(
        QUALITY.SHADOW_DESKTOP, QUALITY.SHADOW_DESKTOP
      );
    });
  }

  _setupControllers() {
    // Controller 0 = Tay phải (Trigger raycaster)
    const controller0 = this.renderer.xr.getController(0);
    controller0.addEventListener('selectstart', () => this._onSelect(controller0));
    this.scene.add(controller0);

    // Controller 1 = Tay trái (Y button toggle mode)
    const controller1 = this.renderer.xr.getController(1);
    this.scene.add(controller1);

    // Controller ray visual (tia laser)
    const rayGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -5),
    ]);
    const rayMat = new THREE.LineBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.5,
    });
    const rayLine = new THREE.Line(rayGeom, rayMat);
    controller0.add(rayLine);

    this.controllers = [controller0, controller1];

    // Gamepad polling for Y button and thumbstick
    this._lastYState = false;
    this._lastThumbState = false;
  }

  _onSelect(controller) {
    // Raycaster from controller direction
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  }

  /**
   * Poll gamepad buttons each frame
   */
  update() {
    if (!this.isPresenting) return;

    const session = this.renderer.xr.getSession();
    if (!session) return;

    for (const source of session.inputSources) {
      if (!source.gamepad) continue;

      if (source.handedness === 'left') {
        // Y button = gamepad.buttons[5] on Oculus Touch
        const yButton = source.gamepad.buttons[5];
        if (yButton && yButton.pressed && !this._lastYState) {
          if (this.onModeToggle) this.onModeToggle();
        }
        this._lastYState = yButton ? yButton.pressed : false;
      }

      if (source.handedness === 'right') {
        // Thumbstick press = gamepad.buttons[3]
        const thumbBtn = source.gamepad.buttons[3];
        if (thumbBtn && thumbBtn.pressed && !this._lastThumbState) {
          if (this.onResetView) this.onResetView();
        }
        this._lastThumbState = thumbBtn ? thumbBtn.pressed : false;
      }
    }
  }
}
