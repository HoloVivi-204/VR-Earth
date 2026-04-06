import * as THREE from 'three';

export class VRManager {
  constructor(renderer, camera, scene) {
    this.renderer = renderer;
    this.camera = camera;
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();
    this.controllers = [];
    this.isPresenting = false;

    this.onModeToggle = null;
    this.onResetView = null;
    this.onSpeedChange = null;

    this._lastLeftAux = false;
    this._lastRightAux = false;
    this._lastThumbState = false;
    this._lastFasterState = false;

    this._setupControllers();
    this._setupSessionEvents();
  }

  _setupSessionEvents() {
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.isPresenting = true;
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.isPresenting = false;
    });
  }

  _setupControllers() {
    const controller0 = this.renderer.xr.getController(0);
    const controller1 = this.renderer.xr.getController(1);
    this.scene.add(controller0);
    this.scene.add(controller1);

    const rayGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -4),
    ]);
    const rayMaterial = new THREE.LineBasicMaterial({
      color: 0x58dfff,
      transparent: true,
      opacity: 0.55,
    });

    controller0.add(new THREE.Line(rayGeometry, rayMaterial));
    this.controllers = [controller0, controller1];
  }

  update() {
    if (!this.isPresenting) return;

    const session = this.renderer.xr.getSession();
    if (!session) return;

    for (const source of session.inputSources) {
      if (!source.gamepad) continue;

      if (source.handedness === 'left') {
        const modeButton = source.gamepad.buttons[5];
        const slowerButton = source.gamepad.buttons[4];

        if (modeButton?.pressed && !this._lastLeftAux) {
          this.onModeToggle?.();
        }
        if (slowerButton?.pressed && !this._lastRightAux) {
          this.onSpeedChange?.(-1);
        }

        this._lastLeftAux = Boolean(modeButton?.pressed);
        this._lastRightAux = Boolean(slowerButton?.pressed);
      }

      if (source.handedness === 'right') {
        const thumbButton = source.gamepad.buttons[3];
        const fasterButton = source.gamepad.buttons[4];

        if (thumbButton?.pressed && !this._lastThumbState) {
          this.onResetView?.();
        }
        if (fasterButton?.pressed && !this._lastFasterState) {
          this.onSpeedChange?.(1);
        }

        this._lastThumbState = Boolean(thumbButton?.pressed);
        this._lastFasterState = Boolean(fasterButton?.pressed);
      }
    }
  }
}
