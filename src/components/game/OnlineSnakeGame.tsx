'use client';
import GameCanvas from './GameCanvas';
import { useAuth } from '@/components/providers/auth-provider';

interface OnlineSnakeGameProps {
  onExit?: () => void;
  arenaId?: string;
}

export default function OnlineSnakeGame(props: OnlineSnakeGameProps) {
  const { player } = useAuth();
  return <GameCanvas {...props} mode="online" playerName={player?.name} />;
}
