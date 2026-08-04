'use client';

import SnakeGame from '@/components/game/SnakeGame';

export default function Home() {
  return (
    <main className="w-screen h-dvh bg-[#0a0a0f] overflow-hidden">
      <SnakeGame />
    </main>
  );
}
