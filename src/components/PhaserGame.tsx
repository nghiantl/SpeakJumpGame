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
  const queuedCommand = useRef<{ action: GameCommand; serial: number } | null>(null);
  latestCallback.current = onActionComplete;

  useEffect(() => {
    if (!mount.current) return;
    const s = new GameScene({ total, actions, onActionComplete: index => latestCallback.current(index) });
    scene.current = s;
    game.current = new Phaser.Game({
      type: Phaser.AUTO, parent: mount.current, width: 800, height: 360,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
      scene: [s], render: { pixelArt: false, antialias: true },
    });
    const flush = () => {
      const pending = queuedCommand.current;
      if (pending && s.sys.isActive() && s.command(pending.action)) queuedCommand.current = null;
    };
    game.current.events.on(Phaser.Core.Events.STEP, flush);
    return () => {
      game.current?.events.off(Phaser.Core.Events.STEP, flush);
      game.current?.destroy(true);
      game.current = null;
      scene.current = null;
      queuedCommand.current = null;
    };
  }, [total]);

  useEffect(() => {
    if (serial !== lastSerial.current) {
      lastSerial.current = serial;
      queuedCommand.current = { action: command, serial };
    }
  }, [serial, command]);

  useEffect(() => { scene.current?.setPaused(paused); }, [paused]);
  return <div className="phaser-mount" ref={mount} aria-label="Speak and Jump Arcade physics platform game" />;
}
