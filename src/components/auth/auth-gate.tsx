'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/providers/auth-provider';
import { Skull, Zap, LogIn, UserPlus, Ghost, Loader2 } from 'lucide-react';

export default function AuthGate() {
  const { loading } = useAuth();
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
  return <AuthScreen />;
}

function AuthScreen() {
  const { refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 va-neon-border">
            <Skull className="w-9 h-9 text-primary va-neon-text" />
          </div>
          <h1 className="text-4xl font-black tracking-tight va-neon-text">VENOM ARENA</h1>
          <p className="text-sm text-muted-foreground">
            Hunt. Harvest. Extract. <span className="text-primary font-semibold">Don&apos;t get caught.</span>
          </p>
        </div>

        <Card className="border-primary/20 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Enter the arena</CardTitle>
            <CardDescription>Sign in or create an account to play.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login"><LogIn className="w-4 h-4 mr-2" />Login</TabsTrigger>
                <TabsTrigger value="register"><UserPlus className="w-4 h-4 mr-2" />Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="mt-4">
                <LoginForm busy={busy} error={error} onSubmit={callApi} />
              </TabsContent>
              <TabsContent value="register" className="mt-4">
                <RegisterForm busy={busy} error={error} onSubmit={callApi} />
              </TabsContent>
            </Tabs>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center"><span className="bg-card px-2 text-xs text-muted-foreground">or</span></div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={async () => { await callApi('/api/auth/guest', {}); }}
            >
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ghost className="w-4 h-4 mr-2" />}
              Play as Guest
            </Button>

            <p className="text-[11px] text-muted-foreground text-center mt-3">
              <Zap className="w-3 h-3 inline mr-1" />
              Guests get 150 starter chips. Register to keep your progress.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoginForm({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (path: string, body: unknown) => Promise<boolean>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <form
      onSubmit={async (e) => { e.preventDefault(); await onSubmit('/api/auth/login', { email, password }); }}
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="l-email">Email</Label>
        <Input id="l-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@arena.gg" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="l-pass">Password</Label>
        <Input id="l-pass" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Login
      </Button>
    </form>
  );
}

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
  return (
    <form
      onSubmit={async (e) => { e.preventDefault(); await onSubmit('/api/auth/register', { name, email, password }); }}
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="r-name">Display name</Label>
        <Input id="r-name" required maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="ViperStrike" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-email">Email</Label>
        <Input id="r-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@arena.gg" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-pass">Password (min 6 chars)</Label>
        <Input id="r-pass" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create account
      </Button>
    </form>
  );
}

export function AuthGateSkeleton() {
  return <Skeleton className="w-full h-screen" />;
}
