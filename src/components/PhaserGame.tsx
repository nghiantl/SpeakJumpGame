import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { GameScene, type GameCommand } from '../game/GameScene';

interface Props {
  command: GameCommand;
  serial: number;
  total: number;
  actions: GameCommand[];
  paused: boolean;
  onActionComplete: (index: number) => void;
}
export default function PhaserGame({ command, serial, total, actions, paused, onActionComplete }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const scene = useRef<GameScene | null>(null);
  const latestCallback = useRef(onActionComplete);
  const lastSerial = useRef(serial);
  latestCallback.current = onActionComplete;
  useEffect(() => {
    if (!mount.current) return;
    const s = new GameScene({ total, actions, onActionComplete: index => latestCallback.current(index) });
    scene.current = s;
    game.current = new Phaser.Game({
      type: Phaser.AUTO, parent: mount.current, width: 800, height: 360,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [s], render: { pixelArt: false, antialias: true }
    });
    return () => { game.current?.destroy(true); game.current = null; scene.current = null; };
  }, [total]);
  useEffect(() => {
    if (serial !== lastSerial.current) {
      lastSerial.current = serial;
      if (scene.current?.sys?.isActive()) scene?.current?.command(command);
    }
  }, [serial, command]);
  useEffect(() => { if (scene.current?.sys?.isActive() || scene.current?.scene?.isPaused()) scene.current?.setPaused(paused); }, [paused]);
  return <div className="phaser-mount" ref={mount} aria-label="Speak and Jump platform game" />;
}
