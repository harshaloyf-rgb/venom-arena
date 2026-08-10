'use client';
import GameCanvas from './GameCanvas';
import { useAuth } from '@/components/providers/auth-provider';

interface SnakeGameProps {
  onExit?: () => void;
  arenaId?: string;
}

export default function SnakeGame(props: SnakeGameProps) {
  const { player } = useAuth();
  return <GameCanvas {...props} mode="offline" playerName={player?.name} />;
}
