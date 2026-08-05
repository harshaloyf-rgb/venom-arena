// ============================================================================
// Input Handler — Tracks mouse, keyboard, and touch input for snake control.
//
// Mouse steering (slither.io style):
//   The angle from the VIEWPORT CENTER to the MOUSE CURSOR determines the
//   snake's target direction. This is intuitive — point where you want to go.
//   Listens on `window` so it works across the full browser viewport.
//
// Keyboard steering:
//   WASD / Arrow keys override mouse. Space / Shift = boost.
// ============================================================================

import type { InputState } from '@/lib/snake/types';

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
  private mouseInView = false;
  private mouseClientX = 0;
  private mouseClientY = 0;
  private touchActive = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchX = 0;
  private touchY = 0;
  private touchId: number | null = null;
  private canvasRect: DOMRect | null = null;
  private onDetached = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /** Bind all event listeners */
  attach(): void {
    this.onDetached = false;
    this.canvasRect = this.canvas.getBoundingClientRect();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    // Listen on WINDOW for mousemove — works anywhere in the viewport
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseenter', this.onMouseEnter);
    window.addEventListener('mouseleave', this.onMouseLeave);
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
    window.removeEventListener('mouseenter', this.onMouseEnter);
    window.removeEventListener('mouseleave', this.onMouseLeave);
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
      this.state.boosting = this.keys.has(' ') || this.keys.has('shift');
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
      this.state.boosting = dist > 80;
      return;
    }

    // Mouse input (slither.io style): angle from viewport center to cursor
    if (this.canvasRect && this.mouseInView) {
      const centerX = this.canvasRect.width / 2;
      const centerY = this.canvasRect.height / 2;
      // mouseClientX/Y are relative to viewport, same as getBoundingClientRect
      const mx = this.mouseClientX - this.canvasRect.left;
      const my = this.mouseClientY - this.canvasRect.top;
      const dx = mx - centerX;
      const dy = my - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        this.state.targetAngle = Math.atan2(dy, dx);
      }
    }
    this.state.boosting = this.mouseDown || this.keys.has(' ') || this.keys.has('shift');
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

  /** Track cursor position relative to viewport (slither.io style) */
  private onMouseMove = (e: MouseEvent): void => {
    this.mouseClientX = e.clientX;
    this.mouseClientY = e.clientY;
  };

  private onMouseEnter = (): void => {
    this.mouseInView = true;
  };

  private onMouseLeave = (): void => {
    this.mouseInView = false;
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
