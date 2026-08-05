// ============================================================================
// Input Handler — Tracks mouse, keyboard, and touch input for snake control.
//
// Mouse steering uses RELATIVE movement (movementX/movementY deltas) instead of
// absolute cursor position. This means:
//   - Moving the mouse left/right steers the snake left/right
//   - No need for the cursor to be inside the canvas/window
//   - Works like a steering wheel: move right = turn right, stop = go straight
//
// A "steer offset" accumulates from mouse deltas and decays toward 0 each frame,
// so the snake gradually straightens when you stop moving the mouse.
// ============================================================================

import type { InputState } from '@/lib/snake/types';

/** How strongly mouse movement affects steering (radians per pixel of movementX) */
const MOUSE_STEER_SENSITIVITY = 0.004;

/** Per-frame decay for the steer offset (closer to 1 = slower return to center) */
const STEER_DECAY = 0.92;

/** Dead zone: offsets smaller than this are snapped to 0 */
const STEER_DEAD_ZONE = 0.002;

/** Maximum steer offset in radians (prevents wild spinning) */
const MAX_STEER_OFFSET = Math.PI * 0.8;

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
  private touchActive = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchX = 0;
  private touchY = 0;
  private touchId: number | null = null;
  private canvasRect: DOMRect | null = null;
  private onDetached = false;

  // ── Relative steering state ──
  /** Accumulated steering offset (radians) from mouse movement */
  private steerOffset = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /** Bind all event listeners */
  attach(): void {
    this.onDetached = false;
    this.canvasRect = this.canvas.getBoundingClientRect();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    // Listen on WINDOW for mousemove so it works even when cursor is outside canvas
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

  /**
   * Get current input state.
   * @param currentSnakeAngle - The snake's current facing angle. Used to compute
   *   the absolute targetAngle from the relative steer offset.
   */
  getState(currentSnakeAngle = 0): InputState {
    if (this.onDetached) return { ...this.state };

    // Keyboard overrides touch/mouse
    let kx = 0;
    let ky = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) ky -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) ky += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) kx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) kx += 1;

    if (kx !== 0 || ky !== 0) {
      this.state.targetAngle = Math.atan2(ky, kx);
      this.state.boosting = this.keys.has(' ') || this.keys.has('shift');
      return { ...this.state };
    }

    // Touch input
    if (this.touchActive && this.touchId !== null) {
      const dx = this.touchX - this.touchStartX;
      const dy = this.touchY - this.touchStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        this.state.targetAngle = Math.atan2(dy, dx);
      }
      this.state.boosting = dist > 80;
      return { ...this.state };
    }

    // ── Mouse: RELATIVE steering via movementX deltas ──
    // Decay the steer offset toward 0 (go straight when no mouse movement)
    this.steerOffset *= STEER_DECAY;
    if (Math.abs(this.steerOffset) < STEER_DEAD_ZONE) this.steerOffset = 0;

    // Compute absolute target angle from current angle + offset
    this.state.targetAngle = currentSnakeAngle + this.steerOffset;
    this.state.boosting = this.mouseDown || this.keys.has(' ') || this.keys.has('shift');

    return { ...this.state };
  }

  /** Update canvas rect (call on resize) */
  updateRect(): void {
    this.canvasRect = this.canvas.getBoundingClientRect();
  }

  // --- Event handlers (arrow functions for stable `this`) ---

  private onKeyDown = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    this.keys.add(key);
    // Prevent scrolling with arrow keys/space
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  /**
   * Mouse steering via MOVEMENT DELTAS (not absolute position).
   * movementX > 0 = mouse moved right = turn right = positive steer offset
   * Works even when cursor is outside the window.
   */
  private onMouseMove = (e: MouseEvent): void => {
    const dx = e.movementX || 0;
    const dy = e.movementY || 0;

    // Use horizontal movement for left/right steering (like a steering wheel)
    // Also use vertical movement to add steering when moving mouse up/down
    // The vertical contribution is projected based on the current snake angle
    // so moving mouse "forward" doesn't steer, but moving mouse to the side does.
    // For simplicity and intuitiveness, use movementX for primary steering.
    this.steerOffset += dx * MOUSE_STEER_SENSITIVITY;

    // Clamp to prevent wild spinning
    this.steerOffset = Math.max(-MAX_STEER_OFFSET, Math.min(MAX_STEER_OFFSET, this.steerOffset));
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
