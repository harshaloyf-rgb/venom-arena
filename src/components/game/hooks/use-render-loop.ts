'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook that runs a callback on every animation frame.
 * Tracks FPS and provides elapsed time.
 */
export function useRenderLoop(
  callback: (time: number, deltaTime: number) => void,
  active: boolean,
) {
  const callbackRef = useRef(callback);
  const rafRef = useRef<number>(0);
  const fpsRef = useRef({ frames: 0, lastTime: 0, fps: 60 });

  // Keep callback ref up to date in an effect
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let running = true;

    const tick = (time: number) => {
      if (!running) return;

      const lastTime = fpsRef.current.lastTime || time;
      const delta = time - lastTime;
      fpsRef.current.lastTime = time;
      fpsRef.current.frames++;

      if (fpsRef.current.frames % 30 === 0 && delta > 0) {
        fpsRef.current.fps = Math.round(1000 / delta);
      }

      callbackRef.current(time, delta);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  return fpsRef;
}
