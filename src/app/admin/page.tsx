'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, RotateCcw, Save, Settings, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/* ────────────────────────── Types ────────────────────────── */

interface GameConfigItem {
  id: string;
  key: string;
  value: number | boolean | string;
  label: string;
  category: string;
  order: number;
  type: 'number' | 'boolean' | 'string';
  updatedAt: string;
}

/* ────────────────────────── Constants ────────────────────────── */

const CATEGORY_DISPLAY: Record<string, string> = {
  snake_physics: '\u{1F40D} Snake Physics',
  snake_growth: '\u{1F4C8} Growth',
  boost_system: '\u26A1 Boost',
  collision: '\u{1F4A5} Collision',
  food_system: '\u{1F34E} Food System',
  extraction: '\u{1F681} Extraction',
  spawning: '\u{1F4CD} Spawning',
  map_settings: '\u{1F5FA} Map',
  bot_settings: '\u{1F916} Bot Settings',
  economy: '\u{1F4B0} Economy',
};

/* ────────────────────────── Helpers ────────────────────────── */

function getStep(value: number): string {
  if (Number.isInteger(value)) return '1';
  const decimals = value.toString().split('.')[1];
  return decimals && decimals.length <= 2 ? '0.1' : '0.001';
}

function isModified(original: GameConfigItem, current: GameConfigItem): boolean {
  return original.value !== current.value;
}

/* ────────────────────────── Component ────────────────────────── */

export default function AdminConfigPage() {
  const [configs, setConfigs] = useState<GameConfigItem[]>([]);
  const [originalConfigs, setOriginalConfigs] = useState<GameConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const initialTabRef = useRef<string | null>(null);

  /* ── Fetch ── */
  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/config');
      if (!res.ok) throw new Error('Failed to fetch configs');
      const data: GameConfigItem[] = await res.json();
      setConfigs(data);
      setOriginalConfigs(data);
    } catch (err) {
      toast.error('Failed to load configuration', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfigs();
  }, [fetchConfigs]);

  /* ── Group by category ── */
  const categories = useMemo(() => {
    const cats = new Map<string, GameConfigItem[]>();
    for (const c of configs) {
      const list = cats.get(c.category) ?? [];
      list.push(c);
      cats.set(c.category, list);
    }
    // Return in the display order defined in CATEGORY_DISPLAY
    const ordered: { key: string; items: GameConfigItem[] }[] = [];
    for (const key of Object.keys(CATEGORY_DISPLAY)) {
      if (cats.has(key)) {
        ordered.push({ key, items: cats.get(key)! });
      }
    }
    // Catch any unlisted categories
    for (const [key, items] of cats) {
      if (!CATEGORY_DISPLAY[key]) {
        ordered.push({ key, items });
      }
    }
    return ordered;
  }, [configs]);

  const activeTab = categories[0]?.key ?? '';

  // Remember which tab user first selected
  function handleTabChange(value: string) {
    if (!initialTabRef.current) initialTabRef.current = value;
  }

  /* ── Mutations ── */
  function updateValue(key: string, newValue: GameConfigItem['value']) {
    setConfigs((prev) =>
      prev.map((c) => (c.key === key ? { ...c, value: newValue } : c)),
    );
  }

  function updateNumberValue(key: string, raw: string) {
    const num = Number(raw);
    if (raw === '' || Number.isNaN(num)) return;
    updateValue(key, num);
  }

  /* ── Count changed ── */
  const changedCount = useMemo(() => {
    let count = 0;
    for (const cur of configs) {
      const orig = originalConfigs.find((o) => o.key === cur.key);
      if (orig && isModified(orig, cur)) count++;
    }
    return count;
  }, [configs, originalConfigs]);

  /* ── Save All ── */
  async function handleSaveAll() {
    setSaving(true);
    const updates: { key: string; value: GameConfigItem['value'] }[] = [];
    for (const cur of configs) {
      const orig = originalConfigs.find((o) => o.key === cur.key);
      if (orig && isModified(orig, cur)) {
        updates.push({ key: cur.key, value: cur.value });
      }
    }
    if (updates.length === 0) {
      toast.info('No changes to save.');
      setSaving(false);
      return;
    }
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error('Save request failed');
      const data: GameConfigItem[] = await res.json();
      setConfigs(data);
      setOriginalConfigs(data);
      toast.success(`${updates.length} config${updates.length > 1 ? 's' : ''} updated successfully.`);
    } catch (err) {
      toast.error('Failed to save configuration', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  }

  /* ── Reset to Defaults ── */
  async function handleResetDefaults() {
    setSeeding(true);
    try {
      const res = await fetch('/api/admin/config/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Seed request failed');
      toast.success('Defaults re-seeded. Reloading configs\u2026');
      await fetchConfigs();
    } catch (err) {
      toast.error('Failed to reset defaults', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSeeding(false);
    }
  }

  /* ──────────────── Render: Loading Skeleton ──────────────── */

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Header skeleton */}
        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 h-14">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-5 w-24" />
        </header>
        <div className="p-4 sm:p-6 space-y-6">
          <Skeleton className="h-10 w-full max-w-4xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ──────────────── Render: Main ──────────────── */

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 h-14 shrink-0">
        <div className="flex items-center gap-2.5">
          <Settings className="h-5 w-5 text-emerald-400 shrink-0" />
          <h1 className="text-sm font-bold tracking-wide uppercase text-white">
            Game Config Admin
          </h1>
          <Badge
            variant="outline"
            className="ml-1 text-[10px] font-mono border-emerald-500/30 text-emerald-400"
          >
            LIVE
          </Badge>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to Arena</span>
        </Link>
      </header>

      {/* ── Body ── */}
      <ScrollArea className="flex-1">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* ── Category Tabs ── */}
          <Tabs
            defaultValue={activeTab}
            onValueChange={handleTabChange}
            className="w-full"
          >
            {/* Tab triggers — horizontally scrollable on mobile */}
            <ScrollArea className="w-full -mx-4 sm:mx-0 px-4 sm:px-0">
              <TabsList className="flex w-max gap-1 bg-slate-900 border border-slate-800 p-1">
                {categories.map((cat) => (
                  <TabsTrigger
                    key={cat.key}
                    value={cat.key}
                    className="text-xs sm:text-sm whitespace-nowrap data-[state=active]:bg-slate-800 data-[state=active]:text-emerald-400 data-[state=active]:shadow-sm"
                  >
                    {CATEGORY_DISPLAY[cat.key] ?? cat.key}
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>

            {/* ── Tab Content Panels ── */}
            {categories.map((cat) => (
              <TabsContent key={cat.key} value={cat.key}>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {cat.items.map((config) => {
                    const orig = originalConfigs.find((o) => o.key === config.key);
                    const changed = orig ? isModified(orig, config) : false;

                    return (
                      <Card
                        key={config.key}
                        className={`relative bg-slate-900 border-slate-800 transition-colors py-4 gap-3 ${
                          changed
                            ? 'border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                            : 'hover:border-slate-700'
                        }`}
                      >
                        {/* Changed indicator dot */}
                        {changed && (
                          <div className="absolute top-3 right-3">
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono px-1.5 py-0 border-emerald-500/40 text-emerald-400"
                            >
                              MODIFIED
                            </Badge>
                          </div>
                        )}

                        <CardHeader className="pb-0 pt-0 px-4 gap-1">
                          <CardTitle className="text-sm font-semibold text-white leading-tight pr-20">
                            {config.label}
                          </CardTitle>
                          <CardDescription className="text-[11px] font-mono text-slate-500">
                            {config.key}
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="px-4 pb-0 pt-0">
                          {config.type === 'boolean' && (
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={!!config.value}
                                onCheckedChange={(checked) =>
                                  updateValue(config.key, checked)
                                }
                              />
                              <span className="text-xs font-mono text-slate-400">
                                {config.value ? 'true' : 'false'}
                              </span>
                            </div>
                          )}

                          {config.type === 'number' && (
                            <div className="space-y-1">
                              <Input
                                type="number"
                                step={getStep(config.value as number)}
                                value={config.value as number}
                                onChange={(e) =>
                                  updateNumberValue(config.key, e.target.value)
                                }
                                className={`font-mono text-sm h-9 ${
                                  changed
                                    ? 'border-emerald-500/60 focus-visible:border-emerald-400 focus-visible:ring-emerald-500/30'
                                    : ''
                                }`}
                              />
                            </div>
                          )}

                          {config.type === 'string' && (
                            <Input
                              type="text"
                              value={config.value as string}
                              onChange={(e) =>
                                updateValue(config.key, e.target.value)
                              }
                              className={`font-mono text-sm h-9 ${
                                changed
                                  ? 'border-emerald-500/60 focus-visible:border-emerald-400 focus-visible:ring-emerald-500/30'
                                  : ''
                              }`}
                            />
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* ── Bottom Action Bar ── */}
          <Separator className="bg-slate-800" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8">
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={handleSaveAll}
                disabled={saving || changedCount === 0}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-2 px-6 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save All Changes
                {changedCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-mono px-1.5 py-0"
                  >
                    {changedCount}
                  </Badge>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={handleResetDefaults}
                disabled={seeding}
                className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {seeding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Reset to Defaults
              </Button>
            </div>

            <p className="text-[11px] text-slate-500 font-mono">
              {configs.length} config items across {categories.length} categories
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
