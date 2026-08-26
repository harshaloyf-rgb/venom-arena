'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InputState, JoystickState } from '@/lib/snake/types';

/**
 * Hook for capturing mouse/touch/keyboard input and converting to game input.
 * Returns current InputState and ref to the canvas element.
 */
export function useGameInput(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onEmote: (key: number) => void,
  onToggleMinimap: () => void,
  onExit: () => void,
) {
  const inputRef = useRef<InputState>({
    targetAngle: 0,
    boosting: false,
    extracting: false,
    emoteKey: null,
  });
  const [joystick, setJoystick] = useState<JoystickState>({
    active: false,
    dx: 0,
    dy: 0,
    magnitude: 0,
  });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = e.clientX - rect.left - cx;
    const dy = e.clientY - rect.top - cy;
    inputRef.current.targetAngle = Math.atan2(dy, dx);
  }, [canvasRef]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 0) inputRef.current.boosting = true;
  }, []);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (e.button === 0) inputRef.current.boosting = false;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = touch.clientX - rect.left - cx;
    const dy = touch.clientY - rect.top - cy;
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    inputRef.current.targetAngle = Math.atan2(dy, dx);
    // Auto-boost when joystick pushed far enough (magnitude > 0.6 of half-screen)
    const halfDiag = Math.sqrt(cx * cx + cy * cy);
    inputRef.current.boosting = magnitude > halfDiag * 0.6;
    setJoystick({ active: true, dx, dy, magnitude });
  }, [canvasRef]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    handleTouchMove(e);
  }, [handleTouchMove]);

  const handleTouchEnd = useCallback(() => {
    inputRef.current.boosting = false;
    setJoystick({ active: false, dx: 0, dy: 0, magnitude: 0 });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.code) {
      case 'Space':
      case 'ShiftLeft':
      case 'ShiftRight':
        e.preventDefault();
        inputRef.current.boosting = true;
        break;
      case 'KeyE':
        inputRef.current.extracting = true;
        break;
      case 'KeyM':
        onToggleMinimap();
        break;
      case 'Digit1': onEmote(1); break;
      case 'Digit2': onEmote(2); break;
      case 'Digit3': onEmote(3); break;
      case 'Digit4': onEmote(4); break;
      case 'Digit5': onEmote(5); break;
      case 'Escape':
        onExit();
        break;
    }
  }, [onEmote, onToggleMinimap, onExit]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    switch (e.code) {
      case 'Space':
      case 'ShiftLeft':
      case 'ShiftRight':
        inputRef.current.boosting = false;
        break;
      case 'KeyE':
        inputRef.current.extracting = false;
        break;
    }
  }, []);

  const handleContextMenu = useCallback((e: Event) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    canvasRef, handleMouseMove, handleMouseDown, handleMouseUp,
    handleTouchMove, handleTouchStart, handleTouchEnd,
    handleKeyDown, handleKeyUp, handleContextMenu,
  ]);

  return { inputRef, joystick };
}
