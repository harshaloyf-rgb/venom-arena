'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.replace('/');
          return;
        }
        const data = (await res.json()) as { role?: string };
        if (data.role !== 'admin') {
          router.replace('/');
          return;
        }
        setAllowed(true);
      } catch {
        router.replace('/');
      } finally {
        setChecking(false);
      }
    }
    void check();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}