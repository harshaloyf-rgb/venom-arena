'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { InputHandler } from './input';
import { renderFrame, drawDeathOverlay, drawControlsHint, drawMinimap } from './renderer';
import {
  type GameState,
  type Camera,
  type Viewport,
  FIXED_DT,
} from '@/lib/snake';
import { createInitialState, gameTick, respawnPlayer } from '@/lib/snake/engine';
import { createCamera, updateCamera, getViewport } from '@/lib/snake/camera';

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1.0 });
  const inputRef = useRef<InputHandler | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  const fpsCounterRef = useRef<{ frames: number; lastTime: number; fps: number }>({
    frames: 0,
    lastTime: 0,
    fps: 60,
  });
  const [isDead, setIsDead] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number }[]>([]);
  const isDeadRef = useRef(false);
  const showControlsRef = useRef(true);
  const controlsDismissedRef = useRef(false);
  const leaderboardTimerRef = useRef(0);

  const updateLeaderboard = useCallback((state: GameState) => {
    const entries: { name: string; score: number }[] = [];
    for (const [, snake] of state.snakes) {
      if (snake.alive) {
        entries.push({ name: snake.name, score: snake.score });
      }
    }
    entries.sort((a, b) => b.score - a.score);
    setLeaderboard(entries.slice(0, 5));
  }, []);

  // Respawn handler
  const handleRespawn = useCallback(() => {
    if (!gameStateRef.current) return;
    respawnPlayer(gameStateRef.current);
    isDeadRef.current = false;
    setIsDead(false);
    setFinalScore(0);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Size canvas to fill parent
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (inputRef.current) inputRef.current.updateRect();
    };

    resize();
    window.addEventListener('resize', resize);

    // Init game state (only mutate refs, state defaults are already correct)
    gameStateRef.current = createInitialState();
    cameraRef.current = createCamera(0, 0);
    isDeadRef.current = false;
    showControlsRef.current = true;
    controlsDismissedRef.current = false;
    leaderboardTimerRef.current = 0;

    // Input handler
    const input = new InputHandler(canvas);
    inputRef.current = input;
    input.attach();

    // Game loop
    let running = true;

    const loop = (timestamp: number) => {
      if (!running) return;

      const state = gameStateRef.current;
      if (!state) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      // FPS counter
      const fc = fpsCounterRef.current;
      fc.frames++;
      if (timestamp - fc.lastTime >= 1000) {
        fc.fps = fc.frames;
        fc.frames = 0;
        fc.lastTime = timestamp;
      }

      // Fixed timestep
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }
      const elapsed = Math.min(timestamp - lastTimeRef.current, 100);
      lastTimeRef.current = timestamp;
      accumulatorRef.current += elapsed;

      const inputState = input.getState();

      // Dismiss controls on first input
      if (!controlsDismissedRef.current &&
          (inputState.boosting || Math.abs(inputState.targetAngle) > 0.01)) {
        controlsDismissedRef.current = true;
        setTimeout(() => { showControlsRef.current = false; }, 3000);
      }

      // Run fixed ticks
      const tickMs = FIXED_DT * 1000;
      while (accumulatorRef.current >= tickMs) {
        gameTick(state, inputState, FIXED_DT);
        accumulatorRef.current -= tickMs;

        // Check player death
        if (state.player && !state.player.alive && !isDeadRef.current) {
          isDeadRef.current = true;
          setIsDead(true);
          setFinalScore(state.player.score);
        }
      }

      // Render
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const parent = canvas.parentElement;
        const w = parent ? parent.clientWidth : canvas.width;
        const h = parent ? parent.clientHeight : canvas.height;

        if (state.player && state.player.alive) {
          updateCamera(cameraRef.current, state.player, w, h);
        }

        const viewport: Viewport = getViewport(cameraRef.current, w, h);

        renderFrame(ctx, state, cameraRef.current, viewport, fc.fps, Date.now());

        if (showControlsRef.current && state.player && state.player.alive) {
          drawControlsHint(ctx, viewport);
        }

        drawMinimap(ctx, state.snakes, state.player);

        if (isDeadRef.current) {
          drawDeathOverlay(ctx, finalScore || state.player?.score || 0, viewport);
        }
      }

      // Update leaderboard every ~0.5s (30 frames at 60fps)
      leaderboardTimerRef.current++;
      if (leaderboardTimerRef.current >= 30) {
        leaderboardTimerRef.current = 0;
        updateLeaderboard(state);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    const onDeathAction = () => {
      if (isDeadRef.current) {
        handleRespawn();
      }
    };
    window.addEventListener('keydown', onDeathAction);
    canvas.addEventListener('click', onDeathAction);

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
      input.detach();
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onDeathAction);
      canvas.removeEventListener('click', onDeathAction);
    };
  }, [handleRespawn, updateLeaderboard]);

  return (
    <div className="relative w-full h-full bg-[#0a0a0f] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ touchAction: 'none' }}
      />
      <div className="absolute top-4 right-4 w-44 bg-black/50 backdrop-blur-sm rounded-lg p-2 pointer-events-none select-none">
        <div className="text-xs text-white/60 font-mono mb-1 text-center">Leaderboard</div>
        {leaderboard.map((entry, i) => (
          <div
            key={i}
            className={`flex justify-between text-xs font-mono px-1 py-0.5 rounded ${
              entry.name === 'You' ? 'text-green-400 bg-white/5' : 'text-white/70'
            }`}
          >
            <span>{i + 1}. {entry.name}</span>
            <span>{entry.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
