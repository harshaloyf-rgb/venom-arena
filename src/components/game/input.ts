// ============================================================================
// Input Handler — Tracks mouse, keyboard, and touch input for snake control.
//
// Mouse steering (delta-based):
//   Mouse MOVEMENT steers the snake — small nudges left/right turn the snake.
//   No need to move the mouse across the screen. The snake auto-moves forward,
//   and you just nudge the mouse to steer. Sensitivity is adjustable.
//
// Keyboard steering:
//   WASD / Arrow keys set absolute direction. Space / Shift = boost. E = extract.
// ============================================================================

import type { InputState } from '@/lib/snake/types';

/** How many radians to turn per pixel of horizontal mouse movement */
const DELTA_SENSITIVITY = 0.004;

/**
 * Creates and manages input state for the game.
 * Call attach() to bind event listeners, detach() to unbind.
 */
export class InputHandler {
  private state: InputState = {
    targetAngle: 0,
    boosting: false,
  };

  private canvas: HTMLCanvasElement;
  private keys: Set<string> = new Set();
  private mouseDown = false;
  private mouseClientX = 0;
  private mouseClientY = 0;
  private hasMouseMoved = false;
  private touchActive = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchX = 0;
  private touchY = 0;
  private touchId: number | null = null;
  private canvasRect: DOMRect | null = null;
  private onDetached = false;

  // External button overrides (set by UI buttons)
  externalBoost = false;
  externalExtract = false;

  // Mouse delta steering
  private _accumulatedDeltaX = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /** Whether E key is held (or external extract button) */
  isExtracting(): boolean {
    return this.keys.has('e') || this.externalExtract;
  }

  /** Bind all event listeners */
  attach(): void {
    this.onDetached = false;
    this.canvasRect = this.canvas.getBoundingClientRect();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd);
    this.canvas.addEventListener('touchcancel', this.onTouchEnd);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  /** Unbind all event listeners */
  detach(): void {
    this.onDetached = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }

  /** Get current input state */
  getState(): InputState {
    if (this.onDetached) return { ...this.state };
    this.updateAngle();
    return { ...this.state };
  }

  /** Get raw mouse position (for cursor rendering) */
  getMousePos(): { x: number; y: number } | null {
    if (!this.hasMouseMoved || !this.canvasRect) return null;
    return {
      x: this.mouseClientX - this.canvasRect.left,
      y: this.mouseClientY - this.canvasRect.top,
    };
  }

  /** Set boosting from an external source (e.g. UI button) */
  setExternalBoost(active: boolean): void {
    this.externalBoost = active;
  }

  /** Set extracting from an external source (e.g. UI button) */
  setExternalExtract(active: boolean): void {
    this.externalExtract = active;
  }

  /** Update canvas rect (call on resize) */
  updateRect(): void {
    this.canvasRect = this.canvas.getBoundingClientRect();
  }

  private updateAngle(): void {
    if (this.onDetached) return;

    // Keyboard overrides touch/mouse
    let kx = 0;
    let ky = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) ky -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) ky += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) kx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) kx += 1;

    if (kx !== 0 || ky !== 0) {
      this.state.targetAngle = Math.atan2(ky, kx);
      this.state.boosting = this.keys.has(' ') || this.keys.has('shift') || this.externalBoost;
      // Consume any accumulated delta so it doesn't leak after keyboard release
      this._accumulatedDeltaX = 0;
      return;
    }

    // Touch input
    if (this.touchActive && this.touchId !== null) {
      const dx = this.touchX - this.touchStartX;
      const dy = this.touchY - this.touchStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        this.state.targetAngle = Math.atan2(dy, dx);
      }
      this.state.boosting = dist > 80 || this.externalBoost;
      this._accumulatedDeltaX = 0;
      return;
    }

    // Mouse delta steering: horizontal mouse movement turns the snake
    if (this._accumulatedDeltaX !== 0) {
      this.state.targetAngle += this._accumulatedDeltaX * DELTA_SENSITIVITY;
      // Normalize to [-PI, PI]
      if (this.state.targetAngle > Math.PI) this.state.targetAngle -= 2 * Math.PI;
      else if (this.state.targetAngle < -Math.PI) this.state.targetAngle += 2 * Math.PI;
    }
    this._accumulatedDeltaX = 0;

    this.state.boosting = this.mouseDown || this.keys.has(' ') || this.keys.has('shift') || this.externalBoost;
  }

  // --- Event handlers (arrow functions for stable `this`) ---

  private onKeyDown = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    this.keys.add(key);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  /** Accumulate mouse movement delta for delta-based steering */
  private onMouseMove = (e: MouseEvent): void => {
    this.mouseClientX = e.clientX;
    this.mouseClientY = e.clientY;
    this.hasMouseMoved = true;
    this._accumulatedDeltaX += e.movementX;
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.mouseDown = true;
    }
  };

  private onMouseUp = (): void => {
    this.mouseDown = false;
  };

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    if (this.touchActive) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    this.touchId = touch.identifier;
    this.touchActive = true;
    if (!this.canvasRect) return;
    this.touchStartX = touch.clientX - this.canvasRect.left;
    this.touchStartY = touch.clientY - this.canvasRect.top;
    this.touchX = this.touchStartX;
    this.touchY = this.touchStartY;
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    if (!this.canvasRect) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touchId) {
        this.touchX = touch.clientX - this.canvasRect.left;
        this.touchY = touch.clientY - this.canvasRect.top;
        break;
      }
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchId) {
        this.touchActive = false;
        this.touchId = null;
        this.state.boosting = false;
        break;
      }
    }
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };
}
