'use client';
import GameCanvas from './GameCanvas';

interface OnlineSnakeGameProps {
  onExit?: () => void;
  arenaId?: string;
}

export default function OnlineSnakeGame(props: OnlineSnakeGameProps) {
  return <GameCanvas {...props} mode="online" />;
}
