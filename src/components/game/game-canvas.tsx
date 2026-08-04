'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GamePhase, EndScreenState, SnakeIdentity, HUDState,
  RenderSegment, SnakeState, Particle, FoodOrb, StarChip,
} from '@/lib/snake/types';
import { DEFAULT_SNAKE_CONFIG, type SnakeConfig } from '@/lib/snake/config';
import {
  calcVisualRadius, calcCollisionRadius, calcSegmentCount,
} from '@/lib/snake/engine';
import { OfflineEngine } from './engines/offline-engine';
import { OnlineEngine } from './engines/online-engine';
import { useGameInput } from './hooks/use-game-input';
import { useRenderLoop } from './hooks/use-render-loop';
import { createDefaultCamera, followTarget, isOnScreen } from './render/camera';
import type { CameraState } from '@/lib/snake/types';
import { renderGrid } from './render/render-grid';
import { renderFoods } from './render/render-food';
import { renderStars } from './render/render-stars';
import { renderSnake } from './render/render-snake';
import { renderMapBoundary } from './render/render-map';
import { renderMinimap } from './render/render-minimap';
import { renderKillFeed, renderEmoteBubble, renderNameLabel, renderParticles } from './render/render-overlays';
import { renderHUD } from './render/render-hud';
import { resolveSkin } from '@/lib/snake/skin-resolver';
import { SkinAtlasManager } from './render/atlas';

// ── Shared engine interface for render loop ──────────────────────────────────

type AnyEngine = OfflineEngine | OnlineEngine;

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
  // Use every path point for dense, smooth, connected body coverage.
  // Adjacent circles overlap → no gaps. Uniform width, no taper.
  const spacing = 1;
  const segCount = path.length;
  const segments: RenderSegment[] = [];
  const baseR = calcVisualRadius(snake.score, config);

  for (let i = 0; i < segCount; i++) {
    const pathIdx = i;
    const px = path.getX(pathIdx);
    const py = path.getY(pathIdx);
    const pa = path.getAngle(pathIdx);
    const resolved = skinResolved.segments[i] ?? skinResolved.segments[skinResolved.segments.length - 1];
    const isHead = i === 0;

    // Head: slightly larger than body (1.05x, not 1.44x)
    // Body: uniform width, no tapering
    let taperRadius: number;
    let sizeScale: number;
    if (isHead) {
      sizeScale = config.headSize;
      taperRadius = baseR * sizeScale;
    } else {
      sizeScale = resolved?.sizeScale ?? 1;
      // Uniform body width — no tapering
      taperRadius = baseR;
    }

    segments.push({
      x: px,
      y: py,
      angle: pa,
      visualRadius: baseR * sizeScale,
      taperRadius,
      collisionRadius: calcCollisionRadius(taperRadius),
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
  rewardMultiplier, botCount = 30, isPractice = false,
  configOverrides, onExit, onMatchEnd,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AnyEngine | null>(null);
  const cameraRef = useRef<CameraState>(createDefaultCamera());
  const phaseRef = useRef<GamePhase>('playing');
  const atlasRef = useRef(new SkinAtlasManager());
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
    const engine = engineRef.current;
    if (engine instanceof OfflineEngine) {
      engine.triggerPlayerEmote(key);
    } else if (engine instanceof OnlineEngine) {
      engine.sendEmote(key);
    }
  }, []);

  const handleToggleMinimap = useCallback(() => {
    setShowMinimap(prev => !prev);
  }, []);

  const handleExit = useCallback(() => { onExit?.(); }, [onExit]);

  const { inputRef } = useGameInput(
    canvasRef, handleEmote, handleToggleMinimap, handleExit,
  );

  // ── Keep phaseRef in sync ─────────────────────────────────────────────────

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ── Initialize Engine ─────────────────────────────────────────────────────

  useEffect(() => {
    if (effectiveMode === 'offline') {
      const engine = new OfflineEngine(playerIdentity, configOverrides, botCount);
      engine.onDeath = (state) => {
        setEndState(state);
        setPhase('ended');
        // Don't auto-exit — let user see the end screen and click Back to Lobby
      };
      engineRef.current = engine;
      return () => {
        engineRef.current?.destroy();
        engineRef.current = null;
      };
    }

    // Online engine
    const engine = new OnlineEngine(
      playerIdentity, arenaId, arenaName, isPractice,
      rewardMultiplier, configOverrides,
    );
    engine.onPhaseChange = (p) => setPhase(p);
    engine.onDeath = (state) => {
      setEndState(state);
      setPhase('ended');
      // Don't auto-exit — let user see end screen and click Back to Lobby
    };
    engine.onKillFeed = () => {};
    engine.onError = (msg) => {
      setEndState({
        outcome: 'death',
        score: 0, kills: 0, xpGained: 0,
        durationSeconds: 0, isOffline: isPractice,
        arenaName,
      });
      setPhase('ended');
    };
    engineRef.current = engine;
    // Connect as guest
    engine.connect('guest').catch(() => {});

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [effectiveMode, arenaId]);

  // ── Render Loop ───────────────────────────────────────────────────────────

  const renderCallback = useCallback((time: number, _delta: number) => {
    try {
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

    // Tick / extrapolate engine
    if (engine instanceof OfflineEngine) {
      engine.tick(inputRef.current, _delta > 0 ? _delta : 16.67);
    } else if (engine instanceof OnlineEngine) {
      engine.sendInput(inputRef.current);
      engine.extrapolate(_delta > 0 ? _delta / 1000 : 1 / 60);
      engine.updateParticles();
    }

    const timeSeconds = time / 1000;
    const atlas = atlasRef.current;

    // ── Gather render data from engine ─────────────────────────────────────
    let snakes: SnakeState[];
    let food: FoodOrb[] = [];
    let stars: StarChip[] = [];
    let killFeed: import('@/lib/snake/types').KillFeedEntry[] = [];
    let particleArray: Particle[] = [];
    let player: SnakeState | null = null;

    if (engine instanceof OfflineEngine) {
      snakes = engine.snakes;
      food = engine.food;
      killFeed = engine.killFeed;
      particleArray = engine.particles as unknown as Particle[];
    } else {
      // OnlineEngine
      snakes = engine.getRenderableSnakes();
      if (engine.latestSnapshot) {
        food = engine.latestSnapshot.food;
        stars = engine.latestSnapshot.stars;
      }
      killFeed = engine.killFeed;
      particleArray = engine.particles;
    }

    // Find player snake
    player = snakes.find(s => s.identity.id === playerIdentity.id && s.alive) ?? null;

    // Camera follow player
    if (player) {
      cameraRef.current = followTarget(cameraRef.current, player.head.x, player.head.y, config.camFollowSpeed);
      const targetZoom = Math.max(config.camMinZoom, 1.0 - (player.score / config.maxLength) * 0.5);
      cameraRef.current.zoom += (targetZoom - cameraRef.current.zoom) * config.camZoomSmooth;
    }

    // Update HUD
    const hud = hudRef.current;
    hud.fps = _delta > 0 ? Math.round(1000 / _delta) : 60;
    if (engine instanceof OfflineEngine) {
      hud.score = player?.score ?? 0;
      hud.kills = player?.kills ?? 0;
      hud.rank = engine.getPlayerRank();
      hud.botCount = engine.snakes.filter(s => s.identity.isBot && s.alive).length;
    } else {
      // HUD values already updated by OnlineEngine.processSnapshot
      Object.assign(hud, engine.hud);
    }
    hud.showMinimap = showMinimap;

    const camera = cameraRef.current;

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
    renderFoods(ctx, food, camera, w, h);

    // Stars (online only)
    if (stars.length > 0) {
      renderStars(ctx, stars, timeSeconds, camera, w, h);
    }

    // Snakes
    const lowQuality = hud.fps < 25;
    for (const snake of snakes) {
      if (!snake.alive) continue;
      if (!isOnScreen(snake.head.x, snake.head.y, 50, camera, w, h)) continue;

      // Ensure atlas is initialized for this skin
      if (!atlas.hasSkin(snake.identity.skinId)) {
        atlas.initSkin(
          snake.identity.skinId,
          snake.identity.primaryColor,
          snake.identity.secondaryColor,
          snake.identity.skinRarity ?? 'common',
          snake.identity.bodyStyle,
          snake.identity.hat,
        );
      }

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
        w,
        h,
        atlas,
      );
    }

    // Name labels & emotes for nearby snakes
    if (player && player.alive) {
      for (const snake of snakes) {
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
    renderKillFeed(ctx, killFeed, timeSeconds, w);

    // Particles
    renderParticles(ctx, particleArray, camera, w, h);

    // Minimap
    if (showMinimap && !hud.isOffline) {
      renderMinimap(ctx, snakes, player, engine.map, w, h, config);
    }

    // HUD
    renderHUD(ctx, hud, w, h);

    } catch (err) {
      console.error('[VenomArena] render frame error:', err);
    }

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
            {endState.score === 0 && endState.kills === 0 && endState.durationSeconds === 0 ? (
              <>
                <div className="text-4xl mb-4">📡</div>
                <h2 className="text-2xl font-bold text-white mb-2">Connection Failed</h2>
                <p className="text-slate-400 mb-6">Could not connect to the game server. Please try again later.</p>
              </>
            ) : (
              <>
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
              </>
            )}
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
