'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GamePhase, EndScreenState, SnakeIdentity, HUDState,
  RenderSegment, SnakeState, Particle,
} from '@/lib/snake/types';
import { DEFAULT_SNAKE_CONFIG, type SnakeConfig } from '@/lib/snake/config';
import {
  calcVisualRadius, calcCollisionRadius, calcSegmentCount,
} from '@/lib/snake/engine';
import { OfflineEngine } from './engines/offline-engine';
import { useGameInput } from './hooks/use-game-input';
import { useRenderLoop } from './hooks/use-render-loop';
import { createDefaultCamera, followTarget, isOnScreen } from './render/camera';
import type { CameraState } from '@/lib/snake/types';
import { renderGrid } from './render/render-grid';
import { renderFoods } from './render/render-food';
import { renderSnake } from './render/render-snake';
import { renderMapBoundary } from './render/render-map';
import { renderMinimap } from './render/render-minimap';
import { renderKillFeed, renderEmoteBubble, renderNameLabel, renderParticles } from './render/render-overlays';
import { renderHUD } from './render/render-hud';
import { resolveSkin } from '@/lib/snake/skin-resolver';

// ── Props ──────────────────────────────────────────────────────────────────

export interface GameCanvasProps {
  mode: 'online' | 'offline';
  arenaId: string;
  arenaName: string;
  playerIdentity: SnakeIdentity;
  rewardMultiplier: number;
  botCount?: number;
  isPractice?: boolean;
  configOverrides?: Partial<SnakeConfig>;
  onExit?: () => void;
  onMatchEnd?: (result: EndScreenState) => void;
  socket?: any;
}

// ── Build RenderSegments from SnakeState ──────────────────────────────────────

function buildRenderSegments(
  snake: SnakeState,
 config: SnakeConfig,
 skinResolved: import('@/lib/snake/skin-types').ResolvedSkin,
): RenderSegment[] {
  const path = snake.path;
  const segCount = Math.min(
    calcSegmentCount(snake.score, config),
    path.length,
  );
  const segments: RenderSegment[] = [];

  for (let i = 0; i < segCount; i++) {
    const pathIdx = Math.min(i * config.skinSegSpacing, path.length - 1);
    const px = path.getX(pathIdx);
    const py = path.getY(pathIdx);
    const pa = path.getAngle(pathIdx);
    const resolved = skinResolved.segments[i] ?? skinResolved.segments[skinResolved.segments.length - 1];
    const isHead = i === 0;
    const baseR = calcVisualRadius(snake.score, config);
    const sizeScale = isHead ? config.headSize : (resolved?.sizeScale ?? 1);
    const r = baseR * sizeScale;

    segments.push({
      x: px,
      y: py,
      angle: pa,
      visualRadius: r,
      collisionRadius: calcCollisionRadius(r),
      color: resolved?.color ?? '#2ECC71',
      shape: resolved?.shape ?? 'circle',
      glow: resolved?.glow ?? false,
      sizeScale,
    });
  }
  return segments;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function GameCanvas({
  mode, arenaId, arenaName, playerIdentity,
  rewardMultiplier, botCount = 1000, isPractice = false,
  configOverrides, onExit, onMatchEnd,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<OfflineEngine | null>(null);
  const cameraRef = useRef<CameraState>(createDefaultCamera());
  const phaseRef = useRef<GamePhase>('playing');
  const effectiveMode = (mode === 'offline' || isPractice) ? 'offline' : 'online';
  const [phase, setPhase] = useState<GamePhase>(effectiveMode === 'offline' ? 'playing' : 'connecting');
  const [endState, setEndState] = useState<EndScreenState | null>(null);
  const [showMinimap, setShowMinimap] = useState(false);
  const hudRef = useRef<HUDState>({
    fps: 60, ping: 0, lowQuality: false,
    showMinimap: false, showFullMap: false,
    score: 0, kills: 0, rank: 1,
    carriedChips: 0, starsEarned: 0, starsInArena: 0,
    bankedChips: 0, realPlayerCount: 0, botCount: 0,
    commissionRate: 0, rewardMultiplier, arenaName,
    isOffline: isPractice || mode === 'offline',
  });

  const config = useMemo(() => ({ ...DEFAULT_SNAKE_CONFIG, ...configOverrides }), [configOverrides]);

  const handleEmote = useCallback((key: number) => {
    engineRef.current?.triggerPlayerEmote(key);
  }, []);

  const handleToggleMinimap = useCallback(() => {
    setShowMinimap(prev => !prev);
  }, []);

  const handleExit = useCallback(() => { onExit?.(); }, [onExit]);

  const { inputRef } = useGameInput(
    canvasRef, handleEmote, handleToggleMinimap, handleExit,
  );

  // ── Initialize Engine ─────────────────────────────────────────────────────

  useEffect(() => {
    if (effectiveMode !== 'offline') return;
    const engine = new OfflineEngine(playerIdentity, configOverrides, botCount);
    engine.onDeath = (state) => {
      setEndState(state);
      setPhase('ended');
      onMatchEnd?.(state);
    };
    engineRef.current = engine;
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [effectiveMode, botCount, arenaId]);

  // ── Render Loop ───────────────────────────────────────────────────────────

  const renderCallback = useCallback((time: number, _delta: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Backing store guard
    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.clientWidth;
    const displayH = canvas.clientHeight;
    const backW = Math.floor(displayW * dpr);
    const backH = Math.floor(displayH * dpr);
    if (canvas.width !== backW || canvas.height !== backH) {
      canvas.width = backW;
      canvas.height = backH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const w = displayW;
    const h = displayH;
    const engine = engineRef.current;
    if (!engine || phaseRef.current !== 'playing') return;

    // Tick engine
    engine.tick(inputRef.current);

    // Camera follow player
    const player = engine.snakes.find(s => s.identity.id === playerIdentity.id) ?? null;
    if (player && player.alive) {
      cameraRef.current = followTarget(cameraRef.current, player.head.x, player.head.y, config.camFollowSpeed);
      const targetZoom = Math.max(config.camMinZoom, 1.0 - (player.score / config.maxLength) * 0.5);
      cameraRef.current.zoom += (targetZoom - cameraRef.current.zoom) * config.camZoomSmooth;
    }

    // Update HUD
    const hud = hudRef.current;
    hud.fps = _delta > 0 ? Math.round(1000 / _delta) : 60;
    hud.score = player?.score ?? 0;
    hud.kills = player?.kills ?? 0;
    hud.rank = engine.getPlayerRank();
    hud.botCount = engine.snakes.filter(s => s.identity.isBot && s.alive).length;
    hud.showMinimap = showMinimap;

    const camera = cameraRef.current;
    const timeSeconds = time / 1000;

    // Clear
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    // Grid
    renderGrid(ctx, camera, config, w, h);

    // Map boundary (online only)
    if (engine.map.type === 'circular_breathing') {
      renderMapBoundary(ctx, engine.map, camera, w, h);
    }

    // Food
    renderFoods(ctx, engine.food, camera, w, h);

    // Snakes
    const lowQuality = hud.fps < 25;
    for (const snake of engine.snakes) {
      if (!snake.alive) continue;
      if (!isOnScreen(snake.head.x, snake.head.y, 50, camera, w, h)) continue;

      const segCount = calcSegmentCount(snake.score, config);
      const skinResolved = resolveSkin(snake.identity, segCount, timeSeconds);
      const renderSegs = buildRenderSegments(snake, config, skinResolved);

      renderSnake(
        ctx,
        snake.identity,
        renderSegs,
        camera,
        config,
        timeSeconds,
        snake.identity.id === playerIdentity.id,
        lowQuality,
        snake.angle,
        snake.boosting,
        snake.spawnProtected,
      );
    }

    // Name labels & emotes for nearby snakes
    if (player && player.alive) {
      for (const snake of engine.snakes) {
        if (!snake.alive) continue;
        if (snake.identity.id === playerIdentity.id) continue;
        const dx = player.head.x - snake.head.x;
        const dy = player.head.y - snake.head.y;
        if (dx * dx + dy * dy < 500 * 500) {
          renderNameLabel(ctx, snake, camera, w, h);
          if (snake.activeEmote) {
            renderEmoteBubble(ctx, snake, timeSeconds, camera, w, h);
          }
        }
      }
    }

    // Kill feed
    renderKillFeed(ctx, engine.killFeed, timeSeconds);

    // Particles
    const particleArray = engine.particles as unknown as Particle[];
    renderParticles(ctx, particleArray, camera, w, h);

    // Minimap
    if (showMinimap && !hud.isOffline) {
      renderMinimap(ctx, engine.snakes, player, engine.map, w, h, config);
    }

    // HUD
    renderHUD(ctx, hud, w, h);

  }, [config, playerIdentity.id, showMinimap, inputRef]);

  useRenderLoop(renderCallback, phase === 'playing');

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full h-full bg-[#0a0a0f] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
      />

      {phase === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-lg font-mono">Loading Arena...</p>
          </div>
        </div>
      )}

      {phase === 'ended' && endState && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50">
          <div className="bg-slate-900/95 border border-slate-700 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="text-4xl mb-4">{endState.outcome === 'death' ? '💀' : '🏆'}</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {endState.outcome === 'death' ? 'Eliminated' : 'Extracted'}
            </h2>
            {endState.killerName && (
              <p className="text-slate-400 mb-4">
                Killed by <span className="text-red-400 font-bold">{endState.killerName}</span>
                {endState.killerTag && <span className="text-slate-500"> {endState.killerTag}</span>}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <StatCard label="Score" value={endState.score.toString()} />
              <StatCard label="Kills" value={endState.kills.toString()} />
              <StatCard label="Duration" value={`${endState.durationSeconds}s`} />
              <StatCard label="Arena" value={endState.arenaName} />
            </div>
            <button
              onClick={() => onExit?.()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono uppercase tracking-wider py-3 rounded-xl transition-colors"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/60 rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}
