'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/providers/auth-provider';
import { GameRulesModal } from '@/components/modals/game-rules-modal';
import { COUNTRIES, regionOf, REGION_NAMES } from '@/lib/game-config';
import {
  Skull,
  Zap,
  LogIn,
  UserPlus,
  Ghost,
  Loader2,
  Eye,
  EyeOff,
  BookOpen,
  KeyRound,
  Mail,
  Shield,
  Globe,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Password strength calculator
// ---------------------------------------------------------------------------
function getPasswordStrength(pw: string): { label: string; color: string; width: string; score: number } {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: 'w-1/4', score };
  if (score <= 2) return { label: 'Fair', color: 'bg-orange-500', width: 'w-2/4', score };
  if (score <= 3) return { label: 'Good', color: 'bg-yellow-500', width: 'w-3/4', score };
  return { label: 'Strong', color: 'bg-emerald-500', width: 'w-full', score };
}

// ---------------------------------------------------------------------------
// Guest Play Section — country picker + play button
// ---------------------------------------------------------------------------
function GuestPlaySection({ busy, onPlay }: { busy: boolean; onPlay: (country: string) => Promise<boolean> }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const filtered = search
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 15)
    : COUNTRIES.slice(0, 30);

  const selectedCountry = COUNTRIES.find(c => c.code === selected);
  const playerRegion = selected ? regionOf(selected) : null;
  const regionName = playerRegion ? REGION_NAMES[playerRegion] : null;

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  return (
    <div className="space-y-1.5" ref={pickerRef}>
      {/* Country selector — REQUIRED */}
      <div className="space-y-1">
        <label className="flex items-center gap-1 text-[11px] font-medium text-foreground">
          <Globe className="w-3 h-3 text-primary" />
          Select your country <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs text-left transition ${
              selected
                ? 'border-primary/50 bg-primary/5'
                : 'border-border bg-background hover:bg-accent/50'
            }`}
          >
            {selectedCountry ? (
              <span className="flex items-center gap-1.5">
                <span className="text-base">{selectedCountry.flag}</span>
                <span className="font-medium">{selectedCountry.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Choose your country…</span>
            )}
          </button>

          {showPicker && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden">
              <div className="p-1.5 border-b border-border">
                <Input
                  placeholder="Search country..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-7 text-[11px]"
                  autoFocus
                />
              </div>
              <div className="max-h-40 overflow-y-auto">
                {filtered.map(c => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => { setSelected(c.code); setShowPicker(false); setSearch(''); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1 text-[11px] text-left hover:bg-accent/50 transition ${selected === c.code ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    <span>{c.flag}</span>
                    <span>{c.name}</span>
                    {selected === c.code && <span className="ml-auto text-[9px]">✓</span>}
                  </button>
                ))}
              </div>
              {selected && (
                <button
                  type="button"
                  onClick={() => { setSelected(''); setSearch(''); }}
                  className="w-full text-center py-1 text-[10px] text-muted-foreground hover:text-foreground border-t border-border transition"
                >
                  Clear selection
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Region badge — shows after country is selected */}
      {selectedCountry && regionName && (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/10 text-[10px] text-primary">
          <Zap className="w-3 h-3" />
          <span>Region: <strong>{regionName}</strong> — You&apos;ll play on the nearest server</span>
        </div>
      )}

      {/* Play button — disabled until country is selected */}
      <Button
        variant="secondary"
        size="sm"
        className="w-full text-xs"
        disabled={busy || !selected}
        onClick={async () => {
          if (!selected) return;
          await onPlay(selected);
        }}
      >
        {busy ? (
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        ) : (
          <Ghost className="w-3 h-3 mr-1" />
        )}
        Play as Guest
      </Button>
      {!selected && (
        <p className="text-[10px] text-muted-foreground text-center">
          Select your country to join your regional server
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthGate — loading skeleton → AuthScreen
// ---------------------------------------------------------------------------
export default function AuthGate() {
  const { loading, banned } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading arena…</p>
        </div>
      </div>
    );
  }
  // Audit U10: banned accounts get an explicit notice instead of being
  // silently dropped back to the sign-in screen with no explanation.
  if (banned) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30">
            <Skull className="w-5 h-5 text-red-400" />
          </div>
          <h1 className="text-lg font-bold text-red-400">Account Banned</h1>
          <p className="text-sm text-muted-foreground">
            This account has been suspended for violating the arena rules. If you believe this is a
            mistake, contact support with your player tag.
          </p>
        </div>
      </div>
    );
  }
  return <AuthScreen />;
}

// ---------------------------------------------------------------------------
// AuthScreen — main auth page with all tabs, social buttons, forgot password
// ---------------------------------------------------------------------------
function AuthScreen() {
  const { refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  // Per-tab error handling — clear error when switching tabs
  function handleTabChange(value: string) {
    setError(null);
  }

  async function callApi(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Something went wrong.');
        return false;
      }
      await refresh();
      return true;
    } catch {
      setError('Network error. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function handleSocialLogin(provider: string) {
    setError(null);
    // Redirect to the server-side OAuth initiation
    window.location.href = `/api/auth/social-login?provider=${provider}`;
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-3 py-0">
      <div className="w-full max-w-sm space-y-0.5">
        {/* Logo / Title */}
        <div className="text-center space-y-0">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 va-neon-border">
            <Skull className="w-4.5 h-4.5 text-primary va-neon-text" />
          </div>
          <h1 className="text-xl font-black tracking-tight va-neon-text">VENOM ARENA</h1>
          <p className="text-xs text-muted-foreground">
            Hunt. Harvest. Extract. <span className="text-primary font-semibold">Don&apos;t get caught.</span>
          </p>
        </div>

        <Card className="border-primary/20 bg-card/80 backdrop-blur py-1 gap-0.5">
          <CardHeader className="px-3 pb-0 gap-1">
            <CardTitle className="text-xs">Enter the arena</CardTitle>
            <CardDescription className="text-[11px]">Sign in or create an account to play.</CardDescription>
          </CardHeader>
          <CardContent className="px-3">
            <Tabs defaultValue="login" className="w-full gap-0.5" onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-2 h-7">
                <TabsTrigger value="login">
                  <LogIn className="w-3 h-3 mr-1" />
                  <span className="text-xs">Login</span>
                </TabsTrigger>
                <TabsTrigger value="register">
                  <UserPlus className="w-3 h-3 mr-1" />
                  <span className="text-xs">Register</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-1">
                <LoginForm busy={busy} error={error} onSubmit={callApi} onForgotPassword={() => { setError(null); setForgotOpen(true); }} />
              </TabsContent>

              <TabsContent value="register" className="mt-0">
                <RegisterForm busy={busy} error={error} onSubmit={callApi} />
              </TabsContent>
            </Tabs>

            {/* Divider */}
            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-2 text-[11px] text-muted-foreground">or continue with</span>
              </div>
            </div>

            {/* Social Login Buttons */}
            <div className="grid grid-cols-3 gap-1.5">
              <Button
                variant="outline"
                className="w-full text-[11px] h-7"
                disabled={busy}
                onClick={() => handleSocialLogin('google')}
              >
                {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : (
                  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Google
              </Button>
              <Button
                variant="outline"
                className="w-full text-[11px] h-7"
                disabled={busy}
                onClick={() => handleSocialLogin('facebook')}
              >
                {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : (
                  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="#1877F2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                )}
                Facebook
              </Button>
              <Button
                variant="outline"
                className="w-full text-[11px] h-7"
                disabled={busy}
                onClick={() => handleSocialLogin('apple')}
              >
                {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : (
                  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                )}
                Apple
              </Button>
            </div>

            {/* Divider */}
            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-2 text-[11px] text-muted-foreground">or</span>
              </div>
            </div>

            {/* Guest Play */}
            <GuestPlaySection busy={busy} onPlay={async (country) => {
  const ok = await callApi('/api/auth/guest', { country });
  return ok;
}} />

            {/* Bottom info */}
            <div className="mt-0 space-y-0">
              <p className="text-[11px] text-muted-foreground text-center">
                <Zap className="w-3 h-3 inline mr-1" />
                Guests get 150 starter chips. Register to keep your progress.
              </p>

              {/* View Rules & Guide link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setRulesOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 underline-offset-2 hover:underline cursor-pointer"
                >
                  <BookOpen className="w-3 h-3" />
                  View Rules &amp; Guide
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Game Rules Modal */}
        <GameRulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />

        {/* Forgot Password Modal */}
        <Dialog open={forgotOpen} onOpenChange={(open) => { setForgotOpen(open); setError(null); }}>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                Reset Password
              </DialogTitle>
              <DialogDescription className="text-xs">
                Enter your email and 4-digit Security PIN to set a new password.
              </DialogDescription>
            </DialogHeader>
            <ForgotPasswordForm
              busy={busy}
              error={error}
              onSuccess={() => {
                setForgotOpen(false);
                setError(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoginForm
// ---------------------------------------------------------------------------
function LoginForm({
  busy,
  error,
  onSubmit,
  onForgotPassword,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (path: string, body: unknown) => Promise<boolean>;
  onForgotPassword: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit('/api/auth/login', { email, password, remember });
      }}
      className="space-y-1.5"
    >
      <div className="space-y-1">
        <Label htmlFor="l-email" className="text-xs">Email</Label>
        <div className="relative">
          <Mail className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            id="l-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@arena.gg"
            className="pl-7 text-xs h-6"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="l-pass" className="text-xs">Password</Label>
        <div className="relative">
          <KeyRound className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            id="l-pass"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="pl-7 pr-8 text-xs h-6"
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Remember me */}
      <div className="flex items-center gap-1.5">
        <input
          type="checkbox"
          id="l-remember"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="rounded border-border"
        />
        <Label htmlFor="l-remember" className="text-[11px] text-muted-foreground cursor-pointer">
          Remember me (30 days)
        </Label>
      </div>

      {error && <p className="text-xs text-destructive flex items-center gap-1"><Shield className="w-3 h-3" /> {error}</p>}

      <Button type="submit" size="sm" className="w-full text-xs" disabled={busy}>
        {busy && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
        Login
      </Button>

      {/* Cross-links */}
      <div className="flex justify-between items-center">
        <button
          type="button"
          className="text-[11px] text-primary hover:text-primary/80 underline-offset-2 hover:underline cursor-pointer"
          onClick={() => {
            // Switch to register tab
            const tabList = document.querySelector('[role="tablist"]');
            if (tabList) {
              const registerTab = tabList.querySelectorAll('[role="tab"]')[1] as HTMLElement;
              registerTab?.click();
            }
          }}
        >
          Don&apos;t have an account? <span className="font-semibold">Register</span>
        </button>
        <button
          type="button"
          className="text-[11px] text-primary hover:text-primary/80 underline-offset-2 hover:underline cursor-pointer"
          onClick={onForgotPassword}
        >
          Forgot Password?
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// RegisterForm
// ---------------------------------------------------------------------------
function RegisterForm({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (path: string, body: unknown) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pin, setPin] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const strength = getPasswordStrength(password);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // FIX U3: surface mismatch via React state — the old code wrote textContent
    // into a `hidden` span, so the error was never visible and the form
    // silently did nothing.
    if (password !== confirmPassword) {
      setConfirmError('Passwords do not match.');
      return;
    }
    setConfirmError('');
    onSubmit('/api/auth/register', { name, email, password, pin, referralCode: referralCode.trim() || undefined });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-0.5">
      <div className="space-y-1">
        <Label htmlFor="r-name" className="text-xs">Display name (up to 20 chars)</Label>
        <Input id="r-name" required maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="ViperStrike" className="text-xs h-6" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-email" className="text-xs">Email</Label>
        <div className="relative">
          <Mail className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            id="r-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@arena.gg"
            className="pl-7 text-xs h-6"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-pass" className="text-xs">Password (min 6 chars)</Label>
        <div className="relative">
          <KeyRound className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            id="r-pass"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="pl-7 pr-8 text-xs h-6"
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        </div>
        {/* Password strength indicator */}
        {password.length > 0 && (
          <div className="space-y-0.5">
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div className={`h-full ${strength.color} ${strength.width} rounded-full transition-all duration-300`} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Strength: <span className={strength.score >= 3 ? 'text-emerald-500' : strength.score >= 2 ? 'text-yellow-500' : 'text-red-500'}>{strength.label}</span>
            </p>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-confirm" className="text-xs">Confirm Password</Label>
        <div className="relative">
          <KeyRound className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            id="r-confirm"
            type={showConfirm ? 'text' : 'password'}
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              // Clear match error if they now match
              const errEl = document.querySelector('[data-register-error]');
              if (errEl && e.target.value === password) errEl.textContent = '';
            }}
            placeholder="••••••••"
            className="pl-7 pr-8 text-xs h-6"
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => setShowConfirm(!showConfirm)}
          >
            {showConfirm ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-pin" className="text-xs">Security PIN (4 digits, optional)</Label>
        <Input
          id="r-pin"
          type="text"
          inputMode="numeric"
          maxLength={4}
          pattern="[0-9]{0,4}"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="e.g. 1234"
          className="text-xs h-6"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="r-referral" className="text-xs">Referral Code (optional)</Label>
        <Input
          id="r-referral"
          type="text"
          maxLength={12}
          autoComplete="off"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase().trim())}
          placeholder="e.g. VIPER-A7X2"
          className="text-xs h-6 font-mono"
        />
        <p className="text-[11px] text-muted-foreground">Enter a friend's code to earn 2,500 bonus chips each!</p>
      </div>

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1" data-register-error>
          <Shield className="w-3 h-3 shrink-0" /> {error}
        </p>
      )}
      {!error && confirmError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <Shield className="w-3 h-3 shrink-0" /> {confirmError}
        </p>
      )}

      <Button type="submit" size="sm" className="w-full text-xs" disabled={busy}>
        {busy && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
        Create Account
      </Button>

      {/* Cross-link to login */}
      <div className="flex justify-center">
        <button
          type="button"
          className="text-[11px] text-primary hover:text-primary/80 underline-offset-2 hover:underline cursor-pointer"
          onClick={() => {
            const tabList = document.querySelector('[role="tablist"]');
            if (tabList) {
              const loginTab = tabList.querySelectorAll('[role="tab"]')[0] as HTMLElement;
              loginTab?.click();
            }
          }}
        >
          Already have an account? <span className="font-semibold">Login</span>
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// ForgotPasswordForm (used inside the Dialog)
// ---------------------------------------------------------------------------
function ForgotPasswordForm({
  busy,
  error,
  onSuccess,
}: {
  busy: boolean;
  error: string | null;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [securityPin, setSecurityPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (newPassword !== confirmNew) {
      setLocalError('Passwords do not match.');
      return;
    }

    setLocalBusy(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, securityPin, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      // FIX U4: the server deliberately returns 200 with { error } for wrong
      // email/PIN (anti-enumeration). The old code only checked res.ok, so a
      // wrong email/PIN closed the dialog as if the reset had succeeded.
      if (!res.ok || data?.error) {
        setLocalError(data?.error || 'Failed to reset password.');
        return;
      }
      setSuccess(true);
      onSuccess();
    } catch {
      setLocalError('Network error. Please try again.');
    } finally {
      setLocalBusy(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-4 space-y-2">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <Shield className="w-6 h-6 text-emerald-400" />
        </div>
        <p className="text-sm font-semibold text-foreground">Password Reset!</p>
        <p className="text-xs text-muted-foreground">
          Your password has been changed. You can now log in with your new password.
        </p>
        <Button
          size="sm"
          className="mt-2"
          onClick={onSuccess}
        >
          Back to Login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="fp-email" className="text-xs">Email</Label>
        <Input
          id="fp-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@arena.gg"
          className="text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fp-pin" className="text-xs">4-Digit Security PIN</Label>
        <Input
          id="fp-pin"
          type="text"
          inputMode="numeric"
          required
          maxLength={4}
          pattern="[0-9]{4}"
          autoComplete="off"
          value={securityPin}
          onChange={(e) => setSecurityPin(e.target.value.replace(/\D/g, ''))}
          placeholder="1234"
          className="text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          This is the PIN you set during registration.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fp-new" className="text-xs">New Password (min 6 chars)</Label>
        <div className="relative">
          <Input
            id="fp-new"
            type={showNewPassword ? 'text' : 'password'}
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            className="pr-9 text-sm"
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => setShowNewPassword(!showNewPassword)}
          >
            {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fp-confirm" className="text-xs">Confirm New Password</Label>
        <Input
          id="fp-confirm"
          type="password"
          required
          minLength={6}
          value={confirmNew}
          onChange={(e) => {
            setConfirmNew(e.target.value);
            if (e.target.value === newPassword) setLocalError(null);
          }}
          placeholder="••••••••"
          className="text-sm"
        />
      </div>

      {(localError || error) && (
        <p className="text-xs text-destructive">{localError || error}</p>
      )}

      <Button type="submit" className="w-full" disabled={localBusy || busy}>
        {(localBusy || busy) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Reset Password
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Export skeleton
// ---------------------------------------------------------------------------
export function AuthGateSkeleton() {
  return <Skeleton className="w-full h-screen" />;
}
