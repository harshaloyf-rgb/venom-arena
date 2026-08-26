'use client';

import { useState, useEffect, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ArrowLeft, HelpCircle, RotateCcw, Save, ChevronDown } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface AdminParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  helpText?: string;
}

export interface AdminSection {
  title: string;
  params: AdminParam[];
}

// ============================================================================
// Mutable Config Object — game engines import this to read live values
// ============================================================================

export const GAME_TUNING_CFG: Record<string, number> = {};

// ============================================================================
// Default values (immutable reference for reset)
// ============================================================================

export const DEFAULTS_CFG: Record<string, number> = {
  // MAP & GRID
  mapRadius: 2000,
  gridSize: 40,

  // SNAKE BODY
  startLength: 10,
  minLength: 3,
  maxLength: 500,
  minThick: 4,
  maxThick: 30,
  segSpacing: 4,

  // SPEED & TURN
  baseSpeed: 3,
  boostSpeed: 6,
  turnThin: 0.08,
  turnFat: 0.03,
  turnBoost: 1.5,

  // GROWTH & SCORE
  ptsPerSegment: 10,
  growthMult: 1,
  scorePerPt: 1,
  maxScore: 99999,

  // FOOD SPAWN
  foodCount: 300,
  foodCapMult: 1.5,
  eatRadius: 30,
  foodSmallValue: 1,
  foodMedValue: 3,
  foodLargeValue: 5,
  foodSmallChance: 0.6,
  foodMedChance: 0.3,
  foodLargeChance: 0.1,
  foodSmallRadius: 8,
  foodMedRadius: 12,
  foodLargeRadius: 18,

  // BOOST DRAIN
  drainRate: 0.5,
  dropValue: 5,
  dropSpread: 20,
  burstCount: 3,
  burstValue: 2,
  scoreDrainPerSec: 10,
  minScore: 0,
  tier2Threshold: 50,
  tier2Value: 3,
  tier3Threshold: 100,
  tier3Value: 1,

  // DEATH DROP
  deathDropLargeChance: 0.3,
  deathDropMedChance: 0.5,
  deathDropMaxOrbs: 15,

  // CAMERA
  camMinZoom: 0.3,
  camZoomSmooth: 0.05,
  camFollowSpeed: 0.1,

  // SKIN APPEARANCE
  headSize: 1.2,
  lightOffset: 0.3,
  brightBoost: 0.15,
  shadowDark: 0.3,
  baseSize: 8,
  maxSize: 30,
  growthCurve: 0.5,
  skinSegSpacing: 4,

  // BOTS
  botCount: 10,
  botFoodRange: 500,
  botRespawn: 3,
  botMinStart: 5,
  botMaxStart: 30,
  botWarnPct: 0.8,
  botDangerPct: 0.9,

  // COLLISION
  skipSegs: 5,
};

// ============================================================================
// Section definitions (~55 sliders across 11 sections)
// ============================================================================

const SECTIONS: AdminSection[] = [
  {
    title: 'MAP & GRID',
    params: [
      { key: 'mapRadius', label: 'Map Radius', min: 500, max: 5000, step: 100, unit: 'px', helpText: 'The radius of the circular game map. Larger maps give snakes more room but make food harder to find.' },
      { key: 'gridSize', label: 'Grid Size', min: 10, max: 100, step: 5, unit: 'px', helpText: 'The size of background grid cells. Smaller grids look finer but may impact performance.' },
    ],
  },
  {
    title: 'SNAKE BODY',
    params: [
      { key: 'startLength', label: 'Start Length', min: 1, max: 50, step: 1, helpText: 'How many segments a new snake starts with.' },
      { key: 'minLength', label: 'Min Length', min: 1, max: 20, step: 1, helpText: 'The minimum segment count a snake can shrink to before dying.' },
      { key: 'maxLength', label: 'Max Length', min: 50, max: 2000, step: 10, helpText: 'The hard cap on how long a snake can grow.' },
      { key: 'minThick', label: 'Min Thick', min: 1, max: 20, step: 0.5, unit: 'px', helpText: 'The minimum thickness (width) of a snake body segment when short.' },
      { key: 'maxThick', label: 'Max Thick', min: 10, max: 80, step: 1, unit: 'px', helpText: 'The maximum thickness of a snake body segment when fully grown.' },
      { key: 'segSpacing', label: 'Seg Spacing', min: 1, max: 20, step: 0.5, unit: 'px', helpText: 'Distance between consecutive body segments.' },
    ],
  },
  {
    title: 'SPEED & TURN',
    params: [
      { key: 'baseSpeed', label: 'Base Speed', min: 1, max: 10, step: 0.1, unit: 'px/tick', helpText: 'Normal movement speed of all snakes.' },
      { key: 'boostSpeed', label: 'Boost Speed', min: 2, max: 15, step: 0.1, unit: 'px/tick', helpText: 'Speed when the boost button is held.' },
      { key: 'turnThin', label: 'Turn Thin', min: 0.01, max: 0.3, step: 0.01, helpText: 'How fast a thin (short) snake can turn per tick. Higher = more agile.' },
      { key: 'turnFat', label: 'Turn Fat', min: 0.01, max: 0.2, step: 0.01, helpText: 'How fast a thick (long) snake can turn per tick. Lower = more sluggish.' },
      { key: 'turnBoost', label: 'Turn Boost', min: 1, max: 3, step: 0.1, unit: 'x', helpText: 'Turn rate multiplier applied when boosting.' },
    ],
  },
  {
    title: 'GROWTH & SCORE',
    params: [
      { key: 'ptsPerSegment', label: 'Pts / Segment', min: 1, max: 50, step: 1, helpText: 'Growth points earned per food segment consumed.' },
      { key: 'growthMult', label: 'Growth Mult', min: 0.1, max: 5, step: 0.1, unit: 'x', helpText: 'Global multiplier on growth rate. >1 = faster growth.' },
      { key: 'scorePerPt', label: 'Score / Pt', min: 0.1, max: 10, step: 0.1, helpText: 'How much score each growth point translates to.' },
      { key: 'maxScore', label: 'Max Score', min: 100, max: 999999, step: 100, helpText: 'The absolute maximum score a player can reach.' },
    ],
  },
  {
    title: 'FOOD SPAWN',
    params: [
      { key: 'foodCount', label: 'Count', min: 50, max: 1000, step: 10, helpText: 'Target number of food items on the map at any time.' },
      { key: 'foodCapMult', label: 'Cap Mult', min: 1, max: 5, step: 0.1, unit: 'x', helpText: 'Multiplier for food cap based on player count.' },
      { key: 'eatRadius', label: 'Eat Radius', min: 10, max: 100, step: 1, unit: 'px', helpText: 'How close a snake head must be to food to eat it.' },
      { key: 'foodSmallValue', label: 'S Value', min: 1, max: 10, step: 1, helpText: 'Growth points given by small food orbs.' },
      { key: 'foodMedValue', label: 'M Value', min: 1, max: 20, step: 1, helpText: 'Growth points given by medium food orbs.' },
      { key: 'foodLargeValue', label: 'L Value', min: 1, max: 50, step: 1, helpText: 'Growth points given by large food orbs.' },
      { key: 'foodSmallChance', label: 'S Chance', min: 0, max: 1, step: 0.05, unit: '%', helpText: 'Probability of spawning a small food orb (0-1).' },
      { key: 'foodMedChance', label: 'M Chance', min: 0, max: 1, step: 0.05, unit: '%', helpText: 'Probability of spawning a medium food orb (0-1).' },
      { key: 'foodLargeChance', label: 'L Chance', min: 0, max: 1, step: 0.05, unit: '%', helpText: 'Probability of spawning a large food orb (0-1).' },
      { key: 'foodSmallRadius', label: 'S Radius', min: 3, max: 20, step: 1, unit: 'px', helpText: 'Visual/collision radius of small food orbs.' },
      { key: 'foodMedRadius', label: 'M Radius', min: 5, max: 30, step: 1, unit: 'px', helpText: 'Visual/collision radius of medium food orbs.' },
      { key: 'foodLargeRadius', label: 'L Radius', min: 10, max: 50, step: 1, unit: 'px', helpText: 'Visual/collision radius of large food orbs.' },
    ],
  },
  {
    title: 'BOOST DRAIN',
    params: [
      { key: 'drainRate', label: 'Drain Rate', min: 0.1, max: 5, step: 0.1, unit: '/s', helpText: 'How fast length is consumed per second while boosting.' },
      { key: 'dropValue', label: 'Drop Value', min: 1, max: 20, step: 1, helpText: 'Growth points of each food orb shed while boosting.' },
      { key: 'dropSpread', label: 'Drop Spread', min: 5, max: 100, step: 1, unit: 'px', helpText: 'How far behind the snake tail the dropped orbs appear.' },
      { key: 'burstCount', label: 'Burst Count', min: 1, max: 10, step: 1, helpText: 'Number of food orbs dropped per drain burst.' },
      { key: 'burstValue', label: 'Burst Value', min: 1, max: 10, step: 1, helpText: 'Score value of each orb in a burst drop.' },
      { key: 'scoreDrainPerSec', label: 'Score Drain/s', min: 1, max: 50, step: 1, helpText: 'Points of score lost per second while boosting.' },
      { key: 'minScore', label: 'Min Score', min: 0, max: 100, step: 1, helpText: 'Minimum score floor — score cannot drop below this.' },
      { key: 'tier2Threshold', label: 'Tier 2 Thresh', min: 10, max: 200, step: 5, helpText: 'Score at which drain enters tier 2 (faster drain).' },
      { key: 'tier2Value', label: 'Tier 2 Value', min: 1, max: 10, step: 0.5, unit: 'x', helpText: 'Drain multiplier in tier 2.' },
      { key: 'tier3Threshold', label: 'Tier 3 Thresh', min: 20, max: 500, step: 5, helpText: 'Score at which drain enters tier 3 (fastest drain).' },
      { key: 'tier3Value', label: 'Tier 3 Value', min: 0.1, max: 5, step: 0.1, unit: 'x', helpText: 'Drain multiplier in tier 3.' },
    ],
  },
  {
    title: 'DEATH DROP',
    params: [
      { key: 'deathDropLargeChance', label: 'L Chance', min: 0, max: 1, step: 0.05, helpText: 'Probability that a death-drop orb is large.' },
      { key: 'deathDropMedChance', label: 'M Chance', min: 0, max: 1, step: 0.05, helpText: 'Probability that a death-drop orb is medium. Remainder is small.' },
      { key: 'deathDropMaxOrbs', label: 'Max Orbs', min: 1, max: 50, step: 1, helpText: 'Maximum number of food orbs produced when a snake dies.' },
    ],
  },
  {
    title: 'CAMERA',
    params: [
      { key: 'camMinZoom', label: 'Min Zoom', min: 0.1, max: 1, step: 0.05, unit: 'x', helpText: 'Minimum camera zoom level. Lower = zoomed out further.' },
      { key: 'camZoomSmooth', label: 'Zoom Smooth', min: 0.01, max: 0.2, step: 0.01, helpText: 'Camera zoom lerp factor per frame. Higher = snappier zoom.' },
      { key: 'camFollowSpeed', label: 'Follow Speed', min: 0.01, max: 0.5, step: 0.01, helpText: 'How fast the camera follows the snake head. Higher = tighter tracking.' },
    ],
  },
  {
    title: 'SKIN APPEARANCE',
    params: [
      { key: 'headSize', label: 'Head Size', min: 0.5, max: 3, step: 0.1, unit: 'x', helpText: 'Multiplied against body thickness to determine head size.' },
      { key: 'lightOffset', label: 'Light Offset', min: 0, max: 1, step: 0.05, helpText: 'Position of the highlight on each segment (0=center, 1=edge).' },
      { key: 'brightBoost', label: 'Bright Boost', min: 0, max: 0.5, step: 0.01, helpText: 'How much brighter the lit side of the snake is.' },
      { key: 'shadowDark', label: 'Shadow Dark', min: 0, max: 0.8, step: 0.05, helpText: 'How much darker the shadow side of the snake is.' },
      { key: 'baseSize', label: 'Base Size', min: 2, max: 30, step: 1, unit: 'px', helpText: 'The base visual size of skin pattern elements.' },
      { key: 'maxSize', label: 'Max Size', min: 10, max: 80, step: 1, unit: 'px', helpText: 'Maximum visual size of skin pattern elements when grown.' },
      { key: 'growthCurve', label: 'Growth Curve', min: 0.1, max: 2, step: 0.05, helpText: 'Controls how quickly visual size scales with length. Higher = faster scaling.' },
      { key: 'skinSegSpacing', label: 'Seg Spacing', min: 1, max: 20, step: 0.5, unit: 'px', helpText: 'Visual gap between skin pattern segments on the snake body.' },
    ],
  },
  {
    title: 'BOTS',
    params: [
      { key: 'botCount', label: 'Count', min: 0, max: 50, step: 1, helpText: 'Number of AI bots to spawn in the game.' },
      { key: 'botFoodRange', label: 'Food Range', min: 100, max: 2000, step: 50, unit: 'px', helpText: 'How far a bot will scan for nearby food.' },
      { key: 'botRespawn', label: 'Respawn', min: 1, max: 10, step: 0.5, unit: 's', helpText: 'Seconds before a dead bot respawns.' },
      { key: 'botMinStart', label: 'Min Start', min: 1, max: 20, step: 1, helpText: 'Minimum starting length for a bot.' },
      { key: 'botMaxStart', label: 'Max Start', min: 5, max: 100, step: 1, helpText: 'Maximum starting length for a bot.' },
      { key: 'botWarnPct', label: 'Warn %', min: 0.5, max: 1, step: 0.05, helpText: 'When a bot\'s length is at this % of max, it becomes cautious.' },
      { key: 'botDangerPct', label: 'Danger %', min: 0.5, max: 1, step: 0.05, helpText: 'When a bot\'s length exceeds this % of max, it actively flees threats.' },
    ],
  },
  {
    title: 'COLLISION',
    params: [
      { key: 'skipSegs', label: 'Skip Segs', min: 0, max: 20, step: 1, helpText: 'Number of head-adjacent segments to skip when checking self-collision.' },
    ],
  },
];

// ============================================================================
// Persistence helpers
// ============================================================================

const STORAGE_KEY = 'game_tuning_cfg';

export function saveTuningCFG(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(GAME_TUNING_CFG));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function loadTuningCFG(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: Record<string, unknown> = JSON.parse(raw);
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === 'number' && isFinite(val) && !isNaN(val)) {
        GAME_TUNING_CFG[key] = val;
      }
    }
  } catch {
    // corrupted data — skip
  }
}

// Initialize on module load
loadTuningCFG();

// Fill in any missing keys from defaults
for (const [key, val] of Object.entries(DEFAULTS_CFG)) {
  if (!(key in GAME_TUNING_CFG)) {
    GAME_TUNING_CFG[key] = val;
  }
}

// ============================================================================
// Component
// ============================================================================

interface AdminGameTuningProps {
  open: boolean;
  onClose: () => void;
}

export function AdminGameTuning({ open, onClose }: AdminGameTuningProps) {
  const [, setTick] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  // Sync initial values from CFG into state snapshot on first render
  const [localValues, setLocalValues] = useState<Record<string, number>>(() => {
    const snap: Record<string, number> = {};
    for (const section of SECTIONS) {
      for (const p of section.params) {
        snap[p.key] = GAME_TUNING_CFG[p.key] ?? DEFAULTS_CFG[p.key] ?? p.min;
      }
    }
    return snap;
  });

  const handleChange = useCallback((key: string, value: number) => {
    GAME_TUNING_CFG[key] = value;
    setLocalValues(prev => ({ ...prev, [key]: value }));
    saveTuningCFG();
    setTick(n => n + 1);
  }, []);

  const handleNumberInput = useCallback(
    (key: string, raw: string, param: AdminParam) => {
      const num = parseFloat(raw);
      if (isNaN(num)) return;
      const clamped = Math.min(param.max, Math.max(param.min, num));
      handleChange(key, clamped);
    },
    [handleChange],
  );

  const resetAll = useCallback(() => {
    for (const [key, val] of Object.entries(DEFAULTS_CFG)) {
      GAME_TUNING_CFG[key] = val;
    }
    saveTuningCFG();
    setLocalValues({ ...DEFAULTS_CFG });
    setTick(n => n + 1);
  }, []);

  const resetSection = useCallback((section: AdminSection) => {
    const updated = { ...localValues };
    for (const p of section.params) {
      const def = DEFAULTS_CFG[p.key] ?? p.min;
      GAME_TUNING_CFG[p.key] = def;
      updated[p.key] = def;
    }
    saveTuningCFG();
    setLocalValues(updated);
    setTick(n => n + 1);
  }, [localValues]);

  const saveAndClose = useCallback(() => {
    saveTuningCFG();
    onClose();
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const totalParams = SECTIONS.reduce((sum, s) => sum + s.params.length, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Game Tuning Admin Panel"
    >
      {/* Panel container */}
      <div className="flex h-full w-full max-w-[500px] flex-col bg-zinc-950 text-zinc-100 shadow-2xl">
        {/* ── Header ── */}
        <header className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            onClick={onClose}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold tracking-wide" style={{ color: '#ffa502' }}>
            GAME TUNING
          </h1>
          <span className="ml-auto text-xs text-zinc-500">
            {totalParams} params
          </span>
        </header>

        {/* ── Action bar ── */}
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            onClick={resetAll}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            onClick={() => { saveTuningCFG(); setTick(n => n + 1); }}
          >
            <Save className="h-3.5 w-3.5" />
            Save Now
          </Button>
          <div className="flex-1" />
          <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Help
                <ChevronDown className={`h-3 w-3 transition-transform ${helpOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        {/* ── Collapsible help guide ── */}
        <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
          <CollapsibleContent>
            <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
              <p className="mb-2 text-xs font-medium text-zinc-300">
                🎮 How Game Tuning Works
              </p>
              <ul className="space-y-1 text-xs leading-relaxed text-zinc-400">
                <li>• Drag sliders or type values to adjust game parameters in real-time.</li>
                <li>• Changes take effect immediately and are auto-saved to your browser.</li>
                <li>• Use &quot;Reset All&quot; to restore every parameter to its default value.</li>
                <li>• Use &quot;Set as Default&quot; (per section) to save current values as the new defaults.</li>
                <li>• Each parameter has a description in the help tooltips below.</li>
                <li>• Close and reopen the panel — your settings persist across sessions.</li>
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ── Scrollable sections ── */}
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-4 pb-8">
            {SECTIONS.map((section) => {
              const sectionDefaultsMatch = section.params.every(
                (p) =>
                  Math.abs((localValues[p.key] ?? 0) - (DEFAULTS_CFG[p.key] ?? 0)) <
                  0.0001,
              );

              return (
                <Card
                  key={section.title}
                  className="border-zinc-800 bg-zinc-900/80 text-zinc-100"
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3">
                    <CardTitle
                      className="text-sm font-bold tracking-wider"
                      style={{ color: '#ffa502' }}
                    >
                      {section.title}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 gap-1 text-[11px] ${sectionDefaultsMatch ? 'text-zinc-600' : 'text-zinc-400 hover:text-orange-400'}`}
                      onClick={() => resetSection(section)}
                      disabled={sectionDefaultsMatch}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Set as Default
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4">
                    {section.params.map((param) => {
                      const value =
                        localValues[param.key] ??
                        DEFAULTS_CFG[param.key] ??
                        param.min;
                      const isDefault =
                        Math.abs(value - (DEFAULTS_CFG[param.key] ?? param.min)) <
                        0.0001;

                      return (
                        <div key={param.key} className="space-y-1">
                          <div className="flex items-center gap-3">
                            {/* Label */}
                            <label
                              className="w-[110px] shrink-0 truncate text-xs text-zinc-300"
                              htmlFor={`tune-${param.key}`}
                              title={param.helpText}
                            >
                              {param.label}
                              {!isDefault && (
                                <span
                                  className="ml-1 inline-block h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: '#ffa502' }}
                                  aria-label="Modified from default"
                                />
                              )}
                            </label>

                            {/* Slider */}
                            <div className="min-w-0 flex-1">
                              <Slider
                                id={`tune-${param.key}`}
                                min={param.min}
                                max={param.max}
                                step={param.step}
                                value={[value]}
                                onValueChange={([v]) =>
                                  handleChange(param.key, v)
                                }
                                className="py-1"
                              />
                            </div>

                            {/* Number input */}
                            <div className="relative w-[72px] shrink-0">
                              <Input
                                type="number"
                                min={param.min}
                                max={param.max}
                                step={param.step}
                                value={value}
                                onChange={(e) =>
                                  handleNumberInput(param.key, e.target.value, param)
                                }
                                className="h-7 w-full rounded border-zinc-700 bg-zinc-800 px-2 text-right text-xs tabular-nums text-zinc-100 focus-visible:ring-orange-500/50 focus-visible:border-orange-500/50"
                              />
                              {param.unit && (
                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">
                                  {param.unit}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>

        {/* ── Footer ── */}
        <footer className="flex shrink-0 items-center justify-between border-t border-zinc-800 px-4 py-3">
          <p className="text-[11px] text-zinc-600">
            Auto-saved to browser storage
          </p>
          <Button
            size="sm"
            className="font-semibold"
            style={{
              backgroundColor: '#ffa502',
              color: '#000',
            }}
            onClick={saveAndClose}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#ffb833';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#ffa502';
            }}
          >
            Done
          </Button>
        </footer>
      </div>
    </div>
  );
}
