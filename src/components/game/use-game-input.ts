'use client';

import { useEffect, type RefObject } from 'react';
import type { Socket } from 'socket.io-client';
import type { Phase, JoystickState } from './game-types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOUSE_DEADZONE_PX = 15; // [FIXES I2] old was 5px → jittery
const JOYSTICK_DEADZONE = 0.18;
const JOYSTICK_MAX_RADIUS_PX = 70;
const JOYSTICK_BOOST_MAGNITUDE = 0.6; // >60% deflection = boost

// ---------------------------------------------------------------------------
// Hook parameters
// ---------------------------------------------------------------------------

export interface UseGameInputParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isOffline: boolean;
  keysRef: RefObject<Set<string>>;
  mousePosRef: RefObject<{ x: number; y: number }>;
  mouseActiveRef: RefObject<boolean>;
  mouseLeftDownRef: RefObject<boolean>;
  touchAngleRef: RefObject<number | null>;
  touchBoostRef: RefObject<boolean>;
  joystickRef: RefObject<JoystickState | null>;
  phaseRef: RefObject<Phase>;
  matchEndedRef: RefObject<boolean>;
  extractActiveRef: RefObject<boolean>;
  boostHoldRef: RefObject<boolean>;
  socketRef: RefObject<Socket | null>;
  onExitRef: RefObject<() => void>;
  computeInputRef: RefObject<(() => { angle: number | null; boost: boolean }) | null>;
  setFullMapOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGameInput({
  canvasRef,
  isOffline,
  keysRef,
  mousePosRef,
  mouseActiveRef,
  mouseLeftDownRef,
  touchAngleRef,
  touchBoostRef,
  joystickRef,
  phaseRef,
  matchEndedRef,
  extractActiveRef,
  boostHoldRef,
  socketRef,
  onExitRef,
  computeInputRef,
  setFullMapOpen,
}: UseGameInputParams) {
  // =========================================================================
  // INPUT effect — mouse + keyboard + touch joystick + pointer buttons.
  // [FIXES I1, I2, I4, I6, I9, I11, C19]
  // =========================================================================
  useEffect(() => {
    // Offline mode: the OfflineGameEngine attaches its own input listeners.
    if (isOffline) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ----- Compute input angle + boost from current sources -----
    // Priority: touch joystick > keyboard > mouse.
    // Boost fires when SPACE held OR boost button held OR joystick magnitude
    // > 0.6 (matches original AUDIT-A boost logic + mobile joystick convention).
    const computeAngleAndBoost = (): { angle: number | null; boost: boolean } => {
      const spaceHeld = keysRef.current.has(' ') || keysRef.current.has('space') || boostHoldRef.current;
      // Touch joystick
      if (touchAngleRef.current !== null) {
        return { angle: touchAngleRef.current, boost: touchBoostRef.current || spaceHeld };
      }
      // Keyboard
      const k = keysRef.current;
      let kx = 0;
      let ky = 0;
      if (k.has('w') || k.has('arrowup')) ky -= 1;
      if (k.has('s') || k.has('arrowdown')) ky += 1;
      if (k.has('a') || k.has('arrowleft')) kx -= 1;
      if (k.has('d') || k.has('arrowright')) kx += 1;
      if (kx !== 0 || ky !== 0) {
        return { angle: Math.atan2(ky, kx), boost: spaceHeld };
      }
      // Mouse
      if (mouseActiveRef.current) {
        const rect = canvas.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const dx = mousePosRef.current.x - cx;
        const dy = mousePosRef.current.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > MOUSE_DEADZONE_PX) {
          return { angle: Math.atan2(dy, dx), boost: spaceHeld || mouseLeftDownRef.current };
        }
      }
      return { angle: null, boost: false };
    };

    // Expose computeAngleAndBoost to the rAF loop via a ref.
    computeInputRef.current = computeAngleAndBoost;

    // ----- Mouse -----
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      mouseActiveRef.current = true;
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) mouseLeftDownRef.current = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseLeftDownRef.current = false;
    };
    const onMouseLeave = () => {
      mouseLeftDownRef.current = false;
      // Keep last position but mark inactive so we don't keep steering if
      // the user moves off the canvas (e.g., onto the HUD).
    };

    // ----- Keyboard -----
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // [FIXES I4] prevent default for arrows/space so the page doesn't scroll
      if (
        k === 'arrowup' ||
        k === 'arrowdown' ||
        k === 'arrowleft' ||
        k === 'arrowright' ||
        k === ' ' ||
        k === 'spacebar'
      ) {
        e.preventDefault();
      }
      if (k === 'escape') {
        if (phaseRef.current === 'ended') {
          onExitRef.current();
        }
        return;
      }
      // Hold E to extract
      if (k === 'e' && phaseRef.current === 'playing' && !matchEndedRef.current && !extractActiveRef.current) {
        socketRef.current?.emit('extract', {});
        extractActiveRef.current = true;
      }
      // BUILD-13: M key toggles the full-screen arena map overlay.
      if (k === 'm' && phaseRef.current === 'playing') {
        setFullMapOpen((prev) => !prev);
      }
      // Quick chat emote keys 1-5
      if (phaseRef.current === 'playing' && ['1', '2', '3', '4', '5'].includes(k)) {
        const emotes = [
          'GG! 🏆',
          'Target Spot! 🎯',
          'Fleeing! 🏃💨',
          'Get Ripped! 💪',
          'Extracting soon! ⚡',
        ];
        const idx = parseInt(k, 10) - 1;
        if (idx >= 0 && idx < emotes.length) {
          socketRef.current?.emit('chat', { message: emotes[idx] });
        }
      }
      // Normalize space
      const normalized = k === 'spacebar' ? ' ' : k;
      keysRef.current.add(normalized);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // Release E cancels extract
      if (k === 'e' && extractActiveRef.current) {
        socketRef.current?.emit('cancel_extract', {});
        extractActiveRef.current = false;
      }
      const normalized = k === 'spacebar' ? ' ' : k;
      keysRef.current.delete(normalized);
    };
    // [FIXES I9] clear keys on blur so they don't stick
    const onBlur = () => {
      keysRef.current.clear();
      mouseActiveRef.current = false;
      boostHoldRef.current = false;
    };

    // ----- Touch joystick (bottom-left quadrant of canvas) -----
    const findJoystickTouch = (touches: TouchList): Touch | null => {
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        // Bottom-left quadrant
        if (x < rect.width / 2 && y > rect.height / 2) {
          return t;
        }
      }
      return null;
    };
    const onTouchStart = (e: TouchEvent) => {
      if (joystickRef.current) return;
      const t = findJoystickTouch(e.touches);
      if (!t) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      joystickRef.current = {
        active: true,
        pointerId: t.identifier,
        originX: t.clientX - rect.left,
        originY: t.clientY - rect.top,
        curX: t.clientX - rect.left,
        curY: t.clientY - rect.top,
      };
    };
    const onTouchMove = (e: TouchEvent) => {
      const js = joystickRef.current;
      if (!js) return;
      let t: Touch | null = null;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === js.pointerId) {
          t = e.touches[i];
          break;
        }
      }
      if (!t) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      js.curX = t.clientX - rect.left;
      js.curY = t.clientY - rect.top;
      const dx = js.curX - js.originX;
      const dy = js.curY - js.originY;
      const dist = Math.hypot(dx, dy);
      const magnitude = Math.min(1, dist / JOYSTICK_MAX_RADIUS_PX);
      if (magnitude > JOYSTICK_DEADZONE) {
        touchAngleRef.current = Math.atan2(dy, dx);
        // Boost when magnitude > 0.6 (BUILD-10 spec)
        touchBoostRef.current = magnitude > JOYSTICK_BOOST_MAGNITUDE;
      } else {
        touchAngleRef.current = null;
        touchBoostRef.current = false;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      const js = joystickRef.current;
      if (!js) return;
      let stillActive = false;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === js.pointerId) {
          stillActive = true;
          break;
        }
      }
      if (!stillActive) {
        joystickRef.current = null;
        touchAngleRef.current = null;
        touchBoostRef.current = false;
      }
    };
    const onTouchCancel = (e: TouchEvent) => onTouchEnd(e);

    // Wire up
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchCancel);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchCancel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [isOffline]);
}
