'use client';
import GameCanvas from './GameCanvas';

interface SnakeGameProps {
  onExit?: () => void;
  arenaId?: string;
}

export default function SnakeGame(props: SnakeGameProps) {
  return <GameCanvas {...props} mode="offline" />;
}
